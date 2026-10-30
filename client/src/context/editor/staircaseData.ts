import type { SavedProjectData } from "./ProjectTypes";
import type { SavedStaircase, SavedStaircaseLanding } from "./ProjectTypes";
import { validateStaircaseDimensions } from "../../../../shared/staircaseGeometry.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedStaircase(value: unknown): value is SavedStaircase {
    if (!isRecord(value) || !isRecord(value.position)) return false;
    const shape = value.shape ?? "straight";
    if (
        typeof value.id !== "string" ||
        typeof value.floorId !== "string" ||
        typeof value.destinationFloorId !== "string" ||
        typeof value.stairConnectionId !== "string" ||
        !["straight", "l-shaped", "u-shaped"].includes(String(shape)) ||
        ![value.position.x, value.position.y, value.position.z, value.rotationY]
            .every(item => typeof item === "number" && Number.isFinite(item)) ||
        (value.railings !== undefined && typeof value.railings !== "boolean") ||
        (value.turnDirection !== undefined &&
            value.turnDirection !== "left" &&
            value.turnDirection !== "right")
    ) return false;

    return validateStaircaseDimensions({
        width: value.width as number,
        totalRise: value.totalRise as number,
        riserCount: value.riserCount as number,
        treadDepth: value.treadDepth as number,
        treadThickness: typeof value.treadThickness === "number"
            ? value.treadThickness
            : undefined,
        shape: shape as SavedStaircase["shape"],
        turnDirection: value.turnDirection as SavedStaircase["turnDirection"]
    }) === null;
}

function isSavedStaircaseLanding(value: unknown): value is SavedStaircaseLanding {
    return isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.stairId === "string" &&
        typeof value.stairConnectionId === "string" &&
        typeof value.floorId === "string" &&
        isRecord(value.position) &&
        [value.position.x, value.position.y, value.position.z, value.rotationY, value.width, value.run]
            .every(item => typeof item === "number" && Number.isFinite(item)) &&
        (value.width as number) > 0 &&
        (value.run as number) > 0;
}

export function getStaircaseFloorData(
    floorStructure: Partial<SavedProjectData>,
    project: Pick<SavedProjectData, "stairs" | "stairLandings">,
    floorIndex: number
): Pick<SavedProjectData, "stairs" | "stairLandings"> {
    const rawStairs = floorStructure.stairs ?? (floorIndex === 0 ? project.stairs : []);
    const rawLandings = floorStructure.stairLandings ??
        (floorIndex === 0 ? project.stairLandings : []);
    return {
        stairs: Array.isArray(rawStairs)
            ? rawStairs.filter(isSavedStaircase).map(stair => ({
                ...stair,
                shape: stair.shape ?? "straight"
            }))
            : [],
        stairLandings: Array.isArray(rawLandings)
            ? rawLandings.filter(isSavedStaircaseLanding)
            : []
    };
}
