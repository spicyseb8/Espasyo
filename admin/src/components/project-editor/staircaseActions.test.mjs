import assert from "node:assert/strict";
import test from "node:test";
import { createManagedStructure, serializeManagedStructureProject, loadManagedEditorFloors } from "./structureTypes.ts";
import {
    applyStaircasePlacement,
    createStaircaseFootprintPreview,
    moveStaircaseLanding,
    removeStaircase,
    resolveStaircaseDestinationFloorId,
    validateStaircasePlacement,
    validateStaircaseFootprint
} from "./staircaseActions.ts";
import {
    createGroupedStructureHistoryEntry,
    redoStructureHistory,
    undoStructureHistory
} from "./staircaseHistory.ts";
import { validateStructuralProjectData } from "../../services/assets/projectStructureContract.ts";

const dimensions = {
    width: 1,
    totalRise: 3,
    riserCount: 12,
    treadDepth: 0.28
};
const candidate = {
    position: { x: 2, y: 0, z: 2 },
    rotationY: 0
};

function floors(overrides = {}) {
    const first = createManagedStructure("project", "Plan", "owner");
    const second = createManagedStructure("project", "Plan", "owner");
    return [
        {
            floorId: "floor-1",
            name: "1st Floor",
            structure: { ...first, stairs: [], stairLandings: [], ...overrides.first }
        },
        {
            floorId: "floor-2",
            name: "2nd Floor",
            structure: { ...second, stairs: [], stairLandings: [], ...overrides.second }
        }
    ];
}

function addStair(current = floors(), id = "stair-1", landingId = "landing-1", connectionId = "connection-1") {
    return applyStaircasePlacement(
        current,
        "floor-1",
        "floor-2",
        candidate,
        dimensions,
        "place",
        null,
        id,
        landingId,
        connectionId
    );
}

test("placement creates one source staircase and one linked destination marker immutably", () => {
    const original = floors();
    const placed = addStair(original);

    assert.ok(placed);
    assert.equal(original[0].structure.stairs.length, 0);
    assert.equal(original[1].structure.stairLandings.length, 0);
    assert.equal(placed[0].structure.stairs.length, 1);
    assert.equal(placed[1].structure.stairLandings.length, 1);
    assert.equal(placed[0].structure.stairs[0].floorId, "floor-1");
    assert.equal(placed[0].structure.stairs[0].destinationFloorId, "floor-2");
    assert.equal(placed[1].structure.stairLandings[0].floorId, "floor-2");
    assert.equal(placed[0].structure.stairs[0].stairConnectionId, "connection-1");
    assert.equal(placed[1].structure.stairLandings[0].stairConnectionId, "connection-1");
    assert.equal(placed[0].structure.stairs[0].treadThickness, 0.04);
    assert.equal(placed[0].structure.stairs[0].railings, true);
});

test("L- and U-shaped staircase metadata survives serialization and reopening", () => {
    for (const shape of ["l-shaped", "u-shaped"]) {
        const shapedFloors = applyStaircasePlacement(
            floors(),
            "floor-1",
            "floor-2",
            candidate,
            {
                width: 2.4,
                totalRise: 3,
                riserCount: 16,
                treadDepth: 4 / 15,
                shape,
                turnDirection: shape === "l-shaped" ? "right" : undefined
            },
            "place",
            null,
            `stair-${shape}`,
            `landing-${shape}`,
            `connection-${shape}`
        );
        assert.ok(shapedFloors);
        const serialized = serializeManagedStructureProject(
            shapedFloors,
            "floor-1",
            "Plan",
            "2026-10-29T00:00:00.000Z"
        );
        assert.deepEqual(validateStructuralProjectData(serialized), []);
        const reopened = loadManagedEditorFloors(serialized);
        const stair = reopened.floors[0].structure.stairs[0];
        assert.equal(stair.shape, shape);
        assert.equal(stair.turnDirection, shape === "l-shaped" ? "right" : undefined);
        assert.equal(
            reopened.floors[1].structure.stairLandings[0].stairConnectionId,
            stair.stairConnectionId
        );
    }
});

test("rectangle placement uses the longer edge as the run in either world direction", () => {
    const alongX = createStaircaseFootprintPreview(
        { x: 2, z: 3 },
        { x: 6, z: 4 }
    );
    assert.equal(alongX.length, 4);
    assert.equal(alongX.width, 1);
    assert.deepEqual(alongX.candidate.position, { x: 2, y: 0, z: 3.5 });
    assert.equal(alongX.candidate.rotationY, 0);

    const alongNegativeX = createStaircaseFootprintPreview(
        { x: 6, z: 4 },
        { x: 2, z: 3 }
    );
    assert.deepEqual(alongNegativeX.candidate.position, { x: 6, y: 0, z: 3.5 });
    assert.equal(alongNegativeX.candidate.rotationY, Math.PI);

    const alongPositiveZ = createStaircaseFootprintPreview(
        { x: 1, z: 1 },
        { x: 2, z: 5 }
    );
    assert.equal(alongPositiveZ.length, 4);
    assert.equal(alongPositiveZ.width, 1);
    assert.deepEqual(alongPositiveZ.candidate.position, { x: 1.5, y: 0, z: 1 });
    assert.equal(alongPositiveZ.candidate.rotationY, -Math.PI / 2);
});

test("invalid floor connections, candidate positions, and colliding IDs are rejected without mutation", () => {
    const original = floors();
    assert.equal(applyStaircasePlacement(
        original, "floor-1", "floor-1", candidate, dimensions, "place", null,
        "a", "b", "c"
    ), null);
    assert.equal(applyStaircasePlacement(
        original, "floor-1", "missing-floor", candidate, dimensions, "place", null,
        "a", "b", "c"
    ), null);
    assert.equal(applyStaircasePlacement(
        original, "floor-1", "floor-2", { ...candidate, position: { ...candidate.position, x: Infinity } },
        dimensions, "place", null, "a", "b", "c"
    ), null);
    const withExistingId = floors({ first: { doors: [{ id: "taken-id" }] } });
    assert.equal(addStair(withExistingId, "taken-id"), null);
    assert.equal(original[0].structure.stairs.length, 0);
});

test("moving preserves staircase identity, dimensions, and linked landing", () => {
    const placed = addStair();
    const source = placed[0].structure.stairs[0];
    const moved = applyStaircasePlacement(
        placed,
        "floor-1",
        "floor-2",
        { position: { x: 4, y: 0, z: 3 }, rotationY: Math.PI / 2 },
        dimensions,
        "move",
        source,
        "unused",
        "unused",
        "unused"
    );

    assert.ok(moved);
    assert.equal(moved[0].structure.stairs.length, 1);
    assert.equal(moved[0].structure.stairs[0].id, source.id);
    assert.equal(moved[0].structure.stairs[0].stairConnectionId, source.stairConnectionId);
    assert.deepEqual(moved[0].structure.stairs[0].position, { x: 4, y: 0, z: 3 });
    assert.equal(moved[0].structure.stairs[0].width, source.width);
    assert.equal(moved[1].structure.stairLandings[0].id, "landing-1");
    assert.deepEqual(moved[1].structure.stairLandings[0].position, { x: 4, y: 0, z: 3 });
    assert.equal(moved[1].structure.stairLandings[0].rotationY, Math.PI / 2);
});

test("duplicates get independent object and connection IDs and removing one cleans only its marker", () => {
    const original = addStair();
    const source = original[0].structure.stairs[0];
    const duplicate = applyStaircasePlacement(
        original,
        "floor-1",
        "floor-2",
        { position: { x: 6, y: 0, z: 2 }, rotationY: 0 },
        dimensions,
        "duplicate",
        source,
        "stair-2",
        "landing-2",
        "connection-2"
    );

    assert.ok(duplicate);
    assert.equal(duplicate[0].structure.stairs.length, 2);
    assert.equal(duplicate[1].structure.stairLandings.length, 2);
    assert.notEqual(duplicate[0].structure.stairs[1].id, source.id);
    assert.notEqual(duplicate[0].structure.stairs[1].stairConnectionId, source.stairConnectionId);
    assert.notEqual(duplicate[1].structure.stairLandings[1].stairConnectionId, source.stairConnectionId);

    const removed = removeStaircase(duplicate, "floor-1", source.id);
    assert.ok(removed);
    assert.deepEqual(removed[0].structure.stairs.map(stair => stair.id), ["stair-2"]);
    assert.deepEqual(removed[1].structure.stairLandings.map(landing => landing.id), ["landing-2"]);
});

test("landing markers are independently movable in their destination floor coordinate system", () => {
    const placed = addStair();
    const landing = placed[1].structure.stairLandings[0];
    const moved = moveStaircaseLanding(placed, landing, {
        position: { x: 5, y: 0, z: -2 },
        rotationY: Math.PI / 4
    });

    assert.ok(moved);
    assert.deepEqual(moved[1].structure.stairLandings[0].position, { x: 5, y: 0, z: -2 });
    assert.equal(moved[1].structure.stairLandings[0].stairConnectionId, landing.stairConnectionId);
    assert.deepEqual(placed[1].structure.stairLandings[0].position, landing.position);
});

test("footprints reject missing rooms, boundary violations, and wall intersections", () => {
    const region = {
        corners: [
            { x: 0, z: 0 },
            { x: 5, z: 0 },
            { x: 5, z: 5 },
            { x: 0, z: 5 }
        ]
    };
    const staircase = {
        position: { x: 1, y: 0, z: 1 },
        rotationY: 0,
        ...dimensions
    };
    assert.equal(validateStaircaseFootprint(staircase, [], [region]), null);
    assert.match(validateStaircaseFootprint(staircase, [], []), /enclosed room/);
    assert.equal(validateStaircaseFootprint({
        ...staircase,
        position: { x: 1, y: 0, z: 0.5 }
    }, [], [region]), null);
    assert.match(validateStaircaseFootprint({
        ...staircase,
        position: { x: 4, y: 0, z: 1 }
    }, [], [region]), /inside one room/);
    assert.match(validateStaircaseFootprint(staircase, [{
        id: "wall",
        start: { id: "a", position: { x: 2, y: 0, z: 0 } },
        end: { id: "b", position: { x: 2, y: 0, z: 4 } }
    }], [region]), /overlaps a wall/);
    assert.equal(validateStaircaseFootprint({
        ...staircase,
        position: { x: 1, y: 0, z: 0.5 }
    }, [{
        id: "boundary-wall",
        start: { id: "c", position: { x: 0, y: 0, z: 0 } },
        end: { id: "d", position: { x: 5, y: 0, z: 0 } }
    }], [region]), null);
});

test("footprints may not cross or cover holes in a room polygon", () => {
    const region = {
        corners: [
            { x: 0, z: 0 },
            { x: 8, z: 0 },
            { x: 8, z: 8 },
            { x: 0, z: 8 }
        ],
        boundaryLoops: [
            {
                corners: [
                    { x: 0, z: 0 },
                    { x: 8, z: 0 },
                    { x: 8, z: 8 },
                    { x: 0, z: 8 }
                ]
            },
            {
                corners: [
                    { x: 2, z: 2 },
                    { x: 4, z: 2 },
                    { x: 4, z: 4 },
                    { x: 2, z: 4 }
                ]
            }
        ]
    };
    assert.match(validateStaircaseFootprint({
        ...dimensions,
        position: { x: 1, y: 0, z: 3 },
        rotationY: 0
    }, [], [region]), /inside one room/);
});

test("shared placement validation rejects missing destinations and invalidates either floor footprint", () => {
    const currentFloors = floors();
    const sourceFloor = currentFloors[0];
    const destinationFloor = currentFloors[1];
    const room = {
        id: "room",
        corners: [
            { x: 0, z: 0 },
            { x: 5, z: 0 },
            { x: 5, z: 5 },
            { x: 0, z: 5 }
        ]
    };
    const input = {
        candidate: {
            position: { x: 1, y: 0, z: 2 },
            rotationY: 0
        },
        dimensions,
        activeFloorId: "floor-1",
        destinationFloorId: "floor-2",
        floors: currentFloors,
        sourceStructure: sourceFloor.structure,
        sourceRegions: [room],
        destinationFloor,
        destinationRegions: [room],
        pointerValid: true,
        regionId: "room"
    };

    assert.equal(validateStaircasePlacement(input), null);
    assert.match(validateStaircasePlacement({
        ...input,
        destinationFloor: undefined
    }), /Create the 2nd Floor/);
    assert.match(validateStaircasePlacement({
        ...input,
        destinationFloorId: "floor-1"
    }), /immediately following floor/);
    const thirdFloor = {
        floorId: "floor-3",
        name: "3rd Floor",
        structure: createManagedStructure("project", "Plan", "owner")
    };
    assert.match(validateStaircasePlacement({
        ...input,
        floors: [...currentFloors, thirdFloor],
        destinationFloorId: "floor-3",
        destinationFloor: thirdFloor
    }), /immediately following floor/);
    assert.match(validateStaircasePlacement({
        ...input,
        candidate: { ...input.candidate, position: { x: 4, y: 0, z: 2 } }
    }), /inside one room/);
    assert.match(validateStaircasePlacement({
        ...input,
        destinationRegions: []
    }), /enclosed room/);
    assert.match(validateStaircasePlacement({
        ...input,
        pointerValid: false
    }), /actual room floor/);
    assert.match(validateStaircasePlacement({
        ...input,
        regionId: "missing-room"
    }), /room is no longer available/);
});

test("destination is always the immediately following floor in level order", () => {
    const currentFloors = floors();
    assert.equal(
        resolveStaircaseDestinationFloorId(currentFloors, "floor-1"),
        "floor-2"
    );
    assert.equal(
        resolveStaircaseDestinationFloorId(currentFloors, "floor-2"),
        ""
    );
    assert.equal(
        resolveStaircaseDestinationFloorId([currentFloors[0]], "floor-1"),
        ""
    );
    const third = {
        floorId: "floor-3",
        name: "3rd Floor",
        structure: createManagedStructure("project", "Plan", "owner")
    };
    assert.equal(
        resolveStaircaseDestinationFloorId([...currentFloors, third], "floor-2"),
        "floor-3"
    );
});

test("grouped staircase history undoes and redoes both connected floors together", () => {
    const before = floors();
    const after = addStair(before);
    const entry = createGroupedStructureHistoryEntry(
        before,
        after,
        ["floor-1", "floor-2"],
        "stair-transaction"
    );
    const history = {
        "floor-1": [entry],
        "floor-2": [entry]
    };
    const undone = undoStructureHistory(after, history, {}, "floor-1");
    assert.ok(undone);
    assert.equal(undone.floors[0].structure.stairs.length, 0);
    assert.equal(undone.floors[1].structure.stairLandings.length, 0);

    const redone = redoStructureHistory(
        undone.floors,
        undone.historyByFloor,
        undone.futureByFloor,
        "floor-2"
    );
    assert.ok(redone);
    assert.equal(redone.floors[0].structure.stairs.length, 1);
    assert.equal(redone.floors[1].structure.stairLandings.length, 1);
});

test("stairs and markers survive structural save/reopen and validate their cross-floor link", () => {
    const placed = addStair();
    const savedFloors = placed.map((floor, index) => index === 0
        ? {
            ...floor,
            structure: {
                ...floor.structure,
                stairs: floor.structure.stairs.map(stair => ({ ...stair, totalRise: 2.8 }))
            }
        }
        : floor);
    const serialized = {
        ...serializeManagedStructureProject(savedFloors, "floor-1", "Plan", "2026-10-30T00:00:00.000Z"),
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralRevision: 3,
        publishedStructuralRevision: 3,
        structuralStatus: "published"
    };
    assert.deepEqual(validateStructuralProjectData(serialized), []);
    const reopened = loadManagedEditorFloors(serialized);
    assert.equal(reopened.floors[0].structure.stairs[0].totalRise, reopened.floors[0].structure.wallHeight);
    assert.equal(reopened.floors[0].structure.stairs[0].totalRise, 3);
    assert.equal(reopened.floors[0].structure.stairs[0].railings, true);
    assert.equal(reopened.floors[0].structure.stairs[0].treadThickness, 0.04);
    assert.deepEqual(reopened.floors[1].structure.stairLandings, placed[1].structure.stairLandings);

    const broken = structuredClone(serialized);
    broken.floors[1].structure.stairLandings = [];
    assert.ok(validateStructuralProjectData(broken).some(error => error.includes("exactly one matching destination landing")));
});
