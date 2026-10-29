import assert from "node:assert/strict";
import test from "node:test";
import { publishManagedStructure } from "./managedStructurePublication.ts";

function createDependencies(overrides = {}) {
    const calls = [];
    return {
        calls,
        dependencies: {
            findExistingProject: async () => {
                calls.push("find-existing");
                return null;
            },
            getAssignedProject: async () => {
                calls.push("find-assignment");
                return null;
            },
            allocateProjectId: async () => {
                calls.push("allocate");
                return "PRJ-00126";
            },
            upload: async (path, json) => {
                calls.push("upload");
                calls.push({ path, data: JSON.parse(json) });
                return "https://storage.example/published.json";
            },
            commit: async publication => {
                calls.push("commit");
                calls.push(publication);
            },
            cleanup: async path => {
                calls.push("cleanup");
                calls.push(path);
            },
            ...overrides
        }
    };
}

const emptyStructure = {
    projectId: "local-draft",
    projectName: "Draft",
    ownerId: "client-a",
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    wallHeight: 3,
    wallThickness: 0.15,
    gridSize: 0.25,
    snapEnabled: true,
    layoutConfirmed: false,
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
    blueprint: { url: "blob:runtime-only-blueprint" }
};

test("publishing uploads validated structure before atomically committing metadata and assignment", async () => {
    const { calls, dependencies } = createDependencies();
    const result = await publishManagedStructure({
        ownerId: "client-a",
        projectName: "Published plan",
        projectData: emptyStructure
    }, dependencies);

    assert.deepEqual(calls.filter(item => typeof item === "string"), [
        "find-existing",
        "find-assignment",
        "allocate",
        "upload",
        "commit"
    ]);
    const uploaded = calls.find(item => typeof item === "object" && "data" in item).data;
    assert.equal(uploaded.projectId, result.projectId);
    assert.equal(uploaded.ownerId, "client-a");
    assert.equal(uploaded.projectName, "Published plan");
    assert.equal(uploaded.structuralStatus, "published");
    assert.equal(uploaded.publishedStructuralRevision, 1);
    assert.equal(uploaded.blueprint, null);
    assert.equal(result.published, true);
});

test("publishing preserves each floor and the selected floor in the saved project JSON", async () => {
    const { calls, dependencies } = createDependencies();
    const projectData = {
        ...emptyStructure,
        floors: [
            {
                floorId: "floor-one",
                name: "1st Floor",
                structure: {
                    corners: [],
                    walls: [],
                    doors: [],
                    windows: [],
                    openings: []
                }
            },
            {
                floorId: "floor-two",
                name: "2nd Floor",
                structure: {
                    corners: [{ id: "corner-two", position: { x: 1, y: 0, z: 1 } }],
                    walls: [],
                    doors: [],
                    windows: [],
                    openings: []
                }
            }
        ],
        activeFloorId: "floor-two"
    };

    await publishManagedStructure({
        ownerId: "client-a",
        projectName: "Multi-floor plan",
        projectData
    }, dependencies);

    const uploaded = calls.find(item => typeof item === "object" && "data" in item).data;
    assert.deepEqual(uploaded.floors.map(floor => floor.floorId), ["floor-one", "floor-two"]);
    assert.equal(uploaded.floors[1].structure.corners[0].id, "corner-two");
    assert.equal(uploaded.activeFloorId, "floor-two");
});

test("publishing refuses an existing designated project before allocating or uploading", async () => {
    const { calls, dependencies } = createDependencies({
        findExistingProject: async () => {
            calls.push("find-existing");
            return "PRJ-OLD";
        }
    });

    await assert.rejects(
        publishManagedStructure({
            ownerId: "client-a",
            projectName: "Another plan",
            projectData: emptyStructure
        }, dependencies),
        /already has designated project PRJ-OLD/
    );
    assert.deepEqual(calls, ["find-existing"]);
});

test("failed publish commit cleans up the uploaded object and never reports success", async () => {
    const { calls, dependencies } = createDependencies({
        commit: async () => {
            calls.push("commit");
            throw new Error("assignment changed during publish");
        }
    });

    await assert.rejects(
        publishManagedStructure({
            ownerId: "client-a",
            projectName: "Draft",
            projectData: emptyStructure
        }, dependencies),
        /assignment changed during publish/
    );
    assert.ok(calls.includes("cleanup"));
});

test("invalid structure is rejected before upload or metadata commit", async () => {
    const { calls, dependencies } = createDependencies();

    await assert.rejects(
        publishManagedStructure({
            ownerId: "client-a",
            projectName: "Invalid",
            projectData: { ...emptyStructure, walls: undefined }
        }, dependencies),
        /Invalid managed structure/
    );
    assert.equal(calls.includes("upload"), false);
    assert.equal(calls.includes("commit"), false);
});
