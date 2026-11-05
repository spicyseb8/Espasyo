import assert from "node:assert/strict";
import test from "node:test";
import {
    canMutateManagedStructure,
    getClientDesignLifecycleUpdate,
    hasMeaningfulManagedInteriorChanges,
    loadManagedInteriorData,
    mergeManagedInteriorData,
    saveManagedInteriorData,
    serializeManagedInteriorData
} from "./managedProjectData.ts";
import { getProjectFingerprint } from "./projectEditSessionService.ts";

test("budget edits remain detectable without adding budget to structural data", () => {
    const project = { projectId: "PRJ-00126", walls: [] };
    const baseline = { ...project, maximumBudget: 425000 };
    assert.notEqual(
        getProjectFingerprint(baseline),
        getProjectFingerprint({ ...project, maximumBudget: 500000 })
    );
    assert.equal(
        getProjectFingerprint({ ...project, maximumBudget: null }),
        getProjectFingerprint(project)
    );
});

test("managed interior merge preserves published structure", () => {
    const published = {
        walls: [{ id: "wall-1" }],
        doors: [{ id: "door-1" }],
        stairs: [{ id: "stair-1", shape: "l-shaped" }],
        stairLandings: [{ id: "landing-1", stairId: "stair-1" }],
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
                    structure: {
                        walls: [{ id: "first-wall" }],
                        stairs: [{ id: "floor-stair" }],
                        stairLandings: [{ id: "floor-landing" }]
                    }
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
                    wallFinishes: {},
                    wallPaintSeparators: {
                        "wall-1::side:1": {
                            separators: [
                                { id: "v1", orientation: "vertical", position: 0.5 }
                            ],
                            sectionMaterials: { left: "blue", right: "white" }
                        }
                    },
                    floorPaintSeparators: {
                        "room-1": {
                            floorId: "floor-1",
                            surfaceType: "floor",
                            surfaceId: "room-1",
                            separators: [
                                { id: "floor-cut", orientation: "horizontal", position: 0.4 }
                            ],
                            sectionMaterials: { lower: "tile-a", upper: "tile-b" }
                        }
                    }
                },
                {
                    floorId: "floor-2",
                    furniture: [{ id: "chair-2", assetId: "chair" }],
                    floorFinishes: {},
                    wallFinishes: { "room-2": { "wall-2:1": "paint" } },
                    wallPaintSeparators: {
                        "wall-2::side:-1": {
                            separators: [
                                { id: "h1", orientation: "horizontal", position: 0.6 }
                            ],
                            sectionMaterials: { lower: "gray", upper: "white" }
                        }
                    }
                }
            ]
        };

        const merged = mergeManagedInteriorData(published, payload);
        assert.deepEqual(merged.floors[0].furniture, payload.floors[0].furniture);
        assert.deepEqual(merged.floors[0].floorFinishes, payload.floors[0].floorFinishes);
        assert.deepEqual(merged.floors[1].furniture, payload.floors[1].furniture);
        assert.deepEqual(merged.floors[1].wallFinishes, payload.floors[1].wallFinishes);
        assert.deepEqual(
            merged.floors[0].wallPaintSeparators,
            payload.floors[0].wallPaintSeparators
        );
        assert.deepEqual(
            merged.floors[1].wallPaintSeparators,
            payload.floors[1].wallPaintSeparators
        );
        assert.deepEqual(merged.floors[0].structure, published.floors[0].structure);
        assert.deepEqual(merged.walls, published.walls);
        assert.equal(merged.structuralRevision, 7);
    });

    assert.deepEqual(merged.walls, published.walls);
    assert.deepEqual(merged.doors, published.doors);
    assert.deepEqual(merged.stairs, published.stairs);
    assert.deepEqual(merged.stairLandings, published.stairLandings);
    assert.deepEqual(merged.furniture, [{ id: "chair-1" }]);
    assert.deepEqual(merged.floorFinishes, { room: "tile" });
    assert.deepEqual(merged.wallFinishes, { room: { "wall-1": "paint" } });
    assert.equal(merged.structuralRevision, 7);
    assert.equal(merged.publishedStructuralRevision, 7);
});

test("separator-only legacy interior data merges per floor without replacing other design data", () => {
    const published = {
        walls: [{ id: "first-wall" }],
        furniture: [{ id: "legacy-furniture" }],
        floorFinishes: { "room-1": "legacy-floor" },
        wallFinishes: { "room-1": { "first-wall": "legacy-paint" } },
        floors: [
            {
                floorId: "floor-1",
                name: "1st Floor",
                furniture: [{ id: "legacy-furniture" }],
                floorFinishes: { "room-1": "legacy-floor" },
                wallFinishes: { "room-1": { "first-wall": "legacy-paint" } },
                structure: { walls: [{ id: "first-wall" }] }
            },
            {
                floorId: "floor-2",
                name: "2nd Floor",
                furniture: [],
                floorFinishes: {},
                wallFinishes: {},
                structure: { walls: [{ id: "second-wall" }] }
            }
        ]
    };
    const firstFace = {
        separators: [
            { id: "separator-1", orientation: "vertical", position: 0.5 }
        ],
        sectionMaterials: { left: "blue", right: "white" }
    };
    const secondFace = {
        separators: [
            { id: "separator-2", orientation: "horizontal", position: 0.6 }
        ],
        sectionMaterials: { lower: "gray", upper: "white" }
    };
    const merged = mergeManagedInteriorData(published, {
        wallPaintSeparators: { "first-wall::side:1": firstFace },
        floors: [
            {
                floorId: "floor-1",
                wallPaintSeparators: { "first-wall::side:1": firstFace }
            },
            {
                floorId: "floor-2",
                wallPaintSeparators: { "second-wall::side:-1": secondFace }
            }
        ]
    });

    assert.deepEqual(merged.floors[0].wallPaintSeparators, {
        "first-wall::side:1": firstFace
    });
    assert.deepEqual(merged.floors[1].wallPaintSeparators, {
        "second-wall::side:-1": secondFace
    });
    assert.deepEqual(merged.floors[0].furniture, published.floors[0].furniture);
    assert.deepEqual(merged.floors[0].wallFinishes, published.floors[0].wallFinishes);
    assert.deepEqual(merged.furniture, published.furniture);
    assert.deepEqual(merged.wallFinishes, published.wallFinishes);
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
        openings: [],
        stairs: [{ id: "published-stair" }],
        stairLandings: [{ id: "published-landing" }]
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
    assert.equal("stairs" in interior, false);
    assert.equal("stairLandings" in interior, false);
});

test("project budget persists in interior JSON and restores without changing structure", async () => {
    const structure = {
        projectId: "PRJ-00126",
        walls: [{ id: "published-wall" }],
        furniture: [],
        structuralRevision: 7
    };
    const interior = serializeManagedInteriorData({
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        projectBudget: 425000
    }, "PRJ-00126", "client-uid", { total: 0 });

    assert.equal(interior.maximumBudget, 425000);
    const merged = mergeManagedInteriorData(structure, interior);
    assert.equal(merged.maximumBudget, 425000);
    assert.deepEqual(merged.walls, structure.walls);
    assert.equal(merged.structuralRevision, 7);

    let savedJson;
    await saveManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        projectName: "Client plan",
        estimatedCost: 0,
        hasMeaningfulChanges: true,
        interiorData: interior,
        updatedAt: "timestamp",
        save: async payload => {
            savedJson = JSON.stringify(payload.interiorData);
            return { versionId: "version-1", versionNumber: 1 };
        }
    });

    const restored = await loadManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        interiorJsonPath: "projects/client-uid/PRJ-00126.interior.json",
        interiorJsonUrl: "https://example.test/interior.json"
    }, async () => new Response(savedJson, { status: 200 }));
    assert.equal(restored.maximumBudget, 425000);
    const removedBudget = serializeManagedInteriorData({
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        projectBudget: null
    }, "PRJ-00126", "client-uid", { total: 0 });
    assert.equal("maximumBudget" in removedBudget, false);

    const legacy = mergeManagedInteriorData(structure, null);
    assert.equal(legacy.maximumBudget, null);
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
                wallFinishes: {},
                wallPaintSeparators: {
                    "wall-1::side:1": {
                        separators: [
                            { id: "separator", orientation: "vertical", position: 0.5 }
                        ],
                        sectionMaterials: { left: "blue", right: "white" }
                    }
                },
                floorPaintSeparators: {
                    "room-1": {
                        floorId: "floor-1",
                        surfaceType: "floor",
                        surfaceId: "room-1",
                        separators: [
                            { id: "floor-cut", orientation: "horizontal", position: 0.4 }
                        ],
                        sectionMaterials: { lower: "tile-a", upper: "tile-b" }
                    }
                }
            },
            {
                floorId: "floor-2",
                furniture: [secondItem],
                floorFinishes: {},
                wallFinishes: { "room-2": { "wall-2:1": "paint" } },
                wallPaintSeparators: {},
                floorPaintSeparators: {}
            }
        ]
    }, "PRJ-00126", "client-uid", { total: 0 });

    assert.deepEqual(interior.furniture, [firstItem]);
    assert.equal(interior.floors.length, 2);
    assert.deepEqual(interior.floors[0].furniture, [firstItem]);
    assert.deepEqual(interior.floors[1].furniture, [secondItem]);
    assert.deepEqual(interior.floors[0].floorFinishes, { "room-1": "tile" });
    assert.deepEqual(interior.floors[1].wallFinishes, { "room-2": { "wall-2:1": "paint" } });
    assert.deepEqual(
        interior.floors[0].wallPaintSeparators,
        {
            "wall-1::side:1": {
                separators: [
                    { id: "separator", orientation: "vertical", position: 0.5 }
                ],
                sectionMaterials: { left: "blue", right: "white" }
            }
        }
    );
    assert.deepEqual(
        interior.floors[0].floorPaintSeparators["room-1"],
        {
            floorId: "floor-1",
            surfaceType: "floor",
            surfaceId: "room-1",
            separators: [
                { id: "floor-cut", orientation: "horizontal", position: 0.4 }
            ],
            sectionMaterials: { lower: "tile-a", upper: "tile-b" }
        }
    );
});

test("managed saves use the authenticated API and return version metadata without a URL", async () => {
    const operationOrder = [];
    let savedInput;
    const result = await saveManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        estimatedCost: 125,
        hasMeaningfulChanges: true,
        interiorData: {
            projectId: "PRJ-00126",
            ownerId: "client-uid",
            furniture: [{ id: "chair", assetId: "asset-chair" }],
            floorFinishes: { room: "tile" },
            wallFinishes: { room: { wall: "paint" } }
        },
        save: async input => {
            operationOrder.push("authenticated-save");
            savedInput = input;
            return { versionId: "version-1", versionNumber: 1 };
        }
    });

    assert.deepEqual(operationOrder, ["authenticated-save"]);
    assert.deepEqual(result, { versionId: "version-1", versionNumber: 1 });
    assert.equal(savedInput.projectId, "PRJ-00126");
    assert.equal(savedInput.interiorData.ownerId, "client-uid");
    assert.equal("storagePath" in savedInput, false);
    assert.equal("downloadUrl" in result, false);
});

test("managed save propagates authenticated API failures", async () => {
    await assert.rejects(saveManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        estimatedCost: 0,
        hasMeaningfulChanges: false,
        interiorData: { furniture: [] },
        save: async () => {
            throw new Error("save denied");
        }
    }), /save denied/);
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

test("managed interior downloads use the project API and ignore supplied URLs and paths", async () => {
    let requestedProjectId;
    const payload = await loadManagedInteriorData({
        projectId: "PRJ-00126",
        ownerId: "client-uid",
        workflowType: "admin-managed",
        interiorJsonPath: "projects/another-client/other-project/versions/fake.json",
        interiorJsonUrl: "https://example.test/public-token"
    }, async () => assert.fail("managed files must not be fetched by URL"), async projectId => {
        requestedProjectId = projectId;
        return {
            projectId: "PRJ-00126",
            ownerId: "client-uid",
            furniture: []
        };
    });

    assert.equal(requestedProjectId, "PRJ-00126");
    assert.equal(payload.projectId, "PRJ-00126");
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
