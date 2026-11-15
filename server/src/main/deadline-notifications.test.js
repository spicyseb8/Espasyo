import test from "node:test";
import assert from "node:assert/strict";
import { getDeadlineReminder } from "./deadline-notifications.js";

test("deadline reminders use the Manila calendar and include expiration", () => {
  assert.equal(getDeadlineReminder("2026-11-18", "2026-11-15").key, "3-days");
  assert.equal(getDeadlineReminder("2026-11-16", "2026-11-15").key, "1-day");
  assert.equal(getDeadlineReminder("2026-11-15", "2026-11-15").key, "due");
  assert.equal(getDeadlineReminder("2026-11-14", "2026-11-15").key, "expired");
  assert.equal(getDeadlineReminder("2026-11-20", "2026-11-15"), null);
});
