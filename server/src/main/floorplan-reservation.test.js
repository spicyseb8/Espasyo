import assert from "node:assert/strict";
import test from "node:test";

import {
  createReservedFloorPlanDraft,
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
    draftRecord: {
      draftId,
      intendedClientId: ownerId,
      createdBy: "admin-1",
      creatorName: "Admin",
      createdAt: "created",
      updatedAt: "updated",
    },
  };
}

test("a draft creates an assignment keyed by its draft ID", async () => {
  const db = createMemoryDb();
  await createReservedFloorPlanDraft(db, draft("client-1", "draft-1"));
  assert.equal(db.records.get("adminManagedFloorPlanDrafts/draft-1").intendedClientId, "client-1");
  assert.equal(
    db.records.get("adminManagedProjectAssignments/draft_draft-1").status,
    "draft",
  );
  assert.equal(
    db.records.get("adminManagedProjectAssignments/draft_draft-1").createdBy,
    "admin-1",
  );
});

test("existing projects and drafts do not block another draft for the same client", async () => {
  const db = createMemoryDb({
    "projects/old-project": { ownerId: "client-1", projectStatus: "available" },
    "adminManagedFloorPlanDrafts/old-draft": { intendedClientId: "client-1" },
    "adminManagedProjectAssignments/client-1": {
      ownerId: "client-1",
      projectId: "old-project",
      status: "published",
    },
  });
  await createReservedFloorPlanDraft(db, draft("client-1", "new-draft"));
  assert.equal(db.records.get("adminManagedFloorPlanDrafts/new-draft").intendedClientId, "client-1");
  assert.equal(db.records.has("adminManagedProjectAssignments/draft_new-draft"), true);
});

test("one client can create two drafts", async () => {
  const db = createMemoryDb();
  await Promise.all([
    createReservedFloorPlanDraft(db, draft("client-1", "draft-1")),
    createReservedFloorPlanDraft(db, draft("client-1", "draft-2")),
  ]);
  assert.equal(db.records.size, 4);
  assert.equal(db.records.get("adminManagedProjectAssignments/draft_draft-1").ownerId, "client-1");
  assert.equal(db.records.get("adminManagedProjectAssignments/draft_draft-2").ownerId, "client-1");
});

test("concurrent draft creation for one client succeeds with distinct IDs", async () => {
  const db = createMemoryDb();
  const results = await Promise.allSettled([
    createReservedFloorPlanDraft(db, draft("client-1", "draft-1")),
    createReservedFloorPlanDraft(db, draft("client-1", "draft-2")),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 2);
  assert.equal(db.records.size, 4);
});

test("draft and assignment ID collisions do not overwrite records", async () => {
  const existingDraftDb = createMemoryDb({
    "adminManagedFloorPlanDrafts/draft-1": { draftId: "draft-1" },
  });
  await assert.rejects(
    createReservedFloorPlanDraft(existingDraftDb, draft("client-1", "draft-1")),
    { status: 409 },
  );
  const existingAssignmentDb = createMemoryDb({
    "adminManagedProjectAssignments/draft_draft-1": { ownerId: "client-2", draftId: "draft-1" },
  });
  await assert.rejects(
    createReservedFloorPlanDraft(existingAssignmentDb, draft("client-1", "draft-1")),
    { status: 409 },
  );
  assert.equal(existingAssignmentDb.records.get("adminManagedProjectAssignments/draft_draft-1").ownerId, "client-2");
});
