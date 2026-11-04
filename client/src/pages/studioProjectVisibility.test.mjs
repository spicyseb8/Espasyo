import assert from "node:assert/strict";
import test from "node:test";
import { isAvailableStudioProject } from "./studioProjectVisibility.ts";

test("Studio lists published admin-managed projects", () => {
    assert.equal(isAvailableStudioProject({
        workflowType: "admin-managed",
        structuralStatus: "published",
        publishedStructuralRevision: 3
    }), true);
});

test("Studio hides unpublished and invalid admin-managed projects", () => {
    assert.equal(isAvailableStudioProject({
        workflowType: "admin-managed",
        structuralStatus: "draft",
        publishedStructuralRevision: 3
    }), false);
    assert.equal(isAvailableStudioProject({
        workflowType: "admin-managed",
        structuralStatus: "published",
        publishedStructuralRevision: 0
    }), false);
});

test("Studio keeps supported legacy projects available", () => {
    assert.equal(isAvailableStudioProject({
        projectId: "legacy-project"
    }), true);
});
