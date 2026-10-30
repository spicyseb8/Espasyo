import { validateStaircaseDimensions } from "../../../../shared/staircaseGeometry.ts";

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

function validateStairArrays(
    value: Record<string, unknown>,
    errors: string[],
    label: string
): void {
    const stairs = value.stairs;
    const landings = value.stairLandings;
    if (stairs !== undefined && !Array.isArray(stairs)) {
        errors.push(`${label}stairs must be an array.`);
    }
    if (landings !== undefined && !Array.isArray(landings)) {
        errors.push(`${label}stairLandings must be an array.`);
    }
    if (Array.isArray(stairs)) {
        for (const stair of stairs) {
            if (
                !isRecord(stair)
                || typeof stair.id !== "string"
                || typeof stair.floorId !== "string"
                || typeof stair.destinationFloorId !== "string"
                || typeof stair.stairConnectionId !== "string"
                || !isRecord(stair.position)
                || !hasVector(stair.position)
                || typeof stair.rotationY !== "number"
                || !Number.isFinite(stair.rotationY)
                || typeof stair.width !== "number"
                || typeof stair.totalRise !== "number"
                || typeof stair.riserCount !== "number"
                || typeof stair.treadDepth !== "number"
                || !["straight", "l-shaped", "u-shaped"].includes(String(stair.shape))
            ) {
                errors.push(`${label}each staircase requires finite placement data, dimensions, a floor connection, and a supported shape.`);
            } else if (validateStaircaseDimensions({
                width: stair.width,
                totalRise: stair.totalRise,
                riserCount: stair.riserCount,
                treadDepth: stair.treadDepth,
                shape: stair.shape as "straight" | "l-shaped" | "u-shaped",
                turnDirection: stair.turnDirection === "left" || stair.turnDirection === "right"
                    ? stair.turnDirection
                    : undefined,
                treadThickness: typeof stair.treadThickness === "number"
                    ? stair.treadThickness
                    : undefined
            })) {
                errors.push(`${label}staircase ${stair.id} has invalid dimensions.`);
            } else if (
                stair.turnDirection !== undefined &&
                stair.turnDirection !== "left" &&
                stair.turnDirection !== "right"
            ) {
                errors.push(`${label}staircase ${stair.id} has an invalid turn direction.`);
            } else if (
                stair.railings !== undefined &&
                typeof stair.railings !== "boolean"
            ) {
                errors.push(`${label}staircase ${stair.id} railings must be a boolean.`);
            } else if (
                stair.flights !== undefined &&
                (!Array.isArray(stair.flights) ||
                    stair.flights.length !== (stair.shape === "straight" ? 1 : 2) ||
                    stair.flights.some(flight =>
                        !isRecord(flight) ||
                        typeof flight.id !== "string" ||
                        !isRecord(flight.start) ||
                        !hasVector(flight.start) ||
                        !isRecord(flight.direction) ||
                        typeof flight.direction.x !== "number" ||
                        !Number.isFinite(flight.direction.x) ||
                        typeof flight.direction.z !== "number" ||
                        !Number.isFinite(flight.direction.z) ||
                        ![
                            flight.width,
                            flight.run,
                            flight.riserCount,
                            flight.totalRise,
                            flight.riserHeight,
                            flight.treadDepth
                        ].every(item => typeof item === "number" && Number.isFinite(item)) ||
                        (flight.width as number) <= 0 ||
                        (flight.run as number) <= 0 ||
                        !Number.isInteger(flight.riserCount) ||
                        (flight.riserCount as number) < 2 ||
                        (flight.totalRise as number) <= 0 ||
                        (flight.riserHeight as number) <= 0 ||
                        (flight.treadDepth as number) <= 0
                    ))
            ) {
                errors.push(`${label}staircase ${stair.id} has invalid flight parameters.`);
            }
        }
    }
    if (Array.isArray(landings)) {
        for (const landing of landings) {
            if (
                !isRecord(landing)
                || typeof landing.id !== "string"
                || typeof landing.stairId !== "string"
                || typeof landing.stairConnectionId !== "string"
                || typeof landing.floorId !== "string"
                || !isRecord(landing.position)
                || !hasVector(landing.position)
                || typeof landing.rotationY !== "number"
                || !Number.isFinite(landing.rotationY)
                || typeof landing.width !== "number"
                || !Number.isFinite(landing.width)
                || typeof landing.run !== "number"
                || !Number.isFinite(landing.run)
                || landing.width <= 0
                || landing.run <= 0
            ) {
                errors.push(`${label}each stair landing requires finite placement data and a staircase connection.`);
            }
        }
    }
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
        validateStairArrays(value, errors, "");

        if (
            value.workflowType === "admin-managed"
            && value.blueprint != null
        ) {
            errors.push("Managed project JSON must not persist blueprint runtime data.");
        }
    }

    if (value.floors !== undefined) {
        if (!Array.isArray(value.floors) || value.floors.length === 0) {
            errors.push("floors must be a non-empty array.");
        } else {
            const floorIds = new Set<string>();
            const structuralObjectIds = new Set<string>();
            const stairConnectionIds = new Set<string>();
            const staircaseRecords: Array<{ stair: Record<string, unknown>; floorId: string }> = [];
            const landingRecords: Array<{ landing: Record<string, unknown>; floorId: string }> = [];
            for (const [index, floorValue] of value.floors.entries()) {
                if (
                    !isRecord(floorValue)
                    || typeof (floorValue.floorId ?? floorValue.id) !== "string"
                    || !String(floorValue.floorId ?? floorValue.id).trim()
                    || typeof floorValue.name !== "string"
                    || !floorValue.name.trim()
                    || !isRecord(floorValue.structure)
                ) {
                    errors.push(`Floor ${index + 1} requires an id, name, and structural data.`);
                    continue;
                }

                const floorId = String(floorValue.floorId ?? floorValue.id);
                if (floorIds.has(floorId)) {
                    errors.push(`Floor ID ${floorId} must be unique.`);
                }
                floorIds.add(floorId);

                const floorStructure = floorValue.structure;
                validateStairArrays(floorStructure, errors, `Floor ${index + 1} `);
                for (const field of ["corners", "walls", "doors", "windows", "openings"] as const) {
                    if (!Array.isArray(floorStructure[field])) {
                        errors.push(`Floor ${index + 1} ${field} must be an array.`);
                    }
                }
                if (["corners", "walls", "doors", "windows", "openings"].some(
                    field => !Array.isArray(floorStructure[field])
                )) {
                    continue;
                }

                const floorErrors = validateStructuralProjectData({
                    ...value,
                    ...floorStructure,
                    floors: undefined,
                    activeFloorId: undefined
                });
                errors.push(...floorErrors.map(error => `Floor ${index + 1}: ${error}`));
                for (const field of ["corners", "walls", "doors", "windows", "openings"] as const) {
                    for (const item of floorStructure[field] as Record<string, unknown>[]) {
                        if (typeof item.id !== "string") continue;
                        if (structuralObjectIds.has(item.id)) {
                            errors.push(`Structural object ID ${item.id} must be unique across floors.`);
                        }
                        structuralObjectIds.add(item.id);
                    }
                }
                for (const field of ["stairs", "stairLandings"] as const) {
                    if (!Array.isArray(floorStructure[field])) continue;
                    for (const item of floorStructure[field] as Record<string, unknown>[]) {
                        if (typeof item.id === "string") {
                            if (structuralObjectIds.has(item.id)) {
                                errors.push(`Structural object ID ${item.id} must be unique across floors.`);
                            }
                            structuralObjectIds.add(item.id);
                        }
                        if (field === "stairs") staircaseRecords.push({ stair: item, floorId });
                        else landingRecords.push({ landing: item, floorId });
                    }
                }
            }

            for (const { stair, floorId } of staircaseRecords) {
                const destinationFloorId = stair.destinationFloorId;
                const connectionId = stair.stairConnectionId;
                if (typeof connectionId === "string") {
                    if (stairConnectionIds.has(connectionId)) {
                        errors.push(`Stair connection ID ${connectionId} must be unique.`);
                    }
                    stairConnectionIds.add(connectionId);
                }
                if (stair.floorId !== floorId) {
                    errors.push(`Staircase ${String(stair.id)} floorId must match its containing floor.`);
                }
                if (
                    typeof destinationFloorId !== "string"
                    || destinationFloorId === floorId
                    || !floorIds.has(destinationFloorId)
                ) {
                    errors.push(`Staircase ${String(stair.id)} must connect to a different existing floor.`);
                }
                const matches = landingRecords.filter(({ landing }) =>
                    landing.stairConnectionId === connectionId &&
                    landing.stairId === stair.id &&
                    landing.floorId === destinationFloorId
                );
                if (matches.length !== 1) {
                    errors.push(`Staircase ${String(stair.id)} must have exactly one matching destination landing.`);
                }
            }
            for (const { landing, floorId } of landingRecords) {
                if (landing.floorId !== floorId) {
                    errors.push(`Stair landing ${String(landing.id)} floorId must match its containing floor.`);
                }
                if (!staircaseRecords.some(({ stair }) =>
                    stair.id === landing.stairId &&
                    stair.stairConnectionId === landing.stairConnectionId &&
                    stair.destinationFloorId === floorId
                )) {
                    errors.push(`Stair landing ${String(landing.id)} must match a staircase on another floor.`);
                }
            }

            if (
                typeof value.activeFloorId !== "string"
                || !value.floors.some(floor =>
                    isRecord(floor)
                    && (floor.floorId ?? floor.id) === value.activeFloorId
                )
            ) {
                errors.push("activeFloorId must reference a floor in floors.");
            }
        }
    } else if (value.activeFloorId !== undefined) {
        errors.push("activeFloorId requires floor data.");
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
