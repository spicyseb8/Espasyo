import {
    Vector3
} from "three";

import type {
    EditorState
} from "./types";

//==================================================
// HISTORY LIMIT
//==================================================

export const MAX_HISTORY_ENTRIES =
    100;

//==================================================
// FLOOR PLAN SNAPSHOT
//==================================================
//
// Floor Plan history contains only the structure
// used to create the room/layout.
//
// Floors/regions are NOT stored because they are
// generated from walls/corners.
//==================================================

export type FloorPlanSnapshot = Pick<
    EditorState,
    | "walls"
    | "corners"
    | "wallHeight"
    | "wallThickness"
>;

//==================================================
// GLOBAL EDITOR SNAPSHOT
//==================================================
//
// Used AFTER Confirm Layout.
//
// Contains non-structural editing:
// furniture, doors, windows, openings,
// floor materials, wall materials.
//==================================================

export type EditorSnapshot = Pick<
    EditorState,
    | "furniture"
    | "doors"
    | "windows"
    | "openings"
    | "floorFinishes"
    | "wallFinishes"
>;

//==================================================
// CLONE VALUE
//==================================================
//
// Vector3 needs special handling because JSON cloning
// would destroy its Three.js methods.
//
// Everything else used by our snapshots is plain data.
//==================================================

function cloneValue<T>(
    value: T
): T {

    if (
        value instanceof Vector3
    ) {

        return value.clone() as T;
    }

    if (
        Array.isArray(value)
    ) {

        return value.map(
            item =>
                cloneValue(item)
        ) as T;
    }

    if (
        value !== null &&
        typeof value === "object"
    ) {

        const result:
            Record<string, unknown> = {};

        for (
            const [
                key,
                item
            ] of Object.entries(
                value as Record<string, unknown>
            )
        ) {

            result[key] =
                cloneValue(item);
        }

        return result as T;
    }

    return value;
}

//==================================================
// FLOOR PLAN SNAPSHOT
//==================================================

export function createFloorPlanSnapshot(
    state: EditorState
): FloorPlanSnapshot {

    return {

        walls:
            cloneValue(
                state.walls
            ),

        corners:
            cloneValue(
                state.corners
            ),

        wallHeight:
            state.wallHeight,

        wallThickness:
            state.wallThickness
    };
}

//==================================================
// GLOBAL SNAPSHOT
//==================================================

export function createEditorSnapshot(
    state: EditorState
): EditorSnapshot {

    return {

        furniture:
            cloneValue(
                state.furniture
            ),

        doors:
            cloneValue(
                state.doors
            ),

        windows:
            cloneValue(
                state.windows
            ),

        openings:
            cloneValue(
                state.openings
            ),

        floorFinishes:
            cloneValue(
                state.floorFinishes
            ),

        wallFinishes:
            cloneValue(
                state.wallFinishes
            )
    };
}

//==================================================
// RESTORE FLOOR PLAN
//==================================================

export function restoreFloorPlanSnapshot(
    current: EditorState,
    snapshot: FloorPlanSnapshot
): EditorState {

    return {

        ...current,

        walls:
            cloneValue(
                snapshot.walls
            ),

        corners:
            cloneValue(
                snapshot.corners
            ),

        wallHeight:
            snapshot.wallHeight,

        wallThickness:
            snapshot.wallThickness,

        //--------------------------------------------------
        // Clear structural selections because the
        // selected wall/corner/region might no longer
        // exist after undo/redo.
        //--------------------------------------------------

        selectedWallId:
            null,

        selectedCornerId:
            null,

        selectedRegionId:
            null,

        selectedOpeningId:
            null
    };
}

//==================================================
// RESTORE GLOBAL EDITOR
//==================================================

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
            )
    };
}

//==================================================
// TRIM HISTORY
//==================================================

export function trimHistory<T>(
    history: T[]
): T[] {

    if (
        history.length <=
        MAX_HISTORY_ENTRIES
    ) {

        return history;
    }

    return history.slice(
        history.length -
        MAX_HISTORY_ENTRIES
    );
}