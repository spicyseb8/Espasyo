import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeadlineExpired,
  isValidCalendarDeadline,
  saveProjectDeadline,
  validateDeadlineUpdate,
} from "./project-deadline-service.js";

test("accepts valid future and current calendar deadlines", () => {
  assert.deepEqual(validateDeadlineUpdate("2026-02-28", "2026-02-21"), {
    valid: true,
    deadline: "2026-02-28",
  });
  assert.equal(validateDeadlineUpdate("2026-02-21", "2026-02-21").valid, true);
  assert.equal(validateDeadlineUpdate(null, "2026-02-21").valid, true);
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
    "A new deadline must be today or a future date."
  );
});

test("updates an existing project through the Admin SDK service and preserves its deadline value", async () => {
  let updated;
  const db = {
    collection(name) {
      assert.equal(name, "projects");
      return {
        doc(projectId) {
          assert.equal(projectId, "PRJ-00126");
          return {
            async get() {
              return { exists: true };
            },
            async update(fields) {
              updated = fields;
            },
          };
        },
      };
    },
  };

  assert.equal(
    await saveProjectDeadline(db, "PRJ-00126", "2026-10-31"),
    true
  );
  assert.equal(updated.deadline, "2026-10-31");
  assert.ok(updated.updatedAt instanceof Date);
});

test("does not update a missing project", async () => {
  let didUpdate = false;
  const db = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return { exists: false };
            },
            async update() {
              didUpdate = true;
            },
          };
        },
      };
    },
  };

  assert.equal(await saveProjectDeadline(db, "missing", null), false);
  assert.equal(didUpdate, false);
});
