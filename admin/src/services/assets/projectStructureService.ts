import { projectApi } from "./projectApi";

export interface ManagedFloorPlanDraft {
    draftId: string;
    projectName: string;
    intendedClientId: string;
    intendedClientName?: string;
    createdBy: string;
    creatorName: string;
    structuralRevision: number;
    structureInitialized: boolean;
    draftJsonPath?: string;
    draftJsonUrl?: string;
    projectData: Record<string, unknown> | null;
}

export interface SaveManagedStructureInput {
    projectId: string;
    projectName: string;
    ownerId: string;
    projectData: Record<string, unknown>;
    revision: number;
    published: boolean;
}

export async function createManagedFloorPlanDraft(input: {
    projectName: string;
    ownerId: string;
}): Promise<ManagedFloorPlanDraft> {
    const response = await projectApi<{ draft: ManagedFloorPlanDraft }>(
        "/admin/floor-plan-drafts",
        {
            method: "POST",
            body: JSON.stringify(input)
        }
    );
    return response.draft;
}

export async function getManagedFloorPlanDraft(
    draftId: string
): Promise<ManagedFloorPlanDraft> {
    const response = await projectApi<{ draft: ManagedFloorPlanDraft }>(
        `/admin/floor-plan-drafts/${encodeURIComponent(draftId)}`
    );
    return response.draft;
}

export async function saveManagedFloorPlanDraft(input: {
    draftId: string;
    projectName: string;
    projectData: Record<string, unknown>;
    revision: number;
}): Promise<void> {
    await projectApi(
        `/admin/floor-plan-drafts/${encodeURIComponent(input.draftId)}`,
        {
            method: "PUT",
            body: JSON.stringify({
                projectName: input.projectName,
                projectData: input.projectData,
                revision: input.revision
            })
        }
    );
}

export async function publishManagedFloorPlanDraft(input: {
    draftId: string;
    projectName: string;
    projectData: Record<string, unknown>;
}): Promise<{ projectId: string }> {
    const response = await projectApi<{ projectId: string }>(
        `/admin/floor-plan-drafts/${encodeURIComponent(input.draftId)}/publish`,
        {
            method: "POST",
            body: JSON.stringify({
                projectName: input.projectName,
                projectData: input.projectData
            })
        }
    );
    return { projectId: response.projectId };
}

export async function saveManagedStructure(input: SaveManagedStructureInput): Promise<void> {
    await projectApi(
        `/admin/projects/${encodeURIComponent(input.projectId)}/structure`,
        {
            method: "PUT",
            body: JSON.stringify(input)
        }
    );
}
