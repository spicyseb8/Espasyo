import type {
    ProjectData
} from "./projectSerializer";

export interface DraftProject {
    draftId: string;
    projectId: string;
    ownerId: string;
    projectName: string;
    savedAt: string;
    thumbnail: string;
    projectData: ProjectData;
}

const STORAGE_KEY =
    "espasyo_project_drafts";

function readDrafts(): DraftProject[] {
    try {
        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!raw) {
            return [];
        }

        const parsed =
            JSON.parse(raw);

        return Array.isArray(
            parsed
        )
            ? parsed
            : [];
    } catch {
        return [];
    }
}

function writeDrafts(
    drafts: DraftProject[]
) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
            drafts
        )
    );
}

export function getDrafts(
    ownerId: string
): DraftProject[] {
    return readDrafts()
        .filter(
            draft =>
                draft.ownerId ===
                ownerId
        )
        .sort(
            (
                first,
                second
            ) =>
                new Date(
                    second.savedAt
                ).getTime() -
                new Date(
                    first.savedAt
                ).getTime()
        );
}

export function getDraft(
    ownerId: string,
    draftId: string
): DraftProject | null {
    return (
        readDrafts().find(
            draft =>
                draft.ownerId ===
                    ownerId &&
                draft.draftId ===
                    draftId
        ) ?? null
    );
}

export function saveDraft(
    draft: DraftProject
) {
    const drafts =
        readDrafts();

    const index =
        drafts.findIndex(
            item =>
                item.ownerId ===
                    draft.ownerId &&
                item.draftId ===
                    draft.draftId
        );

    if (
        index >= 0
    ) {
        drafts[index] =
            draft;
    } else {
        drafts.push(
            draft
        );
    }

    writeDrafts(
        drafts
    );
}

export function deleteDraft(
    ownerId: string,
    draftId: string
) {
    writeDrafts(
        readDrafts().filter(
            draft =>
                !(
                    draft.ownerId ===
                        ownerId &&
                    draft.draftId ===
                        draftId
                )
        )
    );
}