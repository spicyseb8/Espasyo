import test from "node:test";
import assert from "node:assert/strict";
import {
  createNotification,
  formatNotificationId,
  getNotificationDateKey,
  upsertNotification,
} from "./notification-service.js";

function createMemoryDb() {
  const records = new Map();
  let transactionQueue = Promise.resolve();
  const ref = (path) => ({
    path,
    async get() { return { exists: records.has(path), data: () => records.get(path) }; },
    collection(name) { return { doc: (id) => ref(`${path}/${name}/${id}`) }; },
  });
  const db = {
    records,
    collection(name) { return { doc: (id) => ref(`${name}/${id}`) }; },
    async runTransaction(callback) {
      let release;
      const previousTransaction = transactionQueue;
      transactionQueue = new Promise(resolve => { release = resolve; });
      await previousTransaction;
      const writes = [];
      const transaction = {
        async get(reference) { return { exists: records.has(reference.path), data: () => records.get(reference.path) }; },
        create(reference, value) { writes.push([reference.path, value, "create"]); },
        set(reference, value, options) { writes.push([reference.path, value, options?.merge === true ? "merge" : "set"]); },
      };
      try {
        const result = await callback(transaction);
        for (const [path, value, operation] of writes) {
          if (operation === "create" && records.has(path)) throw new Error(`Already exists: ${path}`);
          records.set(path, operation === "merge" ? { ...records.get(path), ...value } : value);
        }
        return result;
      } finally {
        release();
      }
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

test("grouped client notifications count only while unread and split by client, project, and action", async () => {
  const db = createMemoryDb();
  const payload = (eventKey, type, clientId, projectId, recipients = ["admin-a", "admin-b"]) => ({
    eventKey, type, clientId, clientName: `Client ${clientId}`,
    projectId, projectName: `Project ${projectId}`, recipients,
  });

  const notificationId = await upsertNotification(db, payload("update-1", "project_updated", "client-a", "project-1"));
  const notificationPath = `notifications/${notificationId}`;
  assert.equal(notificationId, "client-a_project-1_project_updated");
  assert.equal(db.records.get(notificationPath).count, 1);
  assert.equal(db.records.get(notificationPath).clientName, "Client client-a");
  assert.equal(db.records.get(`${notificationPath}/recipients/admin-a`).read, false);
  await upsertNotification(db, payload("update-1", "project_updated", "client-a", "project-1"));
  assert.equal(db.records.get(notificationPath).count, 1);

  db.records.set(`${notificationPath}/recipients/admin-a`, {
    ...db.records.get(`${notificationPath}/recipients/admin-a`),
    read: true,
    isRead: true,
  });
  await upsertNotification(db, payload("update-2", "project_updated", "client-a", "project-1"));
  assert.equal(db.records.get(notificationPath).count, 2);
  assert.equal(db.records.get(notificationPath).message, "Client client-a updated Project project-1 (2 updates).");
  assert.equal(db.records.get(`${notificationPath}/recipients/admin-a`).read, false);

  await upsertNotification(db, payload("update-3", "project_updated", "client-a", "project-1"));
  await upsertNotification(db, payload("update-4", "project_updated", "client-a", "project-1"));
  await upsertNotification(db, payload("update-5", "project_updated", "client-a", "project-1"));
  assert.equal(db.records.get(notificationPath).count, 5);

  db.records.set(`${notificationPath}/recipients/admin-a`, {
    ...db.records.get(`${notificationPath}/recipients/admin-a`),
    read: true,
    isRead: true,
  });
  db.records.set(`${notificationPath}/recipients/admin-b`, {
    ...db.records.get(`${notificationPath}/recipients/admin-b`),
    read: true,
    isRead: true,
  });
  await upsertNotification(db, payload("update-after-read", "project_updated", "client-a", "project-1"));
  assert.equal(db.records.get(notificationPath).count, 1);
  assert.equal(db.records.get(notificationPath).message, "Client client-a updated Project project-1.");

  await upsertNotification(db, payload("project-2", "project_updated", "client-a", "project-2"));
  await upsertNotification(db, payload("client-b", "project_updated", "client-b", "project-1"));
  assert.equal(db.records.get("notifications/client-a_project-2_project_updated").count, 1);
  assert.equal(db.records.get("notifications/client-b_project-1_project_updated").count, 1);
  await assert.rejects(
    () => upsertNotification(db, payload("opened", "project_opened", "client-a", "project-1")),
    /supported type/,
  );
  assert.equal(db.records.has("notifications/client-a_project-1_project_opened"), false);

  const legacyNotificationId = await upsertNotification(
    db,
    payload("legacy-first", "project_updated", "client-c", "project-1"),
  );
  delete db.records.get(`notifications/${legacyNotificationId}`).count;
  await upsertNotification(db, payload("legacy-next", "project_updated", "client-c", "project-1"));
  assert.equal(db.records.get(`notifications/${legacyNotificationId}`).count, 2);
});

test("simultaneous client updates atomically increment the grouped count", async () => {
  const db = createMemoryDb();
  const payload = eventKey => ({
    eventKey, type: "project_updated", clientId: "client-a", clientName: "Client A",
    projectId: "project-1", projectName: "Project One", recipients: ["admin-a"],
  });

  await Promise.all([
    upsertNotification(db, payload("concurrent-1")),
    upsertNotification(db, payload("concurrent-2")),
    upsertNotification(db, payload("concurrent-3")),
  ]);
  assert.equal(db.records.get("notifications/client-a_project-1_project_updated").count, 3);
});
