import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { mergeManagedInteriorData } from "../../../../services/assets/managedInteriorReview.ts";

const vite = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true }
});

const { createAdminCostEstimate } = await vite.ssrLoadModule(
    "/src/components/project-loader/engine/cost/AdminCostCalculation.ts"
);

after(async () => {
    await vite.close();
});

const placement = id => ({
    id,
    assetId: "chair",
    position: { x: 1, y: 0, z: 1 },
    rotationY: 0,
    modelOffset: { x: 0, y: 0, z: 0 },
    width: 1,
    depth: 1,
    height: 1
});

function floorStructure() {
    return {
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: [],
        wallHeight: 2.8,
        floorFinishes: {},
        wallFinishes: {},
        furniture: []
    };
}

test("admin estimates published floors together with saved client interior placements", () => {
    const published = {
        projectId: "project-1",
        ownerId: "client-1",
        workflowType: "admin-managed",
        structuralStatus: "published",
        structuralRevision: 4,
        publishedStructuralRevision: 4,
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: [],
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        wallHeight: 2.8,
        floors: [
            {
                floorId: "floor-1",
                name: "1st Floor",
                structure: floorStructure("floor-1")
            },
            {
                floorId: "floor-2",
                name: "2nd Floor",
                structure: floorStructure("floor-2")
            }
        ]
    };
    const merged = mergeManagedInteriorData(published, {
        projectId: "project-1",
        ownerId: "client-1",
        floors: [
            {
                floorId: "floor-1",
                furniture: [placement("chair-1")],
                floorFinishes: {},
                wallFinishes: {}
            },
            {
                floorId: "floor-2",
                furniture: [placement("chair-2"), placement("chair-3")],
                floorFinishes: {},
                wallFinishes: {}
            }
        ]
    });

    const estimate = createAdminCostEstimate(merged, {
        findFurnitureAsset: id => ({
            id,
            name: "Chair",
            price: 1000
        })
    });

    assert.deepEqual(
        estimate.floors.map(floor => [floor.floorId, floor.subtotal]),
        [["floor-1", 1000], ["floor-2", 2000]]
    );
    assert.equal(estimate.total, 3000);
    assert.deepEqual(
        estimate.items.map(item => item.floorId),
        ["floor-1", "floor-2"]
    );
    assert.equal(merged.structuralRevision, 4);
    assert.equal(merged.floors[0].structure, published.floors[0].structure);
});

test("admin assigns legacy root-level interior data to the first floor only", () => {
    const published = {
        projectId: "project-1",
        ownerId: "client-1",
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: [],
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        floors: [
            {
                floorId: "floor-1",
                name: "1st Floor",
                structure: floorStructure()
            },
            {
                floorId: "floor-2",
                name: "2nd Floor",
                structure: floorStructure()
            }
        ]
    };
    const merged = mergeManagedInteriorData(published, {
        furniture: [placement("chair-1")],
        floorFinishes: {},
        wallFinishes: {}
    });
    const estimate = createAdminCostEstimate(merged, {
        findFurnitureAsset: id => ({
            id,
            name: "Chair",
            price: 1000
        })
    });

    assert.deepEqual(
        estimate.floors.map(floor => floor.subtotal),
        [1000, 0]
    );
    assert.equal(estimate.total, 1000);
});
