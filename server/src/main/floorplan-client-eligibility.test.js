import assert from "node:assert/strict";
import test from "node:test";

import {
  countExistingFloorPlans,
  isFloorPlanClientAccount,
} from "./floorplan-client-eligibility.js";

test("counts all projects and unpublished drafts associated with either account ID", () => {
  assert.equal(countExistingFloorPlans({
    identifiers: ["client-uid", "account-id"],
    projects: [
      { id: "project-one", ownerId: "client-uid" },
      { id: "project-two", ownerId: "account-id" },
      { id: "other-project", ownerId: "client-two" },
    ],
    drafts: [
      { id: "draft-one", intendedClientId: "client-uid" },
      { id: "draft-two", intendedClientId: "account-id" },
    ],
  }), 4);
});

test("does not count a published draft twice when its project exists", () => {
  assert.equal(countExistingFloorPlans({
    identifiers: ["client-uid"],
    projects: [{ id: "project-one", ownerId: "client-uid" }],
    drafts: [
      { id: "draft-one", intendedClientId: "client-uid", publishedProjectId: "project-one" },
      { id: "draft-two", intendedClientId: "client-uid", publishedProjectId: "missing-project" },
    ],
  }), 2);
});

test("clients remain eligible regardless of account status but employee roles are excluded", () => {
  for (const accountStatus of [undefined, "active", "inactive", "suspended", "legacy-value"]) {
    assert.equal(
      isFloorPlanClientAccount({ account_status: accountStatus }, ["client-uid"], new Set()),
      true,
    );
  }
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
