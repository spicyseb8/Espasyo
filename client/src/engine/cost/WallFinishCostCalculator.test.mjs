import assert from "node:assert/strict";
import test, { after } from "node:test";
import { Vector3 } from "three";
import { createServer } from "vite";

const vite = await createServer({
    appType: "custom",
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    root: process.cwd(),
    server: { middlewareMode: true }
});

const [{ solveRegions }, wallFinishUtils, { calculateWallFinishCosts }] =
    await Promise.all([
        vite.ssrLoadModule("/src/engine/regions/RegionSolver.ts"),
        vite.ssrLoadModule("/src/engine/walls/WallFinishUtils.ts"),
        vite.ssrLoadModule("/src/engine/cost/WallFinishCostCalculator.ts")
    ]);

const {
    getRegionWallFinishAssignments,
    getWallFinishSideKey,
    getWallFinishSides,
    WALL_SIDE_FINISH_BUCKET
} = wallFinishUtils;

after(async () => {
    await vite.close();
});

function createTwoRoomPlan() {
    const corners = [
        ["a", 0, 0],
        ["b", 4, 0],
        ["c", 8, 0],
        ["d", 0, 3],
        ["e", 4, 3],
        ["f", 8, 3]
    ].map(([id, x, z]) => ({
        id,
        position: new Vector3(x, 0, z)
    }));
    const cornerById = new Map(corners.map(corner => [corner.id, corner]));
    const walls = [
        ["ab", "a", "b"],
        ["shared", "b", "e"],
        ["ed", "e", "d"],
        ["da", "d", "a"],
        ["bc", "b", "c"],
        ["cf", "c", "f"],
        ["fe", "f", "e"]
    ].map(([id, start, end]) => ({
        id,
        start: cornerById.get(start),
        end: cornerById.get(end)
    }));

    return {
        corners,
        walls,
        regions: solveRegions(corners, walls)
    };
}

function applyAssignments(assignments, existing = {}) {
    const result = { ...existing };

    for (const assignment of assignments) {
        result[getWallFinishSideKey(assignment.wallId, assignment.side)] =
            assignment.materialId;
    }

    return result;
}

const materials = new Map([
    ["paint-a", {
        id: "paint-a",
        name: "Warm white",
        category: "wallFinish",
        pricePerSquareMeter: 50
    }],
    ["paint-b", {
        id: "paint-b",
        name: "Soft gray",
        category: "wallFinish",
        pricePerSquareMeter: 80
    }]
]);

const materialLookup = materialId => materials.get(materialId);

test("apply to all creates one assignment for each room-facing wall side", () => {
    const { regions } = createTwoRoomPlan();

    assert.equal(regions.length, 2);

    const assignments = getRegionWallFinishAssignments(
        regions,
        "paint-a"
    );
    const sharedWallAssignments = assignments.filter(
        assignment => assignment.wallId === "shared"
    );

    assert.equal(assignments.length, 8);
    assert.deepEqual(
        new Set(sharedWallAssignments.map(assignment => assignment.side)),
        new Set([1, -1])
    );
    assert.equal(
        new Set(assignments.map(
            assignment => getWallFinishSideKey(assignment.wallId, assignment.side)
        )).size,
        assignments.length
    );
});

test("costs include both painted sides of a shared wall exactly once", () => {
    const { corners, walls, regions } = createTwoRoomPlan();
    const assignments = getRegionWallFinishAssignments(
        regions,
        "paint-a"
    );
    const finishes = applyAssignments(assignments);
    const sharedWallFaces = getWallFinishSides(
        walls.find(wall => wall.id === "shared"),
        regions,
        { [WALL_SIDE_FINISH_BUCKET]: finishes }
    );

    assert.equal(sharedWallFaces.length, 2);

    const items = calculateWallFinishCosts({
        corners,
        walls,
        wallHeight: 3,
        doors: [],
        windows: [],
        openings: [],
        wallFinishes: {
            [WALL_SIDE_FINISH_BUCKET]: finishes
        }
    }, materialLookup);
    const paint = items.find(item => item.name === "Warm white");

    assert.equal(paint?.quantity, 84);
    assert.equal(paint?.unit, "m²");
    assert.equal(paint?.rate, 50);
    assert.equal(paint?.subtotal, 4200);
});

test("a finish on only one shared-wall face is charged once and openings reduce area", () => {
    const { corners, walls } = createTwoRoomPlan();
    const sideFinishes = {
        [getWallFinishSideKey("shared", 1)]: "paint-a"
    };
    const items = calculateWallFinishCosts({
        corners,
        walls,
        wallHeight: 3,
        doors: [{
            id: "door",
            wallId: "shared",
            width: 1,
            height: 2,
            position: new Vector3(4, 0, 1.5)
        }],
        windows: [],
        openings: [],
        wallFinishes: {
            [WALL_SIDE_FINISH_BUCKET]: sideFinishes
        }
    }, materialLookup);
    const paint = items.find(item => item.name === "Warm white");

    assert.equal(paint?.quantity, 7);
    assert.equal(paint?.subtotal, 350);
});

test("openings are deducted from each painted side of a shared wall", () => {
    const { corners, walls, regions } = createTwoRoomPlan();
    const finishes = applyAssignments(
        getRegionWallFinishAssignments(regions, "paint-a").filter(
            assignment => assignment.wallId === "shared"
        )
    );
    const items = calculateWallFinishCosts({
        corners,
        walls,
        wallHeight: 3,
        doors: [{
            id: "door",
            wallId: "shared",
            width: 1,
            height: 2,
            position: new Vector3(4, 0, 1.5)
        }],
        windows: [],
        openings: [],
        wallFinishes: {
            [WALL_SIDE_FINISH_BUCKET]: finishes
        }
    }, materialLookup);
    const paint = items.find(item => item.name === "Warm white");

    assert.equal(paint?.quantity, 14);
    assert.equal(paint?.subtotal, 700);
});

test("replacing room finishes updates both shared-face material totals", () => {
    const { corners, walls, regions } = createTwoRoomPlan();
    const assignments = getRegionWallFinishAssignments(
        regions,
        "paint-a"
    );
    const bothSides = assignments.filter(
        assignment => assignment.wallId === "shared"
    );
    const finishes = applyAssignments(bothSides);
    const replaced = applyAssignments(
        bothSides.map(assignment => ({
            ...assignment,
            materialId: "paint-b"
        })),
        finishes
    );
    const items = calculateWallFinishCosts({
        corners,
        walls,
        wallHeight: 3,
        doors: [],
        windows: [],
        openings: [],
        wallFinishes: {
            [WALL_SIDE_FINISH_BUCKET]: replaced
        }
    }, materialLookup);
    const paint = items.find(item => item.name === "Soft gray");

    assert.equal(paint?.quantity, 18);
    assert.equal(paint?.subtotal, 1440);
    assert.equal(items.some(item => item.name === "Warm white"), false);
});
