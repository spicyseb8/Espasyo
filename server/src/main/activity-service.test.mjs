import assert from "node:assert/strict";
import test from "node:test";

import {
  getProjectOpenActivityId,
  recordProjectOpened,
} from "./activity-service.js";

function createMemoryDb() {
  const records = new Map();
  let transactionQueue = Promise.resolve();
  const db = {
    collection(name) {
      return {
        doc(id) {
          return { path: `${name}/${id}`, id };
        },
      };
    },
    runTransaction(callback) {
      const result = transactionQueue.then(() => callback({
        async get(reference) {
          return {
            exists: records.has(reference.path),
            data: () => records.get(reference.path),
          };
        },
        create(reference, value) {
          if (records.has(reference.path)) throw new Error("Document already exists.");
          records.set(reference.path, value);
        },
      }));
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  return { db, records };
}

test("project-open activity identity is stable per actor and project", () => {
  assert.equal(getProjectOpenActivityId("admin-1", "project-1"), getProjectOpenActivityId("admin-1", "project-1"));
  assert.notEqual(getProjectOpenActivityId("admin-1", "project-1"), getProjectOpenActivityId("admin-2", "project-1"));
  assert.notEqual(getProjectOpenActivityId("admin-1", "project-1"), getProjectOpenActivityId("admin-1", "project-2"));
});

test("repeated project opens create one actor-project activity", async () => {
  const { db, records } = createMemoryDb();
  const event = {
    actorUid: "client-uid",
    actorRole: "client",
    actorName: "Client Name",
    targetUserUid: "client-uid",
    projectId: "PRJ-001",
    projectName: "Sample Project",
  };

  const results = await Promise.all([
    recordProjectOpened(db, event),
    recordProjectOpened(db, event),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(records.size, 1);
  assert.equal([...records.values()][0].action, "project-opened");
  assert.equal([...records.values()][0].targetUserUid, "client-uid");
});
