import assert from "node:assert/strict";
import test from "node:test";

import { getManilaDateBounds, getManilaDateKey } from "./manilaTime.mjs";

test("Manila date key follows the Philippine calendar across UTC midnight", () => {
  assert.equal(getManilaDateKey(new Date("2026-03-01T16:00:00.000Z")), "2026-03-02");
});

test("Manila day bounds span exactly one local day", () => {
  const { dayKey, start, end } = getManilaDateBounds(new Date("2026-03-01T15:59:59.000Z"));

  assert.equal(dayKey, "2026-03-01");
  assert.equal(start.toISOString(), "2026-02-28T16:00:00.000Z");
  assert.equal(end.toISOString(), "2026-03-01T16:00:00.000Z");
});
