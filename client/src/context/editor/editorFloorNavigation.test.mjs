import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (
            specifier.startsWith(".") &&
            !/\.[^/]+$/.test(specifier)
        ) {
            return nextResolve(`${specifier}.ts`, context);
        }
        return nextResolve(specifier, context);
    }
});

const { editorReducer } = await import("./editorReducer.ts");
const { initialState } = await import("./initialState.ts");

function makeFloor(floorId, wallId, wallHeight) {
    return {
        floorId,
        name: floorId,
        walls: [{ id: wallId }],
        corners: [],
        doors: [],
        furniture: [],
        windows: [],
        openings: [],
        stairs: [],
        stairLandings: [],
        floorFinishes: {},
        wallFinishes: {},
        wallPaintSeparators: {},
        floorPaintSeparators: {},
        wallHeight,
        wallThickness: 0.15,
        snapEnabled: true,
        gridSize: 0.25,
        layoutConfirmed: false,
        archRise: 0.5,
        openingWidth: 1,
        openingHeight: 2,
        blueprint: null
    };
}

function makeState(projectLocked) {
    const firstFloor = makeFloor("floor-1", "saved-wall-1", 3);
    const secondFloor = makeFloor("floor-2", "saved-wall-2", 4);
    return {
        ...initialState,
        projectLocked,
        activeFloorId: firstFloor.floorId,
        floors: [firstFloor, secondFloor],
        walls: [{ id: "current-wall-1" }],
        corners: [],
        doors: [],
        furniture: [],
        windows: [],
        openings: [],
        stairs: [],
        stairLandings: [],
        floorFinishes: {},
        wallFinishes: {},
        wallPaintSeparators: {},
        floorPaintSeparators: {},
        wallHeight: 3
    };
}

test("locked projects can switch floors without capturing or changing floor data", () => {
    const state = makeState(true);
    const originalFloors = structuredClone(state.floors);

    const secondFloor = editorReducer(state, {
        type: "SWITCH_FLOOR",
        payload: "floor-2"
    });

    assert.equal(secondFloor.activeFloorId, "floor-2");
    assert.deepEqual(secondFloor.walls, [{ id: "saved-wall-2" }]);
    assert.equal(secondFloor.wallHeight, 4);
    assert.equal(secondFloor.projectLocked, true);
    assert.deepEqual(secondFloor.floors, originalFloors);

    const attemptedEdit = editorReducer(secondFloor, {
        type: "SET_WALL_HEIGHT",
        payload: 9
    });
    assert.equal(attemptedEdit, secondFloor);

    const firstFloor = editorReducer(secondFloor, {
        type: "SWITCH_FLOOR",
        payload: "floor-1"
    });
    assert.deepEqual(firstFloor.walls, [{ id: "saved-wall-1" }]);
    assert.deepEqual(firstFloor.floors, originalFloors);
});

test("unlocked floor switching preserves active floor edits in its floor data", () => {
    const state = makeState(false);

    const secondFloor = editorReducer(state, {
        type: "SWITCH_FLOOR",
        payload: "floor-2"
    });

    assert.equal(secondFloor.activeFloorId, "floor-2");
    assert.deepEqual(secondFloor.walls, [{ id: "saved-wall-2" }]);
    assert.deepEqual(secondFloor.floors[0].walls, [{ id: "current-wall-1" }]);
});
