import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    type Transaction,
    where
} from "firebase/firestore";
import {
    getDownloadURL,
    deleteObject,
    ref,
    uploadString
} from "firebase/storage";
import { db, storage } from "@/firebase/firebase";
import {
    findSingleManagedProjectId,
    validateStructuralProjectData
} from "./projectStructureContract";
import { publishManagedStructure } from "./managedStructurePublication";

function getPhilippineYear(): number {
    const year = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric"
    }).format(new Date());

    return Number(year);
}

export function formatProjectId(sequence: number, year: number): string {
    return `PRJ-${String(sequence).padStart(3, "0")}${String(year % 100).padStart(2, "0")}`;
}

async function reserveNextProjectId(
    transaction: Transaction,
    year: number
): Promise<string> {
    const counterReference = doc(db, "idCounters", `projects-${year}`);
    const counterSnapshot = await transaction.get(counterReference);
    const storedSequence = counterSnapshot.exists()
        ? Number(counterSnapshot.data().lastSequence ?? 0)
        : 0;

    if (!Number.isSafeInteger(storedSequence) || storedSequence < 0) {
        throw new Error("The project ID counter is invalid.");
    }

    let nextSequence = storedSequence + 1;
    let nextProjectId = formatProjectId(nextSequence, year);
    let destinationReference = doc(db, "projects", nextProjectId);
    let destinationSnapshot = await transaction.get(destinationReference);

    while (destinationSnapshot.exists()) {
        nextSequence += 1;
        if (!Number.isSafeInteger(nextSequence)) {
            throw new Error("Unable to generate another project ID.");
        }
        nextProjectId = formatProjectId(nextSequence, year);
        destinationReference = doc(db, "projects", nextProjectId);
        destinationSnapshot = await transaction.get(destinationReference);
    }

    transaction.set(counterReference, {
        lastSequence: nextSequence,
        year,
        updatedAt: serverTimestamp()
    }, { merge: true });

    return nextProjectId;
}

export async function allocateProjectId(): Promise<string> {
    const year = getPhilippineYear();

    return runTransaction(db, transaction => reserveNextProjectId(transaction, year));
}

export async function ensureManagedProjectForClient(
    ownerId: string,
    projectName = "Untitled floor plan"
): Promise<string> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
        throw new Error("A client owner UID is required.");
    }

    const ownerProjects = await getDocs(query(
        collection(db, "projects"),
        where("ownerId", "==", normalizedOwnerId)
    ));
    const existingProjectId = findSingleManagedProjectId(
        ownerProjects.docs.map(project => ({
            projectId: project.id,
            ownerId: String(project.data().ownerId ?? ""),
            workflowType: typeof project.data().workflowType === "string"
                ? project.data().workflowType
                : undefined
        })),
        normalizedOwnerId
    );
    const assignmentReference = doc(
        db,
        "adminManagedProjectAssignments",
        encodeURIComponent(normalizedOwnerId)
    );
    const year = getPhilippineYear();

    return runTransaction(db, async transaction => {
        const assignmentSnapshot = await transaction.get(assignmentReference);
        if (assignmentSnapshot.exists()) {
            const assignedProjectId = assignmentSnapshot.data().projectId;
            if (typeof assignedProjectId !== "string" || !assignedProjectId.trim()) {
                throw new Error("The client's designated project assignment is invalid.");
            }

            const assignedProjectReference = doc(db, "projects", assignedProjectId);
            const assignedProjectSnapshot = await transaction.get(assignedProjectReference);
            if (!assignedProjectSnapshot.exists()) {
                throw new Error("The client's designated project is missing. No replacement was created.");
            }
            const assignedProject = assignedProjectSnapshot.data();
            if (
                assignedProject.ownerId !== normalizedOwnerId ||
                assignedProject.workflowType !== "admin-managed"
            ) {
                throw new Error("The client's designated project has conflicting ownership metadata.");
            }
            return assignedProjectId;
        }

        if (existingProjectId) {
            const existingProjectReference = doc(db, "projects", existingProjectId);
            const existingProjectSnapshot = await transaction.get(existingProjectReference);
            if (!existingProjectSnapshot.exists()) {
                throw new Error("The existing admin-managed project disappeared. Try again.");
            }
            const existingProject = existingProjectSnapshot.data();
            if (
                existingProject.ownerId !== normalizedOwnerId ||
                existingProject.workflowType !== "admin-managed"
            ) {
                throw new Error("The existing admin-managed project has conflicting ownership metadata.");
            }
            transaction.set(assignmentReference, {
                ownerId: normalizedOwnerId,
                projectId: existingProjectId,
                updatedAt: serverTimestamp()
            });
            return existingProjectId;
        }

        const projectId = await reserveNextProjectId(transaction, year);
        const projectReference = doc(db, "projects", projectId);
        transaction.set(assignmentReference, {
            ownerId: normalizedOwnerId,
            projectId,
            updatedAt: serverTimestamp()
        });
        transaction.set(projectReference, {
            projectId,
            projectName: projectName.trim() || "Untitled floor plan",
            ownerId: normalizedOwnerId,
            schemaVersion: 1,
            workflowType: "admin-managed",
            structuralOwner: "admin",
            structuralStatus: "draft",
            structuralRevision: 0,
            structureInitialized: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return projectId;
    });
}

export async function claimExistingManagedProject(
    ownerId: string,
    projectId: string
): Promise<void> {
    const normalizedOwnerId = ownerId.trim();
    const normalizedProjectId = projectId.trim();
    if (!normalizedOwnerId || !normalizedProjectId) {
        throw new Error("Client owner UID and project ID are required.");
    }

    const ownerProjects = await getDocs(query(
        collection(db, "projects"),
        where("ownerId", "==", normalizedOwnerId)
    ));
    const existingProjectId = findSingleManagedProjectId(
        ownerProjects.docs.map(project => ({
            projectId: project.id,
            ownerId: String(project.data().ownerId ?? ""),
            workflowType: typeof project.data().workflowType === "string"
                ? project.data().workflowType
                : undefined
        })),
        normalizedOwnerId
    );
    if (existingProjectId !== normalizedProjectId) {
        throw new Error(
            "This project is not the client's single designated admin-managed project."
        );
    }

    const assignmentReference = doc(
        db,
        "adminManagedProjectAssignments",
        encodeURIComponent(normalizedOwnerId)
    );
    const projectReference = doc(db, "projects", normalizedProjectId);
    await runTransaction(db, async transaction => {
        const [assignmentSnapshot, projectSnapshot] = await Promise.all([
            transaction.get(assignmentReference),
            transaction.get(projectReference)
        ]);
        if (!projectSnapshot.exists()) {
            throw new Error("The existing admin-managed project no longer exists.");
        }
        const project = projectSnapshot.data();
        if (
            project.ownerId !== normalizedOwnerId ||
            project.workflowType !== "admin-managed"
        ) {
            throw new Error("The existing project has conflicting ownership metadata.");
        }
        if (assignmentSnapshot.exists()) {
            if (assignmentSnapshot.data().projectId !== normalizedProjectId) {
                throw new Error("The client already has a different designated project.");
            }
            return;
        }
        transaction.set(assignmentReference, {
            ownerId: normalizedOwnerId,
            projectId: normalizedProjectId,
            updatedAt: serverTimestamp()
        });
    });
}

export interface SaveManagedStructureInput {
    projectId: string;
    projectName: string;
    ownerId: string;
    projectData: Record<string, unknown>;
    revision: number;
    published: boolean;
}

export interface PublishLocalManagedStructureInput {
    projectName: string;
    ownerId: string;
    projectData: Record<string, unknown>;
}

export async function publishLocalManagedStructure(input: PublishLocalManagedStructureInput) {
    const ownerId = input.ownerId.trim();
    const assignmentReference = doc(
        db,
        "adminManagedProjectAssignments",
        encodeURIComponent(ownerId)
    );
    return publishManagedStructure(input, {
        findExistingProject: async clientOwnerId => {
            const ownerProjects = await getDocs(query(
                collection(db, "projects"),
                where("ownerId", "==", clientOwnerId)
            ));
            return findSingleManagedProjectId(
                ownerProjects.docs.map(project => ({
                    projectId: project.id,
                    ownerId: String(project.data().ownerId ?? ""),
                    workflowType: typeof project.data().workflowType === "string"
                        ? project.data().workflowType
                        : undefined
                })),
                clientOwnerId
            );
        },
        getAssignedProject: async () => {
            const assignment = await getDoc(assignmentReference);
            return assignment.exists() && typeof assignment.data().projectId === "string"
                ? assignment.data().projectId
                : null;
        },
        allocateProjectId,
        upload: async (storagePath, json) => {
            const storageReference = ref(storage, storagePath);
            await uploadString(storageReference, json, "raw", {
                contentType: "application/json"
            });
            return getDownloadURL(storageReference);
        },
        commit: async publication => {
            const projectReference = doc(db, "projects", publication.projectId);
            await runTransaction(db, async transaction => {
                const [assignmentSnapshot, projectSnapshot] = await Promise.all([
                    transaction.get(assignmentReference),
                    transaction.get(projectReference)
                ]);
                if (assignmentSnapshot.exists()) {
                    const assignedProjectId = assignmentSnapshot.data().projectId;
                    throw new Error(
                        `This client was assigned project ${String(assignedProjectId)} while publishing. No duplicate project was created.`
                    );
                }
                if (projectSnapshot.exists()) {
                    throw new Error("The generated project ID is already in use. No project was published.");
                }

                transaction.set(assignmentReference, {
                    ownerId,
                    projectId: publication.projectId,
                    updatedAt: serverTimestamp()
                });
                transaction.set(projectReference, {
                    projectId: publication.projectId,
                    projectName: publication.projectName,
                    ownerId,
                    schemaVersion: 1,
                    workflowType: "admin-managed",
                    structuralOwner: "admin",
                    structuralStatus: "published",
                    structuralRevision: publication.revision,
                    publishedStructuralRevision: publication.revision,
                    structureInitialized: true,
                    jsonPath: publication.storagePath,
                    jsonUrl: publication.jsonUrl,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });
        },
        cleanup: async storagePath => {
            await deleteObject(ref(storage, storagePath));
        }
    });
}

export async function saveManagedStructure(input: SaveManagedStructureInput) {
    const projectId = input.projectId.trim();
    const ownerId = input.ownerId.trim();

    if (!projectId || !ownerId) {
        throw new Error("Project ID and client owner UID are required.");
    }
    if (
        input.projectData.projectId !== projectId ||
        input.projectData.ownerId !== ownerId
    ) {
        throw new Error("The structural JSON project ID and owner must match the save target.");
    }
    if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
        throw new Error("A positive structural revision is required.");
    }

    const projectReference = doc(db, "projects", projectId);
    const assignmentReference = doc(
        db,
        "adminManagedProjectAssignments",
        encodeURIComponent(ownerId)
    );
    const existingMetadata = await getDoc(projectReference);
    if (!existingMetadata.exists()) {
        throw new Error("The designated client project does not exist. Reopen Project Management and try again.");
    }
    const existingData = existingMetadata.data();
    const expectedStructuralRevision = existingData.structuralRevision;
    const expectedPublishedStructuralRevision = existingData.publishedStructuralRevision;
    const expectedStructuralStatus = existingData.structuralStatus;
    const expectedDraftJsonPath = existingData.draftJsonPath;
    const expectedDraftJsonUrl = existingData.draftJsonUrl;
    const expectedPublishedJsonPath = existingData.jsonPath;
    const expectedPublishedJsonUrl = existingData.jsonUrl;
    if (
        existingData.ownerId !== ownerId ||
        existingData.workflowType !== "admin-managed"
    ) {
        throw new Error("Project ownership or workflow metadata does not match this structural save.");
    }
    const assignmentSnapshot = await getDoc(assignmentReference);
    if (!assignmentSnapshot.exists() || assignmentSnapshot.data().projectId !== projectId) {
        throw new Error("This client is assigned a different structural project. No data was changed.");
    }

    const managedData = {
        ...input.projectData,
        projectId,
        ownerId,
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralStatus: input.published ? "published" : "draft",
        structuralRevision: input.revision,
        publishedStructuralRevision: input.published
            ? input.revision
            : undefined,
        blueprint: null
    };

    const validationErrors = validateStructuralProjectData(managedData);
    if (validationErrors.length) {
        throw new Error(`Invalid managed structure: ${validationErrors.join(" ")}`);
    }

    const storagePath = `projects/${ownerId}/${projectId}/${input.published ? "published" : "draft"}-r${input.revision}-${crypto.randomUUID()}.json`;
    const storageReference = ref(storage, storagePath);
    await uploadString(storageReference, JSON.stringify(managedData, null, 2), "raw", {
        contentType: "application/json"
    });
    const jsonUrl = await getDownloadURL(storageReference);

    const previouslyPublished = existingData.workflowType === "admin-managed"
        && existingData.structuralStatus === "published"
        && typeof existingData.publishedStructuralRevision === "number";

    const metadata: Record<string, unknown> = {
        projectId,
        projectName: input.projectName.trim(),
        ownerId,
        schemaVersion: 1,
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralStatus: input.published
            ? "published"
            : previouslyPublished
                ? "published"
                : "draft",
        structuralRevision: input.published
            ? input.revision
            : previouslyPublished
                ? existingData.structuralRevision
                : input.revision,
        structureInitialized: true,
        updatedAt: serverTimestamp()
    };

    if (input.published) {
        metadata.jsonPath = storagePath;
        metadata.jsonUrl = jsonUrl;
        metadata.publishedStructuralRevision = input.revision;
    } else {
        metadata.draftJsonPath = storagePath;
        metadata.draftJsonUrl = jsonUrl;
    }

    await runTransaction(db, async transaction => {
        const [currentProjectSnapshot, currentAssignmentSnapshot] = await Promise.all([
            transaction.get(projectReference),
            transaction.get(assignmentReference)
        ]);
        if (!currentProjectSnapshot.exists()) {
            throw new Error("The designated client project was removed during save.");
        }
        const currentProject = currentProjectSnapshot.data();
        if (
            currentProject.ownerId !== ownerId ||
            currentProject.workflowType !== "admin-managed"
        ) {
            throw new Error("Project ownership changed during save. The structural metadata was not updated.");
        }
        if (
            currentProject.structuralRevision !== expectedStructuralRevision ||
            currentProject.publishedStructuralRevision !== expectedPublishedStructuralRevision ||
            currentProject.structuralStatus !== expectedStructuralStatus ||
            currentProject.draftJsonPath !== expectedDraftJsonPath ||
            currentProject.draftJsonUrl !== expectedDraftJsonUrl ||
            currentProject.jsonPath !== expectedPublishedJsonPath ||
            currentProject.jsonUrl !== expectedPublishedJsonUrl
        ) {
            throw new Error("The project structure changed during save. Reload the project before saving again.");
        }
        if (
            !currentAssignmentSnapshot.exists() ||
            currentAssignmentSnapshot.data().projectId !== projectId
        ) {
            throw new Error("The client's designated project changed during save.");
        }
        transaction.set(projectReference, metadata, { merge: true });
    });

    return {
        projectId,
        ownerId,
        storagePath,
        jsonUrl,
        revision: input.revision,
        published: input.published
    };
}
