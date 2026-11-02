import assert from "node:assert/strict";
import test, { after } from "node:test";
import { Vector3 } from "three";
import { createServer } from "vite";

const vite = await createServer({
    appType: "custom",
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false }
});

const [costEstimator, { solveRegions }, wallFinishUtils, costPdf] =
    await Promise.all([
        vite.ssrLoadModule("/src/engine/cost/CostEstimator.ts"),
        vite.ssrLoadModule("/src/engine/regions/RegionSolver.ts"),
        vite.ssrLoadModule("/src/engine/walls/WallFinishUtils.ts"),
        vite.ssrLoadModule("/src/engine/cost/CostBreakdownPDF.ts")
    ]);

after(async () => {
    await vite.close();
});

const {
    getRegionWallFinishAssignments,
    getWallFinishSideKey,
    WALL_SIDE_FINISH_BUCKET
} = wallFinishUtils;

function createFloor(floorId, name, width, depth, wallHeight, furnitureCount) {
    const corners = [
        ["a", 0, 0],
        ["b", width, 0],
        ["c", width, depth],
        ["d", 0, depth]
    ].map(([id, x, z]) => ({
        id: `${floorId}-${id}`,
        position: new Vector3(x, 0, z)
    }));
    const cornerById = new Map(corners.map(corner => [corner.id, corner]));
    const walls = [
        ["ab", "a", "b"],
        ["bc", "b", "c"],
        ["cd", "c", "d"],
        ["da", "d", "a"]
    ].map(([id, start, end]) => ({
        id: `${floorId}-${id}`,
        start: cornerById.get(`${floorId}-${start}`),
        end: cornerById.get(`${floorId}-${end}`)
    }));
    const regions = solveRegions(corners, walls);
    const assignments = getRegionWallFinishAssignments(regions, "paint");
    const wallSideFinishes = Object.fromEntries(
        assignments.map(assignment => [
            getWallFinishSideKey(assignment.wallId, assignment.side),
            assignment.materialId
        ])
    );

    return {
        floorId,
        name,
        corners,
        walls,
        doors: [],
        windows: [],
        openings: [],
        furniture: Array.from({ length: furnitureCount }, () => ({
            assetId: "chair"
        })),
        floorFinishes: { [regions[0].id]: "tile" },
        wallFinishes: { [WALL_SIDE_FINISH_BUCKET]: wallSideFinishes },
        wallHeight
    };
}

const floors = [
    createFloor("floor-1", "1st Floor", 4, 3, 3, 1),
    createFloor("floor-2", "2nd Floor", 2, 2, 2, 2)
];

const lookups = {
    findFurnitureAsset: assetId => ({
        id: assetId,
        name: "Chair",
        price: 500
    }),
    findFloorMaterial: materialId => ({
        id: materialId,
        name: "Tile",
        category: "flooring",
        pricePerSquareMeter: 0,
        pricePerPiece: 100,
        length: 0.6,
        width: 0.6
    }),
    findWallMaterial: materialId => ({
        id: materialId,
        name: "Paint",
        category: "wallFinish",
        pricePerSquareMeter: 50,
        pricePerLiter: 50
    })
};

test("calculates every floor with floor-specific furniture, finishes, and geometry", () => {
    const estimate = costEstimator.calculateCostEstimateForFloors(floors, lookups);

    assert.deepEqual(
        estimate.floors.map(floor => [floor.floorId, floor.subtotal]),
        [["floor-1", 5225], ["floor-2", 2720]]
    );
    assert.equal(estimate.total, 7945);
    assert.equal(
        estimate.floors.reduce((sum, floor) => sum + floor.subtotal, 0),
        estimate.total
    );

    const first = estimate.floors[0];
    const second = estimate.floors[1];
    assert.equal(first.items.find(item => item.category === "furniture")?.quantity, 1);
    assert.equal(second.items.find(item => item.category === "furniture")?.quantity, 2);
    assert.ok(first.items.every(item => item.floorId === "floor-1"));
    assert.ok(second.items.every(item => item.floorId === "floor-2"));
});

test("keeps flooring piece pricing and liter-based paint coverage rules", () => {
    const estimate = costEstimator.calculateCostEstimateForFloors(floors, lookups);
    const firstFlooring = estimate.floors[0].items.find(
        item => item.category === "flooring"
    );
    const firstPaint = estimate.floors[0].items.find(
        item => item.name === "Paint"
    );
    const firstPrimer = estimate.floors[0].items.find(
        item => item.name === "Primer"
    );

    assert.deepEqual(
        [firstFlooring.quantity, firstFlooring.unit, firstFlooring.rate, firstFlooring.subtotal],
        [34, "pieces", 100, 3400]
    );
    assert.deepEqual(
        [firstPaint.quantity, firstPaint.unit, firstPaint.rate, firstPaint.subtotal, firstPaint.coats],
        [10.5, "L", 50, 525, 2]
    );
    assert.deepEqual(
        [firstPrimer.quantity, firstPrimer.unit, firstPrimer.rate, firstPrimer.subtotal, firstPrimer.coats],
        [5, "L", 160, 800, 1]
    );
});

test("switching the active floor does not change the project total", () => {
    const state = {
        floors,
        activeFloorId: "floor-1"
    };
    const firstActiveEstimate = costEstimator.calculateCostEstimate(state, lookups);
    const secondActiveEstimate = costEstimator.calculateCostEstimate({
        ...state,
        activeFloorId: "floor-2"
    }, lookups);

    assert.equal(firstActiveEstimate.total, 7945);
    assert.equal(secondActiveEstimate.total, 7945);
    assert.deepEqual(secondActiveEstimate.items, firstActiveEstimate.items);
});

test("supports a legacy single-floor project", () => {
    const floor = floors[0];
    const estimate = costEstimator.calculateCostEstimate({
        ...floor,
        floors: [],
        activeFloorId: "first-floor"
    }, lookups);

    assert.equal(estimate.floors.length, 1);
    assert.equal(estimate.floors[0].floorId, "first-floor");
    assert.equal(estimate.floors[0].name, "1st Floor");
    assert.equal(estimate.total, 5225);
});

test("PDF breakdown data includes every floor subtotal and matches the project total", () => {
    const estimate = costEstimator.calculateCostEstimateForFloors(floors, lookups);
    const pdfFloors = costPdf.getCostBreakdownFloors(estimate);

    assert.deepEqual(
        pdfFloors.map(floor => [floor.name, floor.subtotal]),
        [["1st Floor", 5225], ["2nd Floor", 2720]]
    );
    assert.equal(
        pdfFloors.reduce((sum, floor) => sum + floor.subtotal, 0),
        estimate.total
    );
});
