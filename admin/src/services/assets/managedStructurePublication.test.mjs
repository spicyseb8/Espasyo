import assert from "node:assert/strict";
import test from "node:test";
import { serializeManagedStructureProject } from "../../components/project-editor/structureTypes.ts";
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

test("publishing preserves procedural staircase parameters and cross-floor connections", async () => {
    const { calls, dependencies } = createDependencies();
    const shapes = [
        { id: "stair-straight", shape: "straight", width: 1.2 },
        { id: "stair-l", shape: "l-shaped", width: 2.4, turnDirection: "right" },
        { id: "stair-u", shape: "u-shaped", width: 2.4 }
    ];
    const stairs = shapes.map((item, index) => ({
        ...item,
        floorId: "floor-one",
        destinationFloorId: "floor-two",
        stairConnectionId: `connection-${index}`,
        position: { x: index * 6, y: 0, z: 0 },
        rotationY: index * Math.PI / 2,
        totalRise: 3,
        riserCount: 16,
        treadDepth: 4 / 15,
        treadThickness: 0.04,
        railings: true
    }));
    const stairLandings = stairs.map((item, index) => ({
        id: `landing-${index}`,
        stairId: item.id,
        stairConnectionId: item.stairConnectionId,
        floorId: "floor-two",
        position: { ...item.position },
        rotationY: item.rotationY,
        width: item.width,
        run: 4
    }));

    const projectData = serializeManagedStructureProject([
        {
            floorId: "floor-one",
            name: "1st Floor",
            structure: {
                ...emptyStructure,
                blueprint: null,
                stairs,
                stairLandings: []
            }
        },
        {
            floorId: "floor-two",
            name: "2nd Floor",
            structure: {
                ...emptyStructure,
                blueprint: null,
                stairs: [],
                stairLandings
            }
        }
    ], "floor-one", "Staircase plan", emptyStructure.savedAt);
    await publishManagedStructure({
        ownerId: "client-a",
        projectName: "Staircase plan",
        projectData
    }, dependencies);

    const uploaded = calls.find(item => typeof item === "object" && "data" in item).data;
    const uploadedStairs = uploaded.floors[0].structure.stairs;
    assert.deepEqual(uploadedStairs.map(item => item.shape), [
        "straight",
        "l-shaped",
        "u-shaped"
    ]);
    assert.equal(uploadedStairs[1].turnDirection, "right");
    assert.equal(uploadedStairs[2].railings, true);
    assert.deepEqual(uploadedStairs.map(item => item.flights.length), [1, 2, 2]);
    assert.equal(uploadedStairs[0].flights[0].riserCount, 16);
    assert.equal(uploadedStairs[1].flights[1].direction.z, -1);
    assert.equal(uploadedStairs[2].flights[1].direction.x, -1);
    assert.equal(uploaded.floors[0].structure.stairLandings.length, 0);
    assert.deepEqual(
        uploaded.floors[1].structure.stairLandings.map(item => item.stairConnectionId),
        ["connection-0", "connection-1", "connection-2"]
    );
    assert.equal(uploadedStairs[1].position.x, 6);
    assert.equal(uploadedStairs[1].rotationY, Math.PI / 2);
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
