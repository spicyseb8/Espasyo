import assert from "node:assert/strict";
import test from "node:test";
import {
    getProjectWorkflowType,
    findSingleManagedProjectId,
    isPublishedManagedProject,
    validateStructuralProjectData
} from "./projectStructureContract.ts";

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
