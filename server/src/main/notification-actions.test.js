import assert from "node:assert/strict";
import test from "node:test";
import { markNotificationRead } from "./notification-actions.js";

function createDb({ exists = true, recipientUid = "user-1", read = false } = {}) {
  const calls = [];
  const recipientRef = {
    async get() {
      return {
        exists,
        data: () => ({ recipientUid, read }),
      };
    },
    async update(value) {
      calls.push(value);
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, "notifications");
      return {
        doc(notificationId) {
          assert.equal(notificationId, "notification-1");
          return {
            collection(name) {
              assert.equal(name, "recipients");
              return {
                doc(uid) {
                  assert.equal(uid, "user-1");
                  return recipientRef;
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

test("marks only the authenticated recipient's notification as read", async () => {
  const { db, calls } = createDb();

  assert.equal(await markNotificationRead(db, "notification-1", "user-1"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].read, true);
  assert.ok(calls[0].readAt);
});

test("does not update a missing or differently owned recipient record", async () => {
  const missing = createDb({ exists: false });
  assert.equal(await markNotificationRead(missing.db, "notification-1", "user-1"), false);
  assert.equal(missing.calls.length, 0);

  const differentOwner = createDb({ recipientUid: "user-2" });
  assert.equal(await markNotificationRead(differentOwner.db, "notification-1", "user-1"), false);
  assert.equal(differentOwner.calls.length, 0);
});

test("does not rewrite a notification that is already read", async () => {
  const { db, calls } = createDb({ read: true });

  assert.equal(await markNotificationRead(db, "notification-1", "user-1"), true);
  assert.equal(calls.length, 0);
});
