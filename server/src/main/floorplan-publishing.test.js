import assert from "node:assert/strict";
import test from "node:test";

import {
  commitPublishedFloorPlan,
  createPublishedFloorPlanRecord,
  hasProjectIdCollision,
  isDraftPublishSnapshotCurrent,
  isProjectStructureSnapshotCurrent,
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
let activitySequence = 0;

test("publishing rejects a stale draft revision or storage path", () => {
  const initial = { structuralRevision: 3, draftJsonPath: "draft-r3.json" };
  assert.equal(isDraftPublishSnapshotCurrent(initial, { ...initial }), true);
  assert.equal(
    isDraftPublishSnapshotCurrent(initial, { ...initial, structuralRevision: 4 }),
    false,
  );
  assert.equal(
    isDraftPublishSnapshotCurrent(initial, { ...initial, draftJsonPath: "draft-r4.json" }),
    false,
  );
});

test("structure saves reject a stale revision, lifecycle, or draft path", () => {
  const initial = {
    structuralRevision: 3,
    publishedStructuralRevision: 2,
    structuralStatus: "published",
    draftJsonPath: "draft-r3.json",
  };
  assert.equal(isProjectStructureSnapshotCurrent(initial, { ...initial }), true);
  for (const change of [
    { structuralRevision: 4 },
    { publishedStructuralRevision: 3 },
    { structuralStatus: "draft" },
    { draftJsonPath: "draft-r4.json" },
  ]) {
    assert.equal(
      isProjectStructureSnapshotCurrent(initial, { ...initial, ...change }),
      false,
    );
  }
});

test("publishing rejects a project ID already used by either record", () => {
  assert.equal(
    hasProjectIdCollision({ exists: false }, { exists: false }),
    false,
  );
  assert.equal(
    hasProjectIdCollision({ exists: true }, { exists: false }),
    true,
  );
  assert.equal(
    hasProjectIdCollision({ exists: false }, { exists: true }),
    true,
  );
});

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
        delete(reference) {
          pending.push({ type: "delete", reference });
        },
      };

      const result = await callback(transaction);
      for (const operation of pending) {
        operations.push(operation);
        const key = operation.reference;
        if (operation.type === "delete") {
          records.delete(key);
        } else if (operation.type === "create") {
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

function writePublication(transaction, {
  projectId = PROJECT_ID,
  draftId = DRAFT_ID,
  ownerId = OWNER_ID,
  projectName = "Sample floor plan",
  projectRecord = createProjectRecord(),
} = {}) {
  commitPublishedFloorPlan(transaction, {
    projectReference: `projects/${projectId}`,
    draftAssignmentReference: `adminManagedProjectAssignments/draft_${draftId}`,
    projectAssignmentReference: `adminManagedProjectAssignments/project_${projectId}`,
    draftReference: `adminManagedFloorPlanDrafts/${draftId}`,
    projectRecord,
    assignmentRecord: {
      ownerId,
      projectId,
      status: "published",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    projectId,
    ownerId,
    projectName,
    deadline: DEADLINE,
    revision: 3,
    actor: { uid: "admin-uid", role: "admin", name: "Admin" },
    timestamp: TIMESTAMP,
    recordActivity: (currentTransaction, projectId, actor, action, details) => {
      activitySequence += 1;
      currentTransaction.create(`projectActivity/${activitySequence}`, {
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
    [`adminManagedProjectAssignments/draft_${DRAFT_ID}`]: {
      ownerId: OWNER_ID,
      draftId: DRAFT_ID,
      status: "draft",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
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
  assert.deepEqual(records.get(`adminManagedProjectAssignments/project_${PROJECT_ID}`), {
    ownerId: OWNER_ID,
    projectId: PROJECT_ID,
    status: "published",
    createdBy: "admin-uid",
    creatorName: "Admin",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  assert.equal(records.has(`adminManagedProjectAssignments/draft_${DRAFT_ID}`), false);
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
    [`adminManagedProjectAssignments/draft_${DRAFT_ID}`]: {
      ownerId: OWNER_ID,
      draftId: DRAFT_ID,
      status: "draft",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
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

test("publishing one plan leaves another draft intact and both plans can publish", async () => {
  const secondDraftId = "draft-2";
  const secondProjectId = "PRJ-26002";
  const { db, records } = createTransactionHarness({
    [`adminManagedProjectAssignments/draft_${DRAFT_ID}`]: {
      ownerId: OWNER_ID,
      draftId: DRAFT_ID,
      status: "draft",
    },
    [`adminManagedProjectAssignments/draft_${secondDraftId}`]: {
      ownerId: OWNER_ID,
      draftId: secondDraftId,
      status: "draft",
    },
    [`adminManagedFloorPlanDrafts/${DRAFT_ID}`]: { projectName: "Ground floor" },
    [`adminManagedFloorPlanDrafts/${secondDraftId}`]: { projectName: "Second floor" },
  });

  await db.runTransaction(transaction => writePublication(transaction, {
    projectName: "Ground floor",
  }));
  assert.equal(records.has(`adminManagedProjectAssignments/draft_${secondDraftId}`), true);

  await db.runTransaction(transaction => writePublication(transaction, {
    projectId: secondProjectId,
    draftId: secondDraftId,
    projectName: "Second floor",
    projectRecord: createPublishedFloorPlanRecord({
      projectId: secondProjectId,
      projectName: "Second floor",
      ownerId: OWNER_ID,
      revision: 3,
      deadline: DEADLINE,
      jsonPath: `projects/${OWNER_ID}/${secondProjectId}/published-r3-file.json`,
      createdBy: "admin-uid",
      creatorName: "Admin",
      timestamp: TIMESTAMP,
    }),
  }));

  assert.equal(records.get(`adminManagedProjectAssignments/project_${PROJECT_ID}`).ownerId, OWNER_ID);
  assert.equal(records.get(`adminManagedProjectAssignments/project_${secondProjectId}`).ownerId, OWNER_ID);
  assert.equal(records.get(`adminManagedFloorPlanDrafts/${secondDraftId}`).publishedProjectId, secondProjectId);
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
