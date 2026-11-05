import assert from "node:assert/strict";
import test from "node:test";

import {
  commitPublishedFloorPlan,
  createPublishedFloorPlanRecord,
} from "./floorplan-publishing.js";
import { resolveManagedProjectFilePath } from "./managed-project-file-access.js";

const DELETE_FIELD = Object.freeze({ sentinel: "delete" });
const TIMESTAMP = Object.freeze({ sentinel: "server-timestamp" });
const PROJECT_ID = "PRJ-26001";
const DRAFT_ID = "draft-1";
const OWNER_ID = "client-auth-uid";
const DEADLINE = "2026-12-01T18:00";
const PUBLISHED_PATH =
  `projects/${OWNER_ID}/${PROJECT_ID}/published-r3-123e4567-e89b-42d3-a456-426614174000.json`;

function createProjectRecord() {
  return createPublishedFloorPlanRecord({
    projectId: PROJECT_ID,
    projectName: "Sample floor plan",
    ownerId: OWNER_ID,
    revision: 3,
    deadline: DEADLINE,
    jsonPath: PUBLISHED_PATH,
    createdBy: "admin-uid",
    creatorName: "Admin",
    timestamp: TIMESTAMP,
  });
}

function hasDeleteSentinel(value) {
  if (value === DELETE_FIELD) return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasDeleteSentinel);
}

function createTransactionHarness(seed = {}) {
  const records = new Map(Object.entries(seed));
  const operations = [];

  const db = {
    async runTransaction(callback) {
      const pending = [];
      const transaction = {
        set(reference, data, options) {
          pending.push({ type: "set", reference, data, options });
        },
        create(reference, data) {
          if (hasDeleteSentinel(data)) {
            throw new Error("Delete sentinel cannot be used in a created document.");
          }
          pending.push({ type: "create", reference, data });
        },
      };

      const result = await callback(transaction);
      for (const operation of pending) {
        operations.push(operation);
        const key = operation.reference;
        if (operation.type === "create") {
          if (records.has(key)) throw new Error(`Document already exists: ${key}`);
          records.set(key, operation.data);
        } else {
          const current = records.get(key) ?? {};
          const next = { ...current, ...operation.data };
          if (next.draftId === DELETE_FIELD) delete next.draftId;
          records.set(key, next);
        }
      }
      return result;
    },
  };

  return { db, records, operations };
}

function writePublication(transaction, projectRecord = createProjectRecord()) {
  let activityIndex = 0;
  commitPublishedFloorPlan(transaction, {
    projectReference: `projects/${PROJECT_ID}`,
    assignmentReference: `adminManagedProjectAssignments/${OWNER_ID}`,
    draftReference: `adminManagedFloorPlanDrafts/${DRAFT_ID}`,
    projectRecord,
    projectId: PROJECT_ID,
    ownerId: OWNER_ID,
    projectName: "Sample floor plan",
    deadline: DEADLINE,
    revision: 3,
    actor: { uid: "admin-uid", role: "admin", name: "Admin" },
    timestamp: TIMESTAMP,
    deleteField: DELETE_FIELD,
    recordActivity: (currentTransaction, projectId, actor, action, details) => {
      activityIndex += 1;
      currentTransaction.create(`projectActivity/${activityIndex}`, {
        projectId,
        actorId: actor.uid,
        actorRole: actor.role,
        action,
        ...details,
      });
    },
  });
}

test("publishing creates a project without the legacy jsonUrl delete sentinel", async () => {
  const { db, records } = createTransactionHarness({
    [`adminManagedProjectAssignments/${OWNER_ID}`]: {
      ownerId: OWNER_ID,
      draftId: DRAFT_ID,
      status: "draft",
    },
    [`adminManagedFloorPlanDrafts/${DRAFT_ID}`]: {
      projectName: "Sample floor plan",
      intendedClientId: OWNER_ID,
    },
  });

  await db.runTransaction(transaction => {
    writePublication(transaction);
  });

  const project = records.get(`projects/${PROJECT_ID}`);
  assert.ok(project);
  assert.equal(Object.hasOwn(project, "jsonUrl"), false);
  assert.equal(hasDeleteSentinel(project), false);
  assert.deepEqual(project, {
    projectId: PROJECT_ID,
    projectName: "Sample floor plan",
    ownerId: OWNER_ID,
    schemaVersion: 1,
    workflowType: "admin-managed",
    structuralOwner: "admin",
    structuralStatus: "published",
    projectStatus: "available",
    structuralRevision: 3,
    publishedStructuralRevision: 3,
    deadline: DEADLINE,
    clientDesignStarted: false,
    structureInitialized: true,
    jsonPath: PUBLISHED_PATH,
    createdBy: "admin-uid",
    creatorName: "Admin",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  assert.deepEqual(records.get(`adminManagedProjectAssignments/${OWNER_ID}`), {
    ownerId: OWNER_ID,
    projectId: PROJECT_ID,
    status: "published",
    updatedAt: TIMESTAMP,
  });
  assert.equal(
    records.get(`adminManagedFloorPlanDrafts/${DRAFT_ID}`).publishedProjectId,
    PROJECT_ID,
  );
  const activityRecords = [...records.entries()]
    .filter(([key]) => key.startsWith("projectActivity/"))
    .map(([, record]) => record);
  assert.deepEqual(activityRecords.map(activity => activity.action), [
    "floor-plan-published",
    "project-assigned",
  ]);
  assert.ok(activityRecords.every(activity => activity.projectId === PROJECT_ID));
});

test("failed publication transaction leaves the draft reservation intact and creates no project", async () => {
  const seed = {
    [`adminManagedProjectAssignments/${OWNER_ID}`]: {
      ownerId: OWNER_ID,
      draftId: DRAFT_ID,
      status: "draft",
    },
    [`adminManagedFloorPlanDrafts/${DRAFT_ID}`]: {
      projectName: "Sample floor plan",
      intendedClientId: OWNER_ID,
    },
  };
  const { db, records, operations } = createTransactionHarness(seed);

  await assert.rejects(db.runTransaction(async transaction => {
    writePublication(transaction);
    throw new Error("Simulated transaction failure.");
  }), /Simulated transaction failure/);

  assert.deepEqual(Object.fromEntries(records), seed);
  assert.equal(operations.length, 0);
  assert.equal([...records.keys()].filter(key => key.startsWith("projectActivity/")).length, 0);
});

test("legacy project documents remain readable when jsonUrl is absent", () => {
  const legacyProject = {
    projectId: "legacy-project",
    ownerId: OWNER_ID,
    workflowType: "admin-managed",
    structuralStatus: "published",
    publishedStructuralRevision: 1,
    jsonPath: `projects/${OWNER_ID}/legacy-project.json`,
  };
  assert.equal(Object.hasOwn(legacyProject, "jsonUrl"), false);
  assert.equal(
    resolveManagedProjectFilePath({
      project: legacyProject,
      projectId: "legacy-project",
      ownerId: OWNER_ID,
      kind: "structure",
    }),
    legacyProject.jsonPath,
  );
});
