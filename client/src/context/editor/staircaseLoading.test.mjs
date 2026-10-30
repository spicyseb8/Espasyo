import assert from "node:assert/strict";
import test from "node:test";
import { getStaircaseFloorData } from "./staircaseData.ts";
import { calculateStaircaseGeometry } from "../../../../shared/staircaseGeometry.ts";

const stair = {
    id: "stair-1",
    floorId: "floor-1",
    destinationFloorId: "floor-2",
    stairConnectionId: "connection-1",
    position: { x: 1, y: 0, z: 2 },
    rotationY: Math.PI / 2,
    width: 1,
    totalRise: 3,
    riserCount: 12,
    treadDepth: 0.28,
    shape: "straight"
};
const landing = {
    id: "landing-1",
    stairId: "stair-1",
    stairConnectionId: "connection-1",
    floorId: "floor-2",
    position: { x: 3, y: 0, z: 4 },
    rotationY: 0,
    width: 1,
    run: 3.08
};

function floorStructure() {
    return {
        wallHeight: 3,
        wallThickness: 0.15,
        gridSize: 0.25,
        snapEnabled: true,
        layoutConfirmed: true,
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: [],
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        archRise: 0.5,
        openingWidth: 1,
        openingHeight: 2,
        blueprint: null
    };
}

test("published stair geometry and its linked landing load with their individual floors", () => {
    const project = { stairs: [stair], stairLandings: [] };
    const firstFloor = getStaircaseFloorData(
        floorStructure(),
        project,
        0
    );
    const secondFloor = getStaircaseFloorData(
        { ...floorStructure(), stairs: [], stairLandings: [landing] },
        project,
        1
    );

    assert.deepEqual(firstFloor.stairs, [stair]);
    assert.deepEqual(firstFloor.stairLandings, []);
    assert.deepEqual(secondFloor.stairs, []);
    assert.deepEqual(secondFloor.stairLandings, [landing]);
});

test("projects without staircase fields remain compatible", () => {
    assert.deepEqual(getStaircaseFloorData(floorStructure(), {}, 0), {
        stairs: [],
        stairLandings: []
    });
});

test("all staircase shapes load with their dimensions and linked landings", () => {
    const stairs = [
        stair,
        {
            ...stair,
            id: "stair-l",
            stairConnectionId: "connection-l",
            width: 2.4,
            treadDepth: 4 / 15,
            shape: "l-shaped",
            turnDirection: "right"
        },
        {
            ...stair,
            id: "stair-u",
            stairConnectionId: "connection-u",
            width: 2.4,
            treadDepth: 4 / 15,
            shape: "u-shaped"
        }
    ];
    const landings = stairs.map((item, index) => ({
        ...landing,
        id: `landing-${index}`,
        stairId: item.id,
        stairConnectionId: item.stairConnectionId,
        floorId: item.destinationFloorId
    }));
    const activeFloor = getStaircaseFloorData(
        { ...floorStructure(), stairs, stairLandings: landings },
        {},
        0
    );

    assert.deepEqual(activeFloor.stairs.map(item => item.shape), [
        "straight",
        "l-shaped",
        "u-shaped"
    ]);
    assert.equal(activeFloor.stairs[1].turnDirection, "right");
    assert.equal(activeFloor.stairs[2].railings, undefined);
    assert.deepEqual(
        activeFloor.stairs.map(item => item.totalRise),
        [3, 3, 3]
    );
    assert.equal(activeFloor.stairLandings.length, 3);
    for (const item of activeFloor.stairs) {
        const geometry = calculateStaircaseGeometry(item);
        assert.equal(geometry.flights.length, item.shape === "straight" ? 1 : 2);
        assert.equal(geometry.railings.length, geometry.flights.length * 2);
        assert.ok(Math.abs(
            geometry.flights.reduce((sum, flight) => sum + flight.totalRise, 0) -
            item.totalRise
        ) < 1e-12);
    }
});

test("missing legacy shape defaults to straight and malformed stair data is ignored safely", () => {
    const legacyStair = { ...stair };
    delete legacyStair.shape;
    const loaded = getStaircaseFloorData({
        ...floorStructure(),
        stairs: [
            legacyStair,
            { ...stair, id: "bad-position", position: { x: Number.NaN, y: 0, z: 0 } },
            { ...stair, id: "bad-dimensions", riserCount: "many" }
        ],
        stairLandings: [{ ...landing, position: { x: 0, y: 0, z: Infinity } }]
    }, {}, 0);

    assert.deepEqual(loaded.stairs.map(item => item.shape), ["straight"]);
    assert.deepEqual(loaded.stairLandings, []);
});
