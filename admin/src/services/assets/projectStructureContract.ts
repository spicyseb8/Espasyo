export type ProjectWorkflowType = "legacy" | "admin-managed";
export type StructuralStatus = "draft" | "published";

export interface ProjectStructureMetadata {
    workflowType?: ProjectWorkflowType;
    structuralOwner?: "admin";
    structuralStatus?: StructuralStatus;
    structuralRevision?: number;
    publishedStructuralRevision?: number;
}

export interface StructuralSaveRequest {
    projectId: string;
    projectName: string;
    ownerId: string;
    revision: number;
    status: StructuralStatus;
    projectData: unknown;
}

export function getProjectWorkflowType(
    project: ProjectStructureMetadata | null | undefined
): ProjectWorkflowType {
    return project?.workflowType === "admin-managed"
        ? "admin-managed"
        : "legacy";
}

export function isPublishedManagedProject(
    project: ProjectStructureMetadata | null | undefined
): boolean {
    return project?.workflowType === "admin-managed"
        && project.structuralStatus === "published"
        && typeof project.publishedStructuralRevision === "number"
        && project.publishedStructuralRevision > 0;
}

export function findSingleManagedProjectId(
    projects: Array<{
        projectId: string;
        ownerId: string;
        workflowType?: string;
    }>,
    ownerId: string
): string | null {
    const matches = projects.filter(project =>
        project.ownerId === ownerId &&
        project.workflowType === "admin-managed"
    );

    if (matches.length > 1) {
        throw new Error(
            "This client has multiple admin-managed projects. Resolve the existing project records before creating or editing a designated floor plan."
        );
    }

    return matches[0]?.projectId ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasVector(value: unknown): boolean {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.x === "number"
        && Number.isFinite(value.x)
        && typeof value.y === "number"
        && Number.isFinite(value.y)
        && typeof value.z === "number"
        && Number.isFinite(value.z);
}

export function validateStructuralProjectData(value: unknown): string[] {
    const errors: string[] = [];

    if (!isRecord(value)) {
        return ["Project JSON must be an object."];
    }

    for (const field of ["walls", "corners", "doors", "windows", "openings"] as const) {
        if (!Array.isArray(value[field])) {
            errors.push(`${field} must be an array.`);
        }
    }

    if (!errors.length) {
        const corners = value.corners as Record<string, unknown>[];
        const walls = value.walls as Record<string, unknown>[];
        const doors = value.doors as Record<string, unknown>[];
        const windows = value.windows as Record<string, unknown>[];
        const openings = value.openings as Record<string, unknown>[];
        const cornerIds = new Set(corners.map(corner => corner.id));
        const wallIds = new Set(walls.map(wall => wall.id));

        for (const corner of corners) {
            if (typeof corner.id !== "string" || !hasVector(corner.position)) {
                errors.push("Every corner requires an id and a finite 3D position.");
            }
        }

        for (const wall of walls) {
            const start = wall.start;
            const end = wall.end;
            if (
                typeof wall.id !== "string"
                || !isRecord(start)
                || typeof start.id !== "string"
                || !isRecord(end)
                || typeof end.id !== "string"
                || !isRecord(start.position)
                || !isRecord(end.position)
                || !hasVector(start.position)
                || !hasVector(end.position)
            ) {
                errors.push("Every wall requires an id and finite start/end references.");
                continue;
            }

            if (!cornerIds.has(start.id) && !isRecord(start.position)) {
                errors.push("Wall start must reference a valid corner.");
            }
            if (!cornerIds.has(end.id) && !isRecord(end.position)) {
                errors.push("Wall end must reference a valid corner.");
            }
        }

        const validateHostElements = (
            elements: Record<string, unknown>[],
            label: string
        ) => {
            for (const element of elements) {
                if (
                    typeof element.id !== "string"
                    || typeof element.wallId !== "string"
                    || !wallIds.has(element.wallId)
                    || !isRecord(element.position)
                    || !hasVector(element.position)
                ) {
                    errors.push(`Every ${label} requires an id, finite position, and valid host wall.`);
                }
            }
        };

        validateHostElements(doors, "door");
        validateHostElements(windows, "window");
        validateHostElements(openings, "opening");

        if (
            value.workflowType === "admin-managed"
            && value.blueprint != null
        ) {
            errors.push("Managed project JSON must not persist blueprint runtime data.");
        }
    }

    if (value.workflowType === "admin-managed") {
        if (value.structuralOwner !== "admin") {
            errors.push("Managed projects must identify the admin as structural owner.");
        }
        if (!Number.isSafeInteger(value.structuralRevision) || Number(value.structuralRevision) < 1) {
            errors.push("Managed projects require a positive structural revision.");
        }
    }

    return errors;
}
