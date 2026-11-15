import test from "node:test";
import assert from "node:assert/strict";
import {
  createNotification,
  formatNotificationId,
  getNotificationDateKey,
} from "./notification-service.js";

function createMemoryDb() {
  const records = new Map();
  const ref = (path) => ({
    path,
    async get() { return { exists: records.has(path), data: () => records.get(path) }; },
    collection(name) { return { doc: (id) => ref(`${path}/${name}/${id}`) }; },
  });
  const db = {
    records,
    collection(name) { return { doc: (id) => ref(`${name}/${id}`) }; },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(reference) { return { exists: records.has(reference.path), data: () => records.get(reference.path) }; },
        create(reference, value) { writes.push([reference.path, value, false]); },
        set(reference, value, options) { writes.push([reference.path, value, options?.merge === true]); },
      };
      const result = await callback(transaction);
      for (const [path, value, merge] of writes) {
        if (!merge && records.has(path)) throw new Error(`Already exists: ${path}`);
        records.set(path, merge ? { ...records.get(path), ...value } : value);
      }
      return result;
    },
  };
  return db;
}

test("notification IDs use the readable daily sequence format and Manila date", () => {
  assert.equal(formatNotificationId("20261115", 1), "NTF-20261115-000001");
  assert.equal(formatNotificationId("20261115", 1000000), "NTF-20261115-1000000");
  assert.equal(getNotificationDateKey(new Date("2026-11-14T16:30:00.000Z")), "20261115");
});

test("notification event retries are idempotent and recipients have independent read states", async () => {
  const db = createMemoryDb();
  const base = {
    eventKey: "project-submitted:PRJ-1:submission-1", eventType: "project-submitted",
    category: "Projects", title: "Submitted", message: "Ready for review",
    actorUid: "client-1", actorName: "Client", targetType: "project", targetId: "PRJ-1",
    recipients: ["admin-a", "admin-b", "admin-a"],
  };
  const firstId = await createNotification(db, base);
  const retryId = await createNotification(db, base);
  assert.equal(firstId, retryId);
  assert.match(firstId, /^NTF-\d{8}-\d{6}$/);
  assert.equal(db.records.get(`notifications/${firstId}/recipients/admin-a`).read, false);
  assert.equal(db.records.get(`notifications/${firstId}/recipients/admin-b`).read, false);
  db.records.get(`notifications/${firstId}/recipients/admin-a`).read = true;
  assert.equal(db.records.get(`notifications/${firstId}/recipients/admin-b`).read, false);
  assert.equal([...db.records.keys()].filter(path => path.startsWith("notifications/") && path.split("/").length === 2).length, 1);
});

test("separate successful events receive collision-free readable IDs", async () => {
  const db = createMemoryDb();
  const payload = (eventKey) => ({
    eventKey, eventType: "asset-created", category: "Assets", title: "Asset added",
    message: "A chair was added", targetType: "asset", targetId: eventKey,
    recipients: ["admin-a"],
  });
  const first = await createNotification(db, payload("asset-1"));
  const second = await createNotification(db, payload("asset-2"));
  assert.notEqual(first, second);
  assert.equal(db.records.get(`notificationCounters/${first.slice(4, 12)}`).lastSequence, 2);
});
