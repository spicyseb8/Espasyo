import assert from "node:assert/strict";
import test from "node:test";

import {
  findExistingFloorPlan,
  isFloorPlanClientAccount,
} from "./floorplan-client-eligibility.js";

const noAssignments = [];

function existingFor(identifier, options = {}) {
  return findExistingFloorPlan({
    identifiers: [identifier, "account-id"],
    projects: options.projects ?? [],
    drafts: options.drafts ?? [],
    assignments: options.assignments ?? noAssignments,
  });
}

test("a client without a floor plan remains eligible regardless of account status", () => {
  for (const accountStatus of [undefined, "active", "inactive", "suspended", "legacy-value"]) {
    assert.equal(
      isFloorPlanClientAccount({ account_status: accountStatus }, ["client-uid"], new Set()),
      true,
    );
    assert.deepEqual(existingFor("client-uid"), { projectId: null, draftId: null });
  }
});

test("client account IDs and Auth UIDs both identify an existing draft", () => {
  assert.deepEqual(existingFor("client-uid", {
    drafts: [{
      id: "draft-1",
      intendedClientId: "account-id",
      structuralStatus: "draft",
    }],
  }), { projectId: null, draftId: "draft-1" });
});

test("published and approved project records remain unavailable and viewable", () => {
  for (const projectStatus of ["published", "approved"]) {
    const result = existingFor("client-uid", {
      projects: [{
        id: `project-${projectStatus}`,
        ownerId: "client-uid",
        projectStatus,
      }],
    });
    assert.deepEqual(result, {
      projectId: `project-${projectStatus}`,
      draftId: null,
    });
  }
});

test("admin and employee accounts are never eligible clients", () => {
  for (const role of ["admin", "superadmin", "employee"]) {
    assert.equal(
      isFloorPlanClientAccount({ role }, ["account-id"], new Set()),
      false,
    );
  }
  assert.equal(
    isFloorPlanClientAccount({}, ["employee-uid"], new Set(["employee-uid"])),
    false,
  );
});

test("different clients remain independently eligible", () => {
  const result = existingFor("client-two", {
    projects: [{ id: "project-one", ownerId: "client-one" }],
    drafts: [{ id: "draft-one", intendedClientId: "client-one" }],
  });
  assert.deepEqual(result, { projectId: null, draftId: null });
});

test("valid assignments expose their existing projects and drafts for viewing", () => {
  assert.deepEqual(existingFor("client-uid", {
    projects: [{ id: "assigned-project", ownerId: "client-uid" }],
    drafts: [{ id: "assigned-draft", intendedClientId: "client-uid" }],
    assignments: [{
      ownerId: "client-uid",
      projectId: "assigned-project",
      draftId: "assigned-draft",
    }],
  }), { projectId: "assigned-project", draftId: "assigned-draft" });
});

test("missing, malformed, and unrelated assignment links do not hide an eligible client", () => {
  assert.deepEqual(existingFor("client-uid", {
    assignments: [
      { ownerId: "client-uid", status: "draft" },
      { ownerId: "client-uid", projectId: "missing-project" },
      { ownerId: "client-uid", draftId: "other-client-draft" },
    ],
    drafts: [{
      id: "other-client-draft",
      intendedClientId: "client-two",
    }],
  }), { projectId: null, draftId: null });
});
