import {
    Vector3
} from "three";

import type {
    EditorState
} from "./types";

export const MAX_HISTORY_ENTRIES =
    100;

export type FloorPlanSnapshot = Pick<
    EditorState,
    | "walls"
    | "corners"
    | "wallHeight"
    | "wallThickness"
>;

export type EditorSnapshot = Pick<
    EditorState,
    | "furniture"
    | "doors"
    | "windows"
    | "openings"
    | "floorFinishes"
    | "wallFinishes"
>;

function cloneValue<T>(value: T): T {
    if (value instanceof Vector3) {
        return value.clone() as T;
    }
    if (Array.isArray(value)) {
        return value.map(item => cloneValue(item)) as T;
    }
    if (value !== null && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            result[key] = cloneValue(item);
        }
        return result as T;
    }
    return value;
}

export function createFloorPlanSnapshot(
    state: EditorState
): FloorPlanSnapshot {
    return {
        walls: cloneValue(state.walls),
        corners: cloneValue(state.corners),
        wallHeight: state.wallHeight,
        wallThickness: state.wallThickness
    };
}

export function createEditorSnapshot(
    state: EditorState
): EditorSnapshot {
    return {
        furniture: cloneValue(state.furniture),
        doors: cloneValue(state.doors),
        windows: cloneValue(state.windows),
        openings: cloneValue(state.openings),
        floorFinishes: cloneValue(state.floorFinishes),
        wallFinishes: cloneValue(state.wallFinishes)
    };
}

export function restoreFloorPlanSnapshot(
    current: EditorState,
    snapshot: FloorPlanSnapshot
): EditorState {
    return {
        ...current,
        walls: cloneValue(snapshot.walls),
        corners: cloneValue(snapshot.corners),
        wallHeight: snapshot.wallHeight,
        wallThickness: snapshot.wallThickness,
        selectedWallId: null,
        selectedCornerId: null,
        selectedRegionId: null,
        selectedOpeningId: null,
        selectedFurnitureId: null,
        selectedDoorId: null,
        selectedWindowId: null
    };
}

export function restoreEditorSnapshot(
    current: EditorState,
    snapshot: EditorSnapshot
): EditorState {

    return {

        ...current,

        furniture:
            cloneValue(
                snapshot.furniture
            ),

        doors:
            cloneValue(
                snapshot.doors
            ),

        windows:
            cloneValue(
                snapshot.windows
            ),

        openings:
            cloneValue(
                snapshot.openings
            ),

        floorFinishes:
            cloneValue(
                snapshot.floorFinishes
            ),

        wallFinishes:
            cloneValue(
                snapshot.wallFinishes
            ),

        selectedFurnitureId:
            null,

        selectedDoorId:
            null,

        selectedWindowId:
            null,

        movingFurnitureId:
            null
    };
}

export function trimHistory<T>(history: T[]): T[] {
    if (history.length <= MAX_HISTORY_ENTRIES) {
        return history;
    }
    return history.slice(history.length - MAX_HISTORY_ENTRIES);
}
