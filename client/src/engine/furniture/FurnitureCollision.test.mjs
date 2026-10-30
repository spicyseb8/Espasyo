import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { checkFurnitureCollision } from "./FurnitureCollision.ts";

const noFurnitureOrWalls = {
    walls: [],
    furniture: [],
    wallThickness: 0.15,
    padding: 0.01,
    options: { height: 1 }
};

function checkAt(x, z, width, depth, stairs) {
    return checkFurnitureCollision(
        new Vector3(x, 0, z),
        width,
        depth,
        0,
        noFurnitureOrWalls.walls,
        noFurnitureOrWalls.furniture,
        noFurnitureOrWalls.wallThickness,
        noFurnitureOrWalls.padding,
        { ...noFurnitureOrWalls.options, stairs }
    );
}

function stair(shape, overrides = {}) {
    return {
        id: `stairs-${shape}`,
        floorId: "floor-active",
        destinationFloorId: "floor-upper",
        stairConnectionId: `connection-${shape}`,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        width: shape === "straight" ? 1.2 : 2.4,
        totalRise: 2.8,
        riserCount: 16,
        treadDepth: 4 / 15,
        shape,
        ...overrides
    };
}

test("furniture footprints collide with flights and landings for every staircase shape", () => {
    const cases = [
        { stairs: [stair("straight")], positions: [[0.5, 0, 0], [3.4, 0, 0]] },
        { stairs: [stair("l-shaped")], positions: [[0.5, -0.6, 0], [3.4, 0.7, 0], [3.4, -0.6, 0]] },
        { stairs: [stair("u-shaped")], positions: [[0.5, -0.6, 0], [0.5, 0.6, 0], [3.4, 0, 0]] }
    ];

    for (const { stairs, positions } of cases) {
        for (const [x, z] of positions) {
            const result = checkAt(x, z, 0.4, 0.4, stairs);
            assert.deepEqual(result, { valid: false, reason: "staircase" });
        }
    }
});

test("complete furniture footprint is checked when its center is outside the stair", () => {
    const result = checkAt(4.05, 0, 0.2, 0.4, [stair("straight")]);
    assert.deepEqual(result, { valid: false, reason: "staircase" });
});

test("L-shaped open area and spaces outside the stair footprint remain placeable", () => {
    assert.deepEqual(
        checkAt(0.5, 0.9, 0.4, 0.4, [stair("l-shaped")]),
        { valid: true, reason: "none" }
    );
    assert.deepEqual(
        checkAt(5, 5, 0.4, 0.4, [stair("l-shaped")]),
        { valid: true, reason: "none" }
    );
});

test("only staircases passed for the active floor are considered", () => {
    assert.deepEqual(
        checkAt(0.5, 0, 0.4, 0.4, []),
        { valid: true, reason: "none" }
    );
});

test("rotated stairs use the generated flight and landing bounds", () => {
    const rotated = stair("u-shaped", {
        position: { x: 2, y: 0, z: -1 },
        rotationY: Math.PI / 2
    });
    assert.deepEqual(
        checkAt(1.4, -1.5, 0.4, 0.4, [rotated]),
        { valid: false, reason: "staircase" }
    );
});
