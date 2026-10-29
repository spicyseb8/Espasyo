import assert from "node:assert/strict";
import test from "node:test";
import {
    loadAdminManagedProjectForReview,
    mergeManagedInteriorData
} from "./managedInteriorReview.ts";

const furniturePlacement = {
    id: "chair-placement",
    assetId: "asset-chair",
    position: { x: 1, y: 0, z: 2 },
    rotationY: 1.57,
    modelOffset: { x: 0, y: 0.1, z: 0 },
    width: 0.8,
    depth: 0.7,
    height: 1.1
};

function createMetadata(overrides = {}) {
    return {
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        workflowType: "admin-managed",
        structuralStatus: "published",
        structuralRevision: 7,
        publishedStructuralRevision: 7,
        jsonUrl: "https://example.test/structure.json",
        interiorJsonPath: "projects/client-uid/PRJ-00126.interior.json",
        interiorJsonUrl: "https://example.test/interior.json",
        ...overrides
    };
}

function createStructure() {
    return {
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        workflowType: "admin-managed",
        structuralStatus: "published",
        structuralRevision: 7,
        publishedStructuralRevision: 7,
        corners: [{ id: "corner-1" }],
        walls: [{ id: "wall-1" }],
        doors: [{ id: "door-1" }],
        windows: [],
        openings: [],
        furniture: [],
        floorFinishes: {},
        wallFinishes: {}
    };
}

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data
    };
}

test("admin review loads published structure and then merges the client's furniture and finishes", async () => {
    const calls = [];
    const loaded = await loadAdminManagedProjectForReview(createMetadata(), async url => {
        calls.push(url);
        return url.endsWith("structure.json")
            ? response(createStructure())
            : response({
                projectId: "PRJ-00126",
                ownerId: "client-uid",
                furniture: [furniturePlacement],
                floorFinishes: { "room-1": "floor-asset" },
                wallFinishes: { "room-1": { "wall-1:1": "wall-asset" } }
            });
    });

    assert.deepEqual(calls, [
        "https://example.test/structure.json",
        "https://example.test/interior.json"
    ]);
    assert.deepEqual(loaded.walls, [{ id: "wall-1" }]);
    assert.deepEqual(loaded.doors, [{ id: "door-1" }]);
    assert.deepEqual(loaded.furniture, [furniturePlacement]);
    assert.deepEqual(loaded.floorFinishes, { "room-1": "floor-asset" });
    assert.deepEqual(loaded.wallFinishes, {
        "room-1": { "wall-1:1": "wall-asset" }
    });
    assert.equal(loaded.structuralRevision, 7);
    assert.equal(loaded.publishedStructuralRevision, 7);
});

test("admin review keeps legacy client designs and other placements when an asset is unavailable", () => {
    const merged = mergeManagedInteriorData(createStructure(), {
        furniture: [furniturePlacement, { ...furniturePlacement, id: "missing", assetId: "deleted-asset" }],
        floorFinishes: { "room-1": "missing-floor-id" },
        wallFinishes: { "room-1": { "wall-1:1": "wall-asset" } }
    });

    assert.equal(merged.furniture.length, 2);
    assert.equal(merged.furniture[1].assetId, "deleted-asset");
    assert.deepEqual(merged.floorFinishes, { "room-1": "missing-floor-id" });
    assert.deepEqual(merged.wallFinishes, { "room-1": { "wall-1:1": "wall-asset" } });
    assert.deepEqual(merged.walls, createStructure().walls);
});

test("admin review gracefully loads a published project with no interior file", async () => {
    const loaded = await loadAdminManagedProjectForReview(
        createMetadata({ interiorJsonPath: undefined, interiorJsonUrl: undefined }),
        async () => response(createStructure())
    );
    assert.deepEqual(loaded.furniture, []);
    assert.deepEqual(loaded.floorFinishes, {});
    assert.deepEqual(loaded.wallFinishes, {});

    const deletedFile = await loadAdminManagedProjectForReview(
        createMetadata(),
        async url => url.endsWith("structure.json")
            ? response(createStructure())
            : response(null, 404)
    );
    assert.deepEqual(deletedFile.furniture, []);
});

test("admin review rejects wrong project/client references and invalid furniture data", async () => {
    await assert.rejects(
        loadAdminManagedProjectForReview(createMetadata(), async url =>
            url.endsWith("structure.json")
                ? response(createStructure())
                : response({ projectId: "another-project", ownerId: "client-uid", furniture: [] })
        ),
        /project ID does not match/
    );
    await assert.rejects(
        loadAdminManagedProjectForReview(
            createMetadata({ interiorJsonPath: "projects/other/other.interior.json" }),
            async url => url.endsWith("structure.json")
                ? response(createStructure())
                : assert.fail("mismatched interior paths must not be fetched")
        ),
        /storage path does not match/
    );
    await assert.rejects(
        loadAdminManagedProjectForReview(createMetadata(), async url =>
            url.endsWith("structure.json")
                ? response(createStructure())
                : response({ ownerId: "client-uid", furniture: [{ id: "invalid" }] })
        ),
        /furniture placements are invalid/
    );
});

test("admin review waits for structure before interior and preserves structural publication data", async () => {
    let finishStructure;
    const calls = [];
    const loading = loadAdminManagedProjectForReview(createMetadata(), url => {
        calls.push(url);
        if (url.endsWith("structure.json")) {
            return new Promise(resolve => {
                finishStructure = () => resolve(response(createStructure()));
            });
        }
        return Promise.resolve(response({
            furniture: [furniturePlacement],
            floorFinishes: { room: "floor-id" },
            wallFinishes: {}
        }));
    });

    await Promise.resolve();
    assert.equal(calls.length, 1);
    finishStructure();
    const result = await loading;
    assert.equal(calls.length, 2);
    assert.equal(result.projectId, "PRJ-00126");
    assert.equal(result.ownerId, "client-uid");
    assert.equal(result.structuralRevision, 7);
    assert.equal(result.furniture[0].position.x, 1);
});
