import { validateStructuralProjectData } from "./projectStructureContract.ts";

export interface ManagedStructurePublicationInput {
    ownerId: string;
    projectName: string;
    projectData: Record<string, unknown>;
}

export interface ManagedStructurePublicationCommit {
    projectId: string;
    projectName: string;
    ownerId: string;
    revision: number;
    storagePath: string;
    jsonUrl: string;
}

export interface ManagedStructurePublicationDependencies {
    findExistingProject: (ownerId: string) => Promise<string | null>;
    getAssignedProject: (ownerId: string) => Promise<string | null>;
    allocateProjectId: () => Promise<string>;
    upload: (storagePath: string, json: string) => Promise<string>;
    commit: (publication: ManagedStructurePublicationCommit) => Promise<void>;
    cleanup: (storagePath: string) => Promise<void>;
}

export async function publishManagedStructure(
    input: ManagedStructurePublicationInput,
    dependencies: ManagedStructurePublicationDependencies
) {
    const ownerId = input.ownerId.trim();
    const projectName = input.projectName.trim();
    if (!ownerId || !projectName) {
        throw new Error("Project name and client owner UID are required before publishing.");
    }

    const existingProjectId = await dependencies.findExistingProject(ownerId);
    if (existingProjectId) {
        throw new Error(
            `This client already has designated project ${existingProjectId}. Open that project instead of publishing this local draft.`
        );
    }
    const assignedProjectId = await dependencies.getAssignedProject(ownerId);
    if (assignedProjectId) {
        throw new Error(
            `This client is already assigned to project ${assignedProjectId}. Open that project instead of publishing this local draft.`
        );
    }

    const projectId = await dependencies.allocateProjectId();
    const revision = 1;
    const managedData = {
        ...input.projectData,
        projectId,
        projectName,
        ownerId,
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralStatus: "published",
        structuralRevision: revision,
        publishedStructuralRevision: revision,
        blueprint: null
    };
    const validationErrors = validateStructuralProjectData(managedData);
    if (validationErrors.length) {
        throw new Error(`Invalid managed structure: ${validationErrors.join(" ")}`);
    }

    const storagePath = `projects/${ownerId}/${projectId}/published-r${revision}-${crypto.randomUUID()}.json`;
    const publicationJson = JSON.stringify(managedData, null, 2);
    let jsonUrl: string;
    try {
        jsonUrl = await dependencies.upload(storagePath, publicationJson);
    } catch (error) {
        try {
            await dependencies.cleanup(storagePath);
        } catch (cleanupError) {
            throw new Error(
                `Structure upload failed and cleanup could not be confirmed; storage path may be orphaned: ${storagePath}. ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
                { cause: cleanupError }
            );
        }
        throw error;
    }

    try {
        await dependencies.commit({
            projectId,
            projectName,
            ownerId,
            revision,
            storagePath,
            jsonUrl
        });
    } catch (error) {
        try {
            await dependencies.cleanup(storagePath);
        } catch (cleanupError) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)} Cleanup failed; orphaned upload may remain at ${storagePath}. ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
                { cause: cleanupError }
            );
        }
        throw error;
    }

    return { projectId, ownerId, projectName, storagePath, jsonUrl, revision, published: true as const };
}
