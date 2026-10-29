export type ProjectLifecycleStatus =
    | "available"
    | "client-designed"
    | "legacy"
    | "unverified";

export interface LifecycleProject {
    projectId: string;
    ownerId: string;
    workflowType?: string;
    structuralStatus?: string;
    publishedStructuralRevision?: number;
    clientDesignStarted?: boolean;
    lifecycleStatus?: ProjectLifecycleStatus;
}

export function hasMeaningfulInteriorData(value: unknown): boolean {
    if (!isRecord(value)) return false;
    const hasFurniture = Array.isArray(value.furniture) &&
        value.furniture.some(isMeaningfulFurniturePlacement);
    const hasFloorFinishes = isNonEmptyStringRecord(value.floorFinishes);
    const hasWallFinishes = isNonEmptyNestedStringRecord(value.wallFinishes);
    return hasFurniture || hasFloorFinishes || hasWallFinishes;
}

export function classifyProjectLifecycle(
    project: LifecycleProject,
    assignedProjectId: string | null,
    interiorData?: unknown
): ProjectLifecycleStatus {
    if (project.workflowType !== "admin-managed") return "legacy";
    if (
        !project.projectId.trim() ||
        !project.ownerId.trim() ||
        assignedProjectId !== project.projectId ||
        project.structuralStatus !== "published" ||
        !Number.isSafeInteger(project.publishedStructuralRevision) ||
        (project.publishedStructuralRevision ?? 0) < 1
    ) {
        return "unverified";
    }

    return project.clientDesignStarted === true ||
        (project.clientDesignStarted === undefined && hasMeaningfulInteriorData(interiorData))
        ? "client-designed"
        : "available";
}

export function isProjectAssignedToOwner(
    ownerId: string,
    projectId: string,
    assignment: unknown
): boolean {
    if (!isRecord(assignment)) return false;
    return assignment.ownerId === ownerId && assignment.projectId === projectId;
}

export function getInitialClientDesignLifecycle(
    existingValue: unknown
): Record<string, boolean> {
    return typeof existingValue === "boolean"
        ? {}
        : { clientDesignStarted: false };
}

export function getAvailableFloorPlanProjects<T extends LifecycleProject>(
    projects: T[]
): T[] {
    return projects.filter(project => project.lifecycleStatus === "available");
}

export function getClientDesignedProjects<T extends LifecycleProject>(
    projects: T[]
): T[] {
    return projects.filter(project =>
        project.lifecycleStatus === "client-designed" ||
        project.lifecycleStatus === "legacy"
    );
}

export function getUnverifiedManagedProjects<T extends LifecycleProject>(
    projects: T[]
): T[] {
    return projects.filter(project => project.lifecycleStatus === "unverified");
}

function isMeaningfulFurniturePlacement(value: unknown): boolean {
    return isRecord(value) &&
        typeof value.id === "string" &&
        value.id.trim() !== "" &&
        typeof value.assetId === "string" &&
        value.assetId.trim() !== "";
}

function isNonEmptyStringRecord(value: unknown): boolean {
    return isRecord(value) &&
        Object.keys(value).length > 0 &&
        Object.values(value).every(item => typeof item === "string" && item.trim() !== "");
}

function isNonEmptyNestedStringRecord(value: unknown): boolean {
    return isRecord(value) &&
        Object.values(value).some(isNonEmptyStringRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
