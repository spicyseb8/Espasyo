import assert from "node:assert/strict";
import test from "node:test";
import {
    getProjectWorkflowType,
    findSingleManagedProjectId,
    isPublishedManagedProject,
    validateStructuralProjectData
} from "./projectStructureContract.ts";
import {
    createManagedEditorFloor,
    createManagedStructure,
    loadManagedEditorFloors,
    serializeManagedStructureProject
} from "../../components/project-editor/structureTypes.ts";

test("missing workflow metadata defaults to legacy", () => {
    assert.equal(getProjectWorkflowType(undefined), "legacy");
    assert.equal(getProjectWorkflowType({}), "legacy");
});

test("admin-managed projects require explicit published revision", () => {
    assert.equal(isPublishedManagedProject({ workflowType: "admin-managed", structuralStatus: "published", publishedStructuralRevision: 2 }), true);
    assert.equal(isPublishedManagedProject({ workflowType: "admin-managed", structuralStatus: "draft", publishedStructuralRevision: 2 }), false);
});

test("managed project selection reuses a single client project and rejects conflicts", () => {
    const projects = [
        { projectId: "legacy", ownerId: "client-1", workflowType: "legacy" },
        { projectId: "managed", ownerId: "client-1", workflowType: "admin-managed" },
        { projectId: "other-client", ownerId: "client-2", workflowType: "admin-managed" }
    ];

    assert.equal(findSingleManagedProjectId(projects, "client-1"), "managed");
    assert.equal(findSingleManagedProjectId(projects, "client-3"), null);
    assert.throws(
        () => findSingleManagedProjectId([
            ...projects,
            { projectId: "duplicate", ownerId: "client-1", workflowType: "admin-managed" }
        ], "client-1"),
        /multiple admin-managed projects/
    );
});

test("managed structural validation accepts runtime-independent geometry and legacy JSON remains compatible", () => {
    const managed = {
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralRevision: 1,
        structuralStatus: "published",
        publishedStructuralRevision: 1,
        blueprint: null,
        corners: [{ id: "corner-a", position: { x: 0, y: 0, z: 0 } }],
        walls: [{ id: "wall-a", start: { id: "corner-a", position: { x: 0, y: 0, z: 0 } }, end: { id: "corner-a", position: { x: 1, y: 0, z: 0 } } }],
        doors: [],
        windows: [],
        openings: []
    };

    assert.deepEqual(validateStructuralProjectData(managed), []);

    assert.deepEqual(validateStructuralProjectData({
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: []
    }), []);
});

test("managed validation rejects temporary blueprint runtime data", () => {
    const errors = validateStructuralProjectData({
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralRevision: 1,
        blueprint: { url: "blob:temporary-blueprint" },
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: []
    });

    assert.ok(errors.some(error => error.includes("blueprint runtime data")));
});

test("multi-floor serialization and loading preserve independent geometry and legacy projects", () => {
    const firstStructure = createManagedStructure("project-1", "Plan", "client-1");
    firstStructure.corners.push({
        id: "first-corner",
        position: { x: 0, y: 0, z: 0 }
    });
    const firstFloor = createManagedEditorFloor(firstStructure, 0);
    const secondFloor = createManagedEditorFloor(
        createManagedStructure("project-1", "Plan", "client-1"),
        1
    );
    const serialized = serializeManagedStructureProject(
        [firstFloor, secondFloor],
        secondFloor.floorId,
        "Plan",
        "2026-10-29T00:00:00.000Z"
    );

    assert.equal(firstFloor.name, "1st Floor");
    assert.equal(secondFloor.name, "2nd Floor");
    assert.notEqual(firstFloor.floorId, secondFloor.floorId);
    assert.equal(serialized.corners[0].id, "first-corner");
    assert.equal(serialized.floors[1].structure.corners.length, 0);
    assert.equal(serialized.floors[1].structure.walls.length, 0);
    assert.equal(serialized.floors[1].structure.doors.length, 0);
    assert.equal(serialized.floors[1].structure.windows.length, 0);
    assert.equal(serialized.floors[1].structure.openings.length, 0);
    assert.equal(serialized.activeFloorId, secondFloor.floorId);
    assert.deepEqual(validateStructuralProjectData(serialized), []);

    const loaded = loadManagedEditorFloors(serialized);
    assert.equal(loaded.activeFloorId, secondFloor.floorId);
    assert.equal(loaded.floors[0].structure.corners[0].id, "first-corner");
    assert.equal(loaded.floors[1].structure.corners.length, 0);
    loaded.floors[1].structure.corners.push({
        id: "second-corner",
        position: { x: 1, y: 0, z: 1 }
    });
    assert.equal(loaded.floors[0].structure.corners.length, 1);

    const legacy = loadManagedEditorFloors(firstStructure);
    assert.equal(legacy.floors.length, 1);
    assert.equal(legacy.floors[0].name, "1st Floor");
    assert.equal(legacy.floors[0].structure.corners[0].id, "first-corner");
});

test("blank floor initialization creates empty independent structural collections and unique floor IDs", () => {
    const projectId = "project-1";
    const ownerId = "client-1";
    const first = createManagedEditorFloor(
        createManagedStructure(projectId, "Plan", ownerId),
        0
    );
    const second = createManagedEditorFloor(
        createManagedStructure(projectId, "Plan", ownerId),
        1
    );

    assert.notEqual(first.floorId, second.floorId);
    for (const floor of [first, second]) {
        assert.deepEqual(floor.structure.corners, []);
        assert.deepEqual(floor.structure.walls, []);
        assert.deepEqual(floor.structure.doors, []);
        assert.deepEqual(floor.structure.windows, []);
        assert.deepEqual(floor.structure.openings, []);
        assert.deepEqual(floor.structure.furniture, []);
        assert.deepEqual(floor.structure.floorFinishes, {});
        assert.deepEqual(floor.structure.wallFinishes, {});
    }
});

test("multi-floor validation rejects duplicate floor IDs and invalid active floor references", () => {
    const structure = createManagedStructure("project-1", "Plan", "client-1");
    const first = createManagedEditorFloor(structure, 0, "floor-1");
    const second = createManagedEditorFloor(
        createManagedStructure("project-1", "Plan", "client-1"),
        1,
        "floor-1"
    );
    const project = serializeManagedStructureProject(
        [first, second],
        "missing-floor",
        "Plan",
        "2026-10-29T00:00:00.000Z"
    );
    project.activeFloorId = "missing-floor";

    const errors = validateStructuralProjectData(project);
    assert.ok(errors.some(error => error.includes("must be unique")));
    assert.ok(errors.some(error => error.includes("activeFloorId")));
});
