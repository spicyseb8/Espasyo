const ACTIVE_PROJECT_KEY =
    "espasyo_active_saved_project_id";

const BASELINE_PREFIX =
    "espasyo_project_baseline_";

function getBaselineKey(
    projectId:
        string
): string {
    return `${BASELINE_PREFIX}${projectId}`;
}

function normalizeProjectData(
    projectData:
        unknown
): unknown {
    if (
        !projectData ||
        typeof projectData !==
        "object"
    ) {
        return projectData;
    }

    const copy =
        JSON.parse(
            JSON.stringify(
                projectData
            )
        ) as Record<string, unknown>;

    delete copy.savedAt;
    delete copy.costEstimate;

    return copy;
}

export function getProjectFingerprint(
    projectData:
        unknown
): string {
    return JSON.stringify(
        normalizeProjectData(
            projectData
        )
    );
}

export function saveProjectBaseline(
    projectId:
        string,
    projectData:
        unknown
): void {
    sessionStorage.setItem(
        getBaselineKey(
            projectId
        ),
        JSON.stringify(
            normalizeProjectData(
                projectData
            )
        )
    );

    sessionStorage.setItem(
        ACTIVE_PROJECT_KEY,
        projectId
    );
}

export function getProjectBaseline(
    projectId:
        string
): unknown | null {
    const raw =
        sessionStorage.getItem(
            getBaselineKey(
                projectId
            )
        );

    if (
        !raw
    ) {
        return null;
    }

    try {
        return JSON.parse(
            raw
        );
    } catch {
        return null;
    }
}

export function getActiveSavedProjectId():
    string | null {
    return sessionStorage.getItem(
        ACTIVE_PROJECT_KEY
    );
}

export function clearProjectSession(): void {
    const activeProjectId =
        getActiveSavedProjectId();

    if (
        activeProjectId
    ) {
        sessionStorage.removeItem(
            getBaselineKey(
                activeProjectId
            )
        );
    }

    sessionStorage.removeItem(
        ACTIVE_PROJECT_KEY
    );
}