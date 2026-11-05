import assert from "node:assert/strict";
import test from "node:test";

import {
  createReservedFloorPlanDraft,
  FLOORPLAN_ALREADY_EXISTS_MESSAGE,
} from "./floorplan-reservation.js";

function createMemoryDb(seed = {}) {
  const records = new Map(Object.entries(seed));
  let queue = Promise.resolve();
  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            key: `${name}/${id}`,
            collection: name,
            id,
            async get() {
              const value = records.get(`${name}/${id}`);
              return { exists: value !== undefined, data: () => value };
            },
          };
        },
        where(field, _operator, value) {
          return {
            limit() {
              return { collection: name, field, value };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      let release;
      const previous = queue;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      const writes = [];
      try {
        const result = await callback({
          async get(reference) {
            if (reference.collection) {
              if (reference.field === undefined) {
                const value = records.get(`${reference.collection}/${reference.id}`);
                return {
                  exists: value !== undefined,
                  data: () => value,
                  key: reference.key,
                };
              }
              const matching = [...records.entries()].filter(([key, data]) =>
                key.startsWith(`${reference.collection}/`) &&
                data[reference.field] === reference.value
              );
              return { docs: matching.slice(0, 1).map(([id, data]) => ({ id, data: () => data })) };
            }
            const value = records.get(reference.key);
            return { exists: value !== undefined, data: () => value, key: reference.key };
          },
          create(reference, value) {
            writes.push(stagedRecords => {
              if (stagedRecords.has(reference.key)) {
                const error = new Error("already exists");
                error.code = 6;
                throw error;
              }
              stagedRecords.set(reference.key, value);
            });
          },
          set(reference, value) {
            writes.push(stagedRecords => {
              stagedRecords.set(reference.key, value);
            });
          },
        });
        const stagedRecords = new Map(records);
        for (const write of writes) write(stagedRecords);
        records.clear();
        for (const [key, value] of stagedRecords) records.set(key, value);
        return result;
      } finally {
        release();
      }
    },
    get records() {
      return records;
    },
  };
  return db;
}

function draft(ownerId, draftId) {
  return {
    ownerId,
    draftId,
    draftRecord: { draftId, intendedClientId: ownerId, createdBy: "admin-1" },
    assignmentReference: {
      key: `adminManagedProjectAssignments/${encodeURIComponent(ownerId)}`,
    },
  };
}

test("the first floor plan reserves its client and creates a draft", async () => {
  const db = createMemoryDb();
  await createReservedFloorPlanDraft(db, draft("client-1", "draft-1"));
  assert.equal(db.records.get("adminManagedFloorPlanDrafts/draft-1").intendedClientId, "client-1");
  assert.equal(
    db.records.get("adminManagedProjectAssignments/client-1").status,
    "draft",
  );
});

test("all project lifecycle states and legacy owner records block another floor plan", async t => {
  for (const status of [
    "draft",
    "published",
    "ongoing",
    "submitted",
    "revision-requested",
    "approved",
    "legacy",
  ]) {
    await t.test(status, async () => {
      const db = createMemoryDb({
        [`projects/project-${status}`]: { ownerId: "client-1", projectStatus: status },
      });
      await assert.rejects(
        createReservedFloorPlanDraft(db, draft("client-1", "new-draft")),
        { status: 409, message: FLOORPLAN_ALREADY_EXISTS_MESSAGE },
      );
    });
  }
});

test("an existing unpublished draft blocks a second draft", async () => {
  const db = createMemoryDb({
    "adminManagedFloorPlanDrafts/old-draft": {
      intendedClientId: "client-1",
      structuralStatus: "draft",
    },
  });
  await assert.rejects(
    createReservedFloorPlanDraft(db, draft("client-1", "new-draft")),
    { status: 409 },
  );
});

test("legacy assignments and owner IDs stored as account document IDs block new drafts", async () => {
  const legacyProjectDb = createMemoryDb({
    "projects/legacy-project": { ownerId: "client-account-document" },
  });
  await assert.rejects(
    createReservedFloorPlanDraft(legacyProjectDb, {
      ...draft("client-1", "new-draft"),
      additionalOwnerIds: ["client-account-document"],
    }),
    { status: 409 },
  );

  const assignmentDb = createMemoryDb({
    "adminManagedProjectAssignments/client-1": {
      ownerId: "client-1",
      projectId: "legacy-assignment-project",
    },
    "projects/legacy-assignment-project": {
      projectName: "Legacy assigned project",
    },
  });
  await assert.rejects(
    createReservedFloorPlanDraft(assignmentDb, draft("client-1", "new-draft")),
    { status: 409 },
  );
});

test("malformed and orphaned assignment reservations do not block a client", async () => {
  const db = createMemoryDb({
    "adminManagedProjectAssignments/client-1": {
      ownerId: "client-1",
      status: "draft",
    },
  });
  await createReservedFloorPlanDraft(db, draft("client-1", "new-draft"));
  assert.equal(
    db.records.get("adminManagedProjectAssignments/client-1").draftId,
    "new-draft",
  );
  assert.equal(db.records.get("adminManagedFloorPlanDrafts/new-draft").intendedClientId, "client-1");
});

test("failed draft creation leaves no reservation behind", async () => {
  const db = createMemoryDb({
    "adminManagedFloorPlanDrafts/new-draft": { draftId: "new-draft" },
  });
  await assert.rejects(createReservedFloorPlanDraft(db, draft("client-1", "new-draft")));
  assert.equal(db.records.has("adminManagedProjectAssignments/client-1"), false);
});

test("different clients can reserve independent floor plans", async () => {
  const db = createMemoryDb();
  await Promise.all([
    createReservedFloorPlanDraft(db, draft("client-1", "draft-1")),
    createReservedFloorPlanDraft(db, draft("client-2", "draft-2")),
  ]);
  assert.equal(db.records.size, 4);
});

test("concurrent admins cannot reserve a second floor plan for one client", async () => {
  const db = createMemoryDb();
  const results = await Promise.allSettled([
    createReservedFloorPlanDraft(db, draft("client-1", "draft-1")),
    createReservedFloorPlanDraft(db, draft("client-1", "draft-2")),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(db.records.size, 2);
});
