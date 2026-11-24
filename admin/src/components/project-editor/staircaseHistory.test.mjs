import assert from "node:assert/strict";
import test from "node:test";
import {
    canRedoStructureHistory,
    canUndoStructureHistory,
    createGroupedStructureHistoryEntry,
    createStructureHistoryEntry,
    redoStructureHistory,
    undoStructureHistory
} from "./staircaseHistory.ts";

const FLOOR_ID = "floor-1";

function createState(structure = { walls: [] }) {
    return {
        floors: [{ floorId: FLOOR_ID, name: "1st Floor", structure }],
        historyByFloor: { [FLOOR_ID]: [] },
        futureByFloor: { [FLOOR_ID]: [] }
    };
}

function commit(state, nextStructure) {
    const currentStructure = state.floors[0].structure;
    return {
        ...state,
        floors: [{ ...state.floors[0], structure: nextStructure }],
        historyByFloor: {
            ...state.historyByFloor,
            [FLOOR_ID]: [
                ...state.historyByFloor[FLOOR_ID].slice(-49),
                createStructureHistoryEntry(FLOOR_ID, currentStructure, nextStructure)
            ]
        },
        futureByFloor: { ...state.futureByFloor, [FLOOR_ID]: [] }
    };
}

function addWall(state, id) {
    const structure = state.floors[0].structure;
    return commit(state, {
        ...structure,
        walls: [...structure.walls, { id }]
    });
}

function applyHistory(state, operation) {
    const result = operation(
        state.floors,
        state.historyByFloor,
        state.futureByFloor,
        FLOOR_ID
    );
    assert.ok(result);
    assert.equal(result.error, undefined);
    return {
        floors: result.floors,
        historyByFloor: result.historyByFloor,
        futureByFloor: result.futureByFloor
    };
}

function wallIds(state) {
    return state.floors[0].structure.walls.map(wall => wall.id);
}

test("wall add: undo then redo restores the wall with the same ID", () => {
    const wall = { id: "wall-A", start: { x: 0, z: 0 }, end: { x: 1, z: 0 } };
    let state = createState();
    state = commit(state, { walls: [wall] });
    state = applyHistory(state, undoStructureHistory);
    assert.deepEqual(wallIds(state), []);
    state = applyHistory(state, redoStructureHistory);
    assert.deepEqual(state.floors[0].structure.walls, [wall]);
    assert.equal(state.floors[0].structure.walls[0].id, "wall-A");
});

test("wall delete: undo restores it and redo removes it again", () => {
    const wall = { id: "wall-A" };
    let state = createState({ walls: [wall] });
    state = commit(state, { walls: [] });
    state = applyHistory(state, undoStructureHistory);
    assert.deepEqual(state.floors[0].structure.walls, [wall]);
    state = applyHistory(state, redoStructureHistory);
    assert.deepEqual(state.floors[0].structure.walls, []);
});

test("drawing three walls, undoing all, and redoing all restores them", () => {
    let state = createState();
    state = addWall(state, "wall-A");
    state = addWall(state, "wall-B");
    state = addWall(state, "wall-C");
    for (let index = 0; index < 3; index += 1) {
        state = applyHistory(state, undoStructureHistory);
    }
    assert.deepEqual(wallIds(state), []);
    for (let index = 0; index < 3; index += 1) {
        state = applyHistory(state, redoStructureHistory);
    }
    assert.deepEqual(wallIds(state), ["wall-A", "wall-B", "wall-C"]);
});

test("partial undo and redo sequences restore the correct wall state", () => {
    let state = addWall(addWall(createState(), "wall-A"), "wall-B");
    state = applyHistory(state, undoStructureHistory);
    state = applyHistory(state, redoStructureHistory);
    state = applyHistory(state, undoStructureHistory);
    state = applyHistory(state, undoStructureHistory);
    state = applyHistory(state, redoStructureHistory);
    state = applyHistory(state, redoStructureHistory);

    assert.deepEqual(wallIds(state), ["wall-A", "wall-B"]);
});

test("a new edit after undo clears redo and creates a new branch", () => {
    let state = addWall(addWall(createState(), "wall-A"), "wall-B");
    state = applyHistory(state, undoStructureHistory);
    state = addWall(state, "wall-C");

    assert.deepEqual(wallIds(state), ["wall-A", "wall-C"]);
    assert.equal(canRedoStructureHistory(state.futureByFloor, FLOOR_ID), false);
    assert.equal(
        redoStructureHistory(
            state.floors,
            state.historyByFloor,
            state.futureByFloor,
            FLOOR_ID
        ),
        null
    );
});

test("the per-floor history cap retains the latest 50 edits", () => {
    let state = createState();
    for (let index = 0; index < 55; index += 1) {
        state = addWall(state, `wall-${index + 1}`);
    }
    assert.equal(state.historyByFloor[FLOOR_ID].length, 50);

    for (let index = 0; index < 50; index += 1) {
        state = applyHistory(state, undoStructureHistory);
    }
    assert.deepEqual(wallIds(state), [
        "wall-1",
        "wall-2",
        "wall-3",
        "wall-4",
        "wall-5"
    ]);
    for (let index = 0; index < 50; index += 1) {
        state = applyHistory(state, redoStructureHistory);
    }
    assert.equal(wallIds(state).length, 55);
    assert.deepEqual(wallIds(state).at(-1), "wall-55");
});

test("ordinary room, door, window, and wall-height edits redo correctly", () => {
    const cases = [
        ["rooms", [{ id: "room-A" }]],
        ["doors", [{ id: "door-A" }]],
        ["windows", [{ id: "window-A" }]],
        ["wallHeight", 3.2]
    ];

    for (const [field, value] of cases) {
        const before = { walls: [], rooms: [], doors: [], windows: [], wallHeight: 2.4 };
        const after = { ...before, [field]: value };
        let state = commit(createState(before), after);
        state = applyHistory(state, undoStructureHistory);
        assert.deepEqual(state.floors[0].structure, before, `${field} undo`);
        state = applyHistory(state, redoStructureHistory);
        assert.deepEqual(state.floors[0].structure, after, `${field} redo`);
    }
});

test("grouped staircase history still undoes and redoes both connected floors", () => {
    const beforeFloors = [
        { floorId: "floor-1", name: "1st Floor", structure: { stairs: [] } },
        { floorId: "floor-2", name: "2nd Floor", structure: { stairLandings: [] } }
    ];
    const afterFloors = [
        { ...beforeFloors[0], structure: { stairs: [{ id: "stair-A" }] } },
        { ...beforeFloors[1], structure: { stairLandings: [{ id: "landing-A" }] } }
    ];
    const entry = createGroupedStructureHistoryEntry(
        beforeFloors,
        afterFloors,
        ["floor-1", "floor-2"],
        "stair-transaction"
    );
    const historyByFloor = {
        "floor-1": [entry],
        "floor-2": [entry]
    };

    const undone = undoStructureHistory(afterFloors, historyByFloor, {}, "floor-1");
    assert.ok(undone);
    assert.deepEqual(undone.floors, beforeFloors);
    assert.equal(canRedoStructureHistory(undone.futureByFloor, "floor-1"), true);

    const redone = redoStructureHistory(
        undone.floors,
        undone.historyByFloor,
        undone.futureByFloor,
        "floor-1"
    );
    assert.ok(redone);
    assert.deepEqual(redone.floors, afterFloors);
    assert.equal(beforeFloors[0].structure.stairs.length, 0);
    assert.equal(afterFloors[0].structure.stairs[0].id, "stair-A");
});

test("grouped staircase undo is unavailable until both floor histories align", () => {
    const beforeFloors = [
        { floorId: "floor-1", name: "1st Floor", structure: {} },
        { floorId: "floor-2", name: "2nd Floor", structure: {} }
    ];
    const afterFloors = beforeFloors.map(floor => ({
        ...floor,
        structure: { stairId: "stair-A" }
    }));
    const entry = createGroupedStructureHistoryEntry(
        beforeFloors,
        afterFloors,
        ["floor-1", "floor-2"],
        "stair-transaction"
    );
    const ordinaryEntry = createStructureHistoryEntry(
        "floor-1",
        afterFloors[0].structure,
        { stairId: "stair-A", wallId: "wall-A" }
    );
    const historyByFloor = {
        "floor-1": [entry, ordinaryEntry],
        "floor-2": [entry]
    };

    assert.equal(canUndoStructureHistory(historyByFloor, "floor-2"), false);
});
