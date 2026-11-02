import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import {
    getRoomCornerPlacements,
    getUniqueRoomRegions,
    shouldShowWalkthroughCornerLights,
    WALKTHROUGH_GLB_SCALE,
    WALKTHROUGH_ROOM_LIGHT_MULTIPLIER
} from "./WalkthroughRoomPlacement.ts";
import {
    buildWalkthroughStairColliders,
    canWalkTo
} from "./WalkthroughCollision.ts";
import { calculateStaircaseGeometry } from "../../../../shared/staircaseGeometry.ts";

function makeRegion(id, points, holes = []) {
    const corners = points.map(([x, z]) => new Vector3(x, 0, z));
    const boundaryLoops = [
        { corners, wallIds: [] },
        ...holes.map(hole => ({
            corners: hole.map(([x, z]) => new Vector3(x, 0, z)),
            wallIds: []
        }))
    ];

    return {
        id,
        corners,
        boundaryLoops,
        walls: [],
        parentRegionId: null,
        childRegionIds: [],
        adjacentRegionIds: [],
        area: 1,
        perimeter: 1,
        relationshipSummary: []
    };
}

function makeStair(overrides = {}) {
    return {
        id: "stair-1",
        floorId: "floor-1",
        destinationFloorId: "floor-2",
        stairConnectionId: "connection-1",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        width: 1,
        totalRise: 3,
        riserCount: 12,
        treadDepth: 0.28,
        railings: false,
        shape: "straight",
        ...overrides
    };
}

test("walkthrough corner placements are inside rooms and unique across duplicate boundaries", () => {
    const room = makeRegion("room-a", [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3]
    ]);
    const duplicate = makeRegion("room-copy", [
        [4, 3],
        [4, 0],
        [0, 0],
        [0, 3]
    ]);
    const placements = getRoomCornerPlacements([room, duplicate]);

    assert.equal(getUniqueRoomRegions([room, duplicate]).length, 1);
    assert.equal(placements.length, 4);
    assert.deepEqual(
        getRoomCornerPlacements([room, duplicate]),
        placements
    );
    assert.ok(placements.every(({ position }) =>
        position.x > 0 &&
        position.x < 4 &&
        position.z > 0 &&
        position.z < 3
    ));
});

test("nested room boundaries remain independent and holes do not receive parent fixtures", () => {
    const parent = makeRegion("parent", [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
    ], [[
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7]
    ]]);
    const nested = makeRegion("nested", [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7]
    ]);

    const placements = getRoomCornerPlacements([parent, nested]);

    assert.equal(getUniqueRoomRegions([parent, nested]).length, 2);
    assert.equal(placements.length, 8);
    assert.equal(placements.filter(item => item.roomId === "parent").length, 4);
    assert.equal(placements.filter(item => item.roomId === "nested").length, 4);
    assert.ok(placements
        .filter(item => item.roomId === "parent")
        .every(({ position }) =>
            position.x < 3 || position.x > 7 ||
            position.z < 3 || position.z > 7
        ));
});

test("shared corner placements are not duplicated and walkthrough lighting/model scale remain tuned", () => {
    const first = makeRegion("first", [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2]
    ]);
    const second = makeRegion("second", [
        [2, 0],
        [4, 0],
        [4, 2],
        [2, 2]
    ]);
    const placements = getRoomCornerPlacements([first, second]);
    const positionKeys = placements.map(({ position }) =>
        `${position.x.toFixed(3)},${position.z.toFixed(3)}`
    );

    assert.equal(new Set(positionKeys).size, positionKeys.length);
    assert.equal(WALKTHROUGH_GLB_SCALE, 0.7);
    assert.equal(WALKTHROUGH_ROOM_LIGHT_MULTIPLIER, 1.5);
});

test("room-corner lights are active only after spawn confirmation in walkthrough mode", () => {
    assert.equal(shouldShowWalkthroughCornerLights(true, false), false);
    assert.equal(shouldShowWalkthroughCornerLights(true, true), true);
    assert.equal(shouldShowWalkthroughCornerLights(false, true), false);
});

test("stair colliders use generated treads and risers for every shape and active floor only", () => {
    const stairs = [
        makeStair(),
        makeStair({
            id: "stair-l",
            floorId: "floor-1",
            width: 2.4,
            treadDepth: 4 / 15,
            shape: "l-shaped",
            turnDirection: "right"
        }),
        makeStair({
            id: "stair-u",
            floorId: "floor-1",
            width: 2.4,
            treadDepth: 4 / 15,
            shape: "u-shaped"
        }),
        makeStair({ id: "other-floor", floorId: "floor-2" })
    ];
    const colliders = buildWalkthroughStairColliders(stairs, "floor-1");

    assert.ok(colliders.length > 60);
    assert.ok(colliders.every(collider => collider.position.y < 3));
    for (const shape of ["straight", "l-shaped", "u-shaped"]) {
        const stair = stairs.find(item => item.shape === shape);
        const stairColliders = buildWalkthroughStairColliders([stair], "floor-1");
        const geometry = calculateStaircaseGeometry(stair);
        const firstFlight = geometry.flights[0];
        for (const collider of [
            stairColliders[0],
            stairColliders[firstFlight.treads.length]
        ]) {
            assert.ok(collider);
            assert.equal(
                canWalkTo(new Vector3(
                    collider.position.x,
                    1.7,
                    collider.position.z
                ), [], [], stairColliders),
                false
            );
        }

        if (geometry.landings.length > 0) {
            const landingCollider = stairColliders[
                geometry.flights.reduce(
                    (count, flight) => count + flight.treads.length + flight.risers.length,
                    0
                )
            ];
            assert.equal(
                canWalkTo(new Vector3(
                    landingCollider.position.x,
                    landingCollider.position.y + 0.5,
                    landingCollider.position.z
                ), [], [], stairColliders),
                false
            );
        }
    }

    assert.deepEqual(
        buildWalkthroughStairColliders([stairs[3]], "floor-1"),
        []
    );
});

test("stair collider geometry follows the rendered staircase transform and supports open space", () => {
    const stair = makeStair({
        position: { x: 10, y: 2, z: 20 },
        rotationY: Math.PI / 2
    });
    const colliders = buildWalkthroughStairColliders([stair], "floor-1");
    const firstRiser = colliders[0];

    assert.ok(Math.abs(firstRiser.position.x - 10) < 0.1);
    assert.ok(firstRiser.position.z < 20);
    assert.equal(
        canWalkTo(new Vector3(10, 3.7, 20 - 2.8), [], [], colliders),
        true
    );
});

test("stair railings are collidable only when rendered", () => {
    const withRails = buildWalkthroughStairColliders([
        makeStair({ railings: true })
    ], "floor-1");
    const withoutRails = buildWalkthroughStairColliders([
        makeStair({ railings: false })
    ], "floor-1");

    assert.ok(withRails.length > withoutRails.length);
});
