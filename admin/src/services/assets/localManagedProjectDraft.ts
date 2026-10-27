import { validateStructuralProjectData } from "./projectStructureContract.ts";
import type { ManagedStructure } from "@/components/project-editor/structureTypes";

export interface LocalManagedProjectDraft {
    schemaVersion: 1;
    draftId: string;
    ownerId: string;
    projectName: string;
    structure: ManagedStructure;
    revision: number;
    updatedAt: string;
}

function storageKey(ownerId: string): string {
    return `espasyo.adminManagedProjectDraft.v1:${encodeURIComponent(ownerId)}`;
}

function isValidDraft(value: unknown, ownerId: string): value is LocalManagedProjectDraft {
    if (typeof value !== "object" || value === null) return false;
    const draft = value as Partial<LocalManagedProjectDraft> & {
        structure?: Record<string, unknown>;
    };
    if (
        draft.schemaVersion !== 1 ||
        typeof draft.draftId !== "string" ||
        !draft.draftId.startsWith("local-") ||
        draft.ownerId !== ownerId ||
        typeof draft.projectName !== "string" ||
        typeof draft.revision !== "number" ||
        !Number.isSafeInteger(draft.revision) ||
        draft.revision < 0 ||
        typeof draft.updatedAt !== "string" ||
        typeof draft.structure !== "object" ||
        draft.structure === null
    ) {
        return false;
    }

    const structure = draft.structure;
    return structure.projectId === draft.draftId
        && structure.ownerId === ownerId
        && Array.isArray(structure.walls)
        && Array.isArray(structure.corners)
        && Array.isArray(structure.doors)
        && Array.isArray(structure.windows)
        && Array.isArray(structure.openings)
        && validateStructuralProjectData({
            ...structure,
            workflowType: "admin-managed",
            structuralOwner: "admin",
            structuralRevision: Math.max(draft.revision, 1),
            blueprint: null
        }).length === 0;
}

export function loadLocalManagedProjectDraft(ownerId: string): LocalManagedProjectDraft | null {
    const key = storageKey(ownerId);
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;

    try {
        const parsed: unknown = JSON.parse(raw);
        if (isValidDraft(parsed, ownerId)) {
            return {
                ...parsed,
                structure: { ...parsed.structure, blueprint: null }
            };
        }
    } catch (error) {
        console.warn("Unable to read the saved local floor-plan draft.", error);
    }

    window.localStorage.removeItem(key);
    return null;
}

export function saveLocalManagedProjectDraft(draft: LocalManagedProjectDraft): void {
    const normalized = {
        ...draft,
        schemaVersion: 1 as const,
        structure: {
            ...draft.structure,
            projectId: draft.draftId,
            ownerId: draft.ownerId,
            projectName: draft.projectName,
            blueprint: null
        },
        updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(storageKey(draft.ownerId), JSON.stringify(normalized));
}

export function removeLocalManagedProjectDraft(ownerId: string): void {
    window.localStorage.removeItem(storageKey(ownerId));
}
