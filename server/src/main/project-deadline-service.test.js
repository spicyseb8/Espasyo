import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeadlineExpired,
  isValidCalendarDeadline,
  isValidDeadlineValue,
  saveProjectDeadline,
  validateDeadlineUpdate,
} from "./project-deadline-service.js";

test("accepts only future calendar deadlines", () => {
  assert.deepEqual(validateDeadlineUpdate("2026-02-28", "2026-02-21"), {
    valid: true,
    deadline: "2026-02-28",
  });
  assert.equal(validateDeadlineUpdate("2026-02-21", "2026-02-21").valid, false);
  assert.equal(validateDeadlineUpdate(null, "2026-02-21").valid, false);
});

test("rejects malformed and impossible calendar deadlines", () => {
  for (const value of [
    undefined,
    20261021,
    "2026-2-01",
    "2026-02-29",
    "2025-02-29",
    "2026-13-01",
    "2026-04-31",
  ]) {
    assert.equal(isValidCalendarDeadline(value), false);
    assert.equal(validateDeadlineUpdate(value, "2026-01-01").valid, false);
  }
  assert.equal(isValidCalendarDeadline("2024-02-29"), true);
});

test("recognizes a valid past deadline as expired instead of malformed", () => {
  assert.equal(isValidCalendarDeadline("2026-02-20"), true);
  assert.equal(isDeadlineExpired("2026-02-20", "2026-02-21"), true);
  assert.equal(isDeadlineExpired("invalid", "2026-02-21"), false);
  assert.equal(
    validateDeadlineUpdate("2026-02-20", "2026-02-21").message,
    "A new deadline must be after today."
  );
});

test("accepts valid future Manila deadline times and expires them at the selected time", () => {
  assert.equal(isValidDeadlineValue("2026-02-28T14:30"), true);
  assert.equal(isValidDeadlineValue("2026-02-28T24:00"), false);
  assert.deepEqual(validateDeadlineUpdate("2026-02-28T14:30", "2026-02-21"), {
    valid: true,
    deadline: "2026-02-28T14:30",
  });
  assert.equal(validateDeadlineUpdate("2026-02-21T23:59", "2026-02-21").valid, false);
  assert.equal(isDeadlineExpired("2026-02-21T14:30", "2026-02-21T14:29"), false);
  assert.equal(isDeadlineExpired("2026-02-21T14:30", "2026-02-21T14:30"), true);
});

test("updates deadline and appends an audit activity in one transaction", async () => {
  const writes = [];
  let activityDocument;
  const db = {
    collection(name) {
      if (name === "projectActivity") {
        return {
          doc() {
            activityDocument = {};
            return activityDocument;
          },
        };
      }
      assert.equal(name, "projects");
      return {
        doc(projectId) {
          assert.equal(projectId, "PRJ-00126");
          return { projectId };
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get() {
          return { exists: true, data: () => ({ deadline: "2026-10-30" }) };
        },
        update(reference, fields) {
          writes.push({ type: "update", reference, fields });
        },
        create(reference, fields) {
          writes.push({ type: "create", reference, fields });
        },
      });
    },
  };

  assert.equal(
    await saveProjectDeadline(db, "PRJ-00126", "2026-10-31", {
      uid: "admin-1",
      role: "admin",
    }, "Extension approved"),
    true
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0].fields.deadline, "2026-10-31");
  assert.equal(writes[1].reference, activityDocument);
  assert.equal(writes[1].fields.action, "deadline-changed");
  assert.deepEqual(writes[1].fields.previousValue, { deadline: "2026-10-30" });
  assert.deepEqual(writes[1].fields.newValue, { deadline: "2026-10-31" });
  assert.equal(writes[1].fields.actorId, "admin-1");
});

test("does not update a missing project", async () => {
  let didUpdate = false;
  const db = {
    collection() {
      return {
        doc(projectId) {
          return { projectId };
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get() {
          return { exists: false };
        },
        update() {
          didUpdate = true;
        },
        create() {
          didUpdate = true;
        },
      });
    },
  };

  assert.equal(await saveProjectDeadline(db, "missing", "2026-10-31", {
    uid: "admin-1",
    role: "admin",
  }), false);
  assert.equal(didUpdate, false);
});
