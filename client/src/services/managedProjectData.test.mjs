import assert from "node:assert/strict";
import test from "node:test";
import {
    canMutateManagedStructure,
    getManagedInteriorStoragePath,
    getClientDesignLifecycleUpdate,
    hasMeaningfulManagedInteriorChanges,
    loadManagedInteriorData,
    mergeManagedInteriorData,
    saveManagedInteriorData,
    serializeManagedInteriorData
} from "./managedProjectData.ts";

test("managed interior merge preserves published structure", () => {
    const published = {
        walls: [{ id: "wall-1" }],
        doors: [{ id: "door-1" }],
        furniture: [],
        structuralRevision: 7,
        publishedStructuralRevision: 7
    };
    const merged = mergeManagedInteriorData(published, {
        furniture: [{ id: "chair-1" }],
        floorFinishes: { room: "tile" },
        wallFinishes: { room: { "wall-1": "paint" } }
    });

    test("managed interior data stays associated with each published floor", () => {
        const published = {
            walls: [{ id: "first-wall" }],
            furniture: [],
            floors: [
                {
                    floorId: "floor-1",
                    name: "1st Floor",
                    structure: { walls: [{ id: "first-wall" }] }
                },
                {
                    floorId: "floor-2",
                    name: "2nd Floor",
                    structure: { walls: [{ id: "second-wall" }] }
                }
            ],
            structuralRevision: 7
        };
        const payload = {
            floors: [
                {
                    floorId: "floor-1",
                    furniture: [{ id: "chair-1", assetId: "chair" }],
                    floorFinishes: { "room-1": "tile" },
                    wallFinishes: {}
                },
                {
                    floorId: "floor-2",
                    furniture: [{ id: "chair-2", assetId: "chair" }],
                    floorFinishes: {},
                    wallFinishes: { "room-2": { "wall-2:1": "paint" } }
                }
            ]
        };

        const merged = mergeManagedInteriorData(published, payload);
        assert.deepEqual(merged.floors[0].furniture, payload.floors[0].furniture);
        assert.deepEqual(merged.floors[0].floorFinishes, payload.floors[0].floorFinishes);
        assert.deepEqual(merged.floors[1].furniture, payload.floors[1].furniture);
        assert.deepEqual(merged.floors[1].wallFinishes, payload.floors[1].wallFinishes);
        assert.deepEqual(merged.floors[0].structure, published.floors[0].structure);
        assert.deepEqual(merged.walls, published.walls);
        assert.equal(merged.structuralRevision, 7);
    });

    assert.deepEqual(merged.walls, published.walls);
    assert.deepEqual(merged.doors, published.doors);
    assert.deepEqual(merged.furniture, [{ id: "chair-1" }]);
    assert.deepEqual(merged.floorFinishes, { room: "tile" });
    assert.deepEqual(merged.wallFinishes, { room: { "wall-1": "paint" } });
    assert.equal(merged.structuralRevision, 7);
    assert.equal(merged.publishedStructuralRevision, 7);
});

test("managed serializer stores furniture references, placement, finishes, and client identity", () => {
    const state = {
        furniture: [{
            id: "placed-chair",
            assetId: "furniture-asset-42",
            position: { x: 1, y: 0.25, z: -2 },
            rotationY: 1.2,
            modelOffset: { x: 0, y: 0.1, z: 0 },
            width: 0.8,
            depth: 0.9,
            height: 1.1
        }],
        floorFinishes: { "room-1": "floor-material-8" },
        wallFinishes: { "room-1": { "wall-4:1": "wall-material-9" } },
        corners: [],
        walls: [],
        wallHeight: 3,
        doors: [],
        windows: [],
        openings: []
    };
    const interior = serializeManagedInteriorData(
        state,
        "PRJ-00126",
        "client-uid",
        { total: 0 }
    );

    assert.equal(interior.projectId, "PRJ-00126");
    assert.equal(interior.ownerId, "client-uid");
    assert.deepEqual(interior.furniture[0], state.furniture[0]);
    assert.deepEqual(interior.floorFinishes, state.floorFinishes);
    assert.deepEqual(interior.wallFinishes, state.wallFinishes);
    assert.equal(interior.furniture[0].assetId, "furniture-asset-42");
    assert.equal(interior.furniture[0].rotationY, 1.2);
});

test("managed interior serializer saves all floors and retains legacy first-floor fields", () => {
    const firstItem = {
        id: "placed-first",
        assetId: "asset-first",
        position: { x: 1, y: 0, z: 2 },
        rotationY: 0.5,
        modelOffset: { x: 0, y: 0, z: 0 },
        width: 1,
        depth: 1,
        height: 1
    };
    const secondItem = { ...firstItem, id: "placed-second" };
    const interior = serializeManagedInteriorData({
        furniture: [secondItem],
        floorFinishes: {},
        wallFinishes: {},
        floors: [
            {
                floorId: "floor-1",
                furniture: [firstItem],
                floorFinishes: { "room-1": "tile" },
                wallFinishes: {}
            },
            {
                floorId: "floor-2",
                furniture: [secondItem],
                floorFinishes: {},
                wallFinishes: { "room-2": { "wall-2:1": "paint" } }
            }
        ]
    }, "PRJ-00126", "client-uid", { total: 0 });

    assert.deepEqual(interior.furniture, [firstItem]);
    assert.equal(interior.floors.length, 2);
    assert.deepEqual(interior.floors[0].furniture, [firstItem]);
    assert.deepEqual(interior.floors[1].furniture, [secondItem]);
    assert.deepEqual(interior.floors[0].floorFinishes, { "room-1": "tile" });
    assert.deepEqual(interior.floors[1].wallFinishes, { "room-2": { "wall-2:1": "paint" } });
});

test("managed save uploads to the designated path and updates interior metadata only", async () => {
    const projectMetadata = {
        jsonPath: "published/structure.json",
        jsonUrl: "https://example.test/structure.json",
        structuralRevision: 7,
        publishedStructuralRevision: 7,
        structuralStatus: "published",
        workflowType: "admin-managed"
    };
    const operationOrder = [];
    let uploadedJson;
    await saveManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        projectName: "Client plan",
        estimatedCost: 125,
        hasMeaningfulChanges: true,
        interiorData: {
            projectId: "PRJ-00126",
            ownerId: "client-uid",
            furniture: [{ id: "chair", assetId: "asset-chair" }],
            floorFinishes: { room: "tile" },
            wallFinishes: { room: { wall: "paint" } }
        },
        updatedAt: "timestamp",
        uploadJson: async (path, json) => {
            operationOrder.push("upload");
            assert.equal(path, "projects/client-uid/PRJ-00126.interior.json");
            uploadedJson = JSON.parse(json);
            return "https://example.test/interior.json";
        },
        updateMetadata: async metadata => {
            operationOrder.push("metadata");
            assert.equal(metadata.ownerId, "client-uid");
            assert.equal(metadata.projectId, "PRJ-00126");
            assert.equal(metadata.interiorJsonPath, "projects/client-uid/PRJ-00126.interior.json");
            assert.equal(metadata.interiorJsonUrl, "https://example.test/interior.json");
            assert.equal(metadata.clientDesignStarted, true);
            assert.equal("jsonPath" in metadata, false);
            assert.equal("jsonUrl" in metadata, false);
            assert.equal("structuralRevision" in metadata, false);
            Object.assign(projectMetadata, metadata);
        }
    });

    assert.deepEqual(operationOrder, ["upload", "metadata"]);
    assert.equal(uploadedJson.ownerId, "client-uid");
    assert.equal(projectMetadata.jsonPath, "published/structure.json");
    assert.equal(projectMetadata.structuralRevision, 7);
    assert.equal(getManagedInteriorStoragePath("client-uid", "PRJ-00126"), "projects/client-uid/PRJ-00126.interior.json");
});

test("managed save propagates upload and metadata failures", async () => {
    const input = {
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        projectName: "Plan",
        estimatedCost: 0,
        hasMeaningfulChanges: false,
        interiorData: { furniture: [] },
        updatedAt: "timestamp",
        uploadJson: async () => "https://example.test/interior.json",
        updateMetadata: async () => {
            throw new Error("metadata denied");
        }
    };
    await assert.rejects(
        saveManagedInteriorData({
            ...input,
            uploadJson: async () => {
                throw new Error("upload denied");
            },
            updateMetadata: async () => assert.fail("metadata must not update after upload failure")
        }),
        /upload denied/
    );
    await assert.rejects(saveManagedInteriorData(input), /metadata denied/);
    await saveManagedInteriorData({
        ...input,
        updateMetadata: async metadata => {
            assert.equal("clientDesignStarted" in metadata, false);
            assert.equal("clientDesignStartedAt" in metadata, false);
        }
    });
});

test("empty interior saves do not mark lifecycle while meaningful saves set an idempotent first timestamp", () => {
    const emptyInterior = {
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        costEstimate: { total: 0 }
    };
    assert.equal(hasMeaningfulManagedInteriorChanges(emptyInterior), false);
    assert.deepEqual(getClientDesignLifecycleUpdate({}, false, "server-time"), {});

    const meaningfulInterior = {
        furniture: [{ id: "chair-placement", assetId: "chair-asset" }],
        floorFinishes: {},
        wallFinishes: {}
    };
    assert.equal(hasMeaningfulManagedInteriorChanges(meaningfulInterior), true);
    assert.deepEqual(
        getClientDesignLifecycleUpdate({}, true, "server-time"),
        { clientDesignStarted: true, clientDesignStartedAt: "server-time" }
    );
    assert.deepEqual(
        getClientDesignLifecycleUpdate({
            clientDesignStarted: true,
            clientDesignStartedAt: "first-save-time"
        }, true, "later-time"),
        { clientDesignStarted: true }
    );
});

test("client interior load tolerates a missing file and validates identity and reference", async () => {
    const reference = {
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        interiorJsonPath: "projects/client-uid/PRJ-00126.interior.json",
        interiorJsonUrl: "https://example.test/interior.json"
    };
    const absent = await loadManagedInteriorData(reference, async () => ({
        status: 404,
        ok: false
    }));
    assert.equal(absent, null);

    await assert.rejects(
        loadManagedInteriorData(reference, async () => ({
            status: 200,
            ok: true,
            json: async () => ({ projectId: "another-project", ownerId: "client-uid" })
        })),
        /project ID does not match/
    );
    await assert.rejects(
        loadManagedInteriorData({
            ...reference,
            interiorJsonPath: "projects/another-client/other-project.interior.json"
        }, async () => assert.fail("mismatched paths must not be fetched")),
        /storage path does not match/
    );
});

test("client interior load waits for the referenced data before returning it", async () => {
    let resolveResponse;
    let completed = false;
    const loading = loadManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        interiorJsonUrl: "https://example.test/interior.json"
    }, () => new Promise(resolve => {
        resolveResponse = resolve;
    })).then(payload => {
        completed = true;
        return payload;
    });

    await Promise.resolve();
    assert.equal(completed, false);
    resolveResponse({
        status: 200,
        ok: true,
        json: async () => ({
            projectId: "PRJ-00126",
            ownerId: "client-uid",
            furniture: [{ id: "chair", assetId: "deleted-asset" }],
            floorFinishes: { room: "floor" },
            wallFinishes: { room: { wall: "paint" } }
        })
    });
    const payload = await loading;
    assert.equal(completed, true);
    assert.equal(payload.furniture[0].assetId, "deleted-asset");
    assert.deepEqual(payload.floorFinishes, { room: "floor" });
});

test("legacy structure remains editable and managed structure does not", () => {
    assert.equal(canMutateManagedStructure(undefined), true);
    assert.equal(canMutateManagedStructure("legacy"), true);
    assert.equal(canMutateManagedStructure("admin-managed"), false);
});
