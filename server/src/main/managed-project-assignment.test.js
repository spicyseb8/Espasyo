import assert from "node:assert/strict";
import test from "node:test";

import { getAssignmentForPlan, planAssignmentReference } from "./managed-project-assignment.js";
import { isClientAssignedToPublishedProject } from "./managed-project-file-access.js";

const ASSIGNMENTS = "adminManagedProjectAssignments";

function createDb(seed = {}) {
  const records = new Map(Object.entries(seed));
  const db = {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            key,
            async get() {
              const value = records.get(key);
              return { exists: value !== undefined, data: () => value };
            },
          };
        },
      };
    },
    records,
  };
  return db;
}

function project(ownerId, projectId) {
  return {
    projectId,
    ownerId,
    workflowType: "admin-managed",
    structuralStatus: "published",
    publishedStructuralRevision: 1,
  };
}

test("resolves each project to its own assignment for one owner", async () => {
  const db = createDb({
    [`${ASSIGNMENTS}/project_project-a`]: { ownerId: "client-1", projectId: "project-a" },
    [`${ASSIGNMENTS}/project_project-b`]: { ownerId: "client-1", projectId: "project-b" },
  });
  const first = await getAssignmentForPlan(db, "project-a", "client-1");
  const second = await getAssignmentForPlan(db, "project-b", "client-1");

  assert.equal(isClientAssignedToPublishedProject(project("client-1", "project-a"), first.data(), "project-a", "client-1"), true);
  assert.equal(isClientAssignedToPublishedProject(project("client-1", "project-b"), second.data(), "project-b", "client-1"), true);
});

test("does not authorize a different owner's plan", async () => {
  const db = createDb({
    [`${ASSIGNMENTS}/project_project-a`]: { ownerId: "client-1", projectId: "project-a" },
  });
  const assignment = await getAssignmentForPlan(db, "project-a", "client-2");

  assert.equal(
    isClientAssignedToPublishedProject(project("client-2", "project-a"), assignment.data(), "project-a", "client-2"),
    false,
  );
});

test("falls back to matching UID and account-ID legacy assignments", async () => {
  const db = createDb({
    [`${ASSIGNMENTS}/client-1`]: { ownerId: "client-1", projectId: "legacy-project" },
    [`${ASSIGNMENTS}/account-doc-1`]: { ownerId: "client-1", draftId: "legacy-draft" },
  });
  const projectAssignment = await getAssignmentForPlan(db, "legacy-project", "client-1");
  const draftAssignment = await getAssignmentForPlan(db, "legacy-draft", "client-1", {
    planType: "draft",
    legacyOwnerIds: ["account-doc-1"],
  });

  assert.equal(projectAssignment.data().projectId, "legacy-project");
  assert.equal(draftAssignment.data().draftId, "legacy-draft");
});

test("uses the prescribed per-plan document IDs", () => {
  const db = createDb();
  assert.equal(planAssignmentReference(db, "draft-id", "draft").key, `${ASSIGNMENTS}/draft_draft-id`);
  assert.equal(planAssignmentReference(db, "PRJ-26001", "project").key, `${ASSIGNMENTS}/project_PRJ-26001`);
});
