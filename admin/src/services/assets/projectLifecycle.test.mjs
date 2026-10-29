import assert from "node:assert/strict";
import test from "node:test";
import {
    classifyProjectLifecycle,
    getAvailableFloorPlanProjects,
    getClientDesignedProjects,
    getInitialClientDesignLifecycle,
    hasMeaningfulInteriorData,
    isProjectAssignedToOwner
} from "./projectLifecycle.ts";

const publishedProject = {
    projectId: "PRJ-00126",
    ownerId: "client-uid",
    workflowType: "admin-managed",
    structuralStatus: "published",
    publishedStructuralRevision: 4
};

test("newly published assigned floor plans are available and not in client management", () => {
    assert.equal(classifyProjectLifecycle(publishedProject, "PRJ-00126"), "available");
    const projects = [
        { ...publishedProject, lifecycleStatus: "available" },
        { ...publishedProject, projectId: "PRJ-2", lifecycleStatus: "client-designed" },
        { projectId: "legacy", ownerId: "old-owner", lifecycleStatus: "legacy" }
    ];
    assert.deepEqual(getAvailableFloorPlanProjects(projects).map(item => item.projectId), ["PRJ-00126"]);
    assert.deepEqual(
        getClientDesignedProjects(projects).map(item => item.projectId),
        ["PRJ-2", "legacy"]
    );
    assert.deepEqual(getInitialClientDesignLifecycle(undefined), { clientDesignStarted: false });
    assert.deepEqual(getInitialClientDesignLifecycle(true), {});
    assert.deepEqual(getInitialClientDesignLifecycle(false), {});
});

test("meaningful furniture and finishes classify a project as client-designed", () => {
    const interior = {
        furniture: [{ id: "placed-chair", assetId: "asset-chair" }]
    };
    assert.equal(hasMeaningfulInteriorData({
        furniture: [{ id: "placed-chair", assetId: "asset-chair" }]
    }), true);
    assert.equal(hasMeaningfulInteriorData({
        floorFinishes: { room: "tile-id" }
    }), true);
    assert.equal(hasMeaningfulInteriorData({
        wallFinishes: { room: { wall: "paint-id" } }
    }), true);
    assert.equal(classifyProjectLifecycle(publishedProject, "PRJ-00126", interior), "client-designed");
    assert.equal(classifyProjectLifecycle({
        ...publishedProject,
        clientDesignStarted: false
    }, "PRJ-00126", interior), "available");
});

test("empty interior save and opening without a save do not advance lifecycle", () => {
    assert.equal(hasMeaningfulInteriorData({
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        costEstimate: { total: 0 }
    }), false);
    assert.equal(classifyProjectLifecycle(publishedProject, "PRJ-00126", {
        furniture: [],
        floorFinishes: {},
        wallFinishes: {}
    }), "available");
});

test("assignment, publication, and owner are required for managed classifications", () => {
    assert.equal(classifyProjectLifecycle(publishedProject, null), "unverified");
    assert.equal(classifyProjectLifecycle(publishedProject, "other-project"), "unverified");
    assert.equal(classifyProjectLifecycle({
        ...publishedProject,
        structuralStatus: "draft"
    }, "PRJ-00126"), "unverified");
    assert.equal(isProjectAssignedToOwner("client-uid", "PRJ-00126", {
        ownerId: "client-uid",
        projectId: "PRJ-00126"
    }), true);
    assert.equal(isProjectAssignedToOwner("client-uid", "PRJ-00126", {
        ownerId: "another-client",
        projectId: "PRJ-00126"
    }), false);
});

test("legacy projects are kept out of admin-managed lifecycle buckets", () => {
    assert.equal(classifyProjectLifecycle({
        projectId: "old-project",
        ownerId: "client-uid",
        workflowType: "legacy"
    }, null, { furniture: [{ id: "chair", assetId: "chair-asset" }] }), "legacy");
    assert.equal(classifyProjectLifecycle({
        projectId: "old-project",
        ownerId: "client-uid"
    }, null), "legacy");
});
