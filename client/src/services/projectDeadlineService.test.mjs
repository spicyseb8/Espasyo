import assert from "node:assert/strict";
import test from "node:test";

import {
    formatProjectDeadline,
    getDaysUntilProjectDeadline,
    isDeadlinePassed,
    isValidProjectDeadline
} from "./projectDeadlineService.ts";

test("validates legacy project dates and Manila local date-time deadlines", () => {
    assert.equal(isValidProjectDeadline("2026-11-06"), true);
    assert.equal(isValidProjectDeadline("2026-11-06T14:30"), true);
    assert.equal(isValidProjectDeadline("2026-11-06T24:00"), false);
    assert.equal(isValidProjectDeadline("2026-02-30T14:30"), false);
});

test("deadline display and remaining-day calculation retain the calendar date", () => {
    assert.equal(getDaysUntilProjectDeadline("2099-12-31T23:59"), getDaysUntilProjectDeadline("2099-12-31"));
    assert.match(formatProjectDeadline("2099-12-31T23:59"), /Dec 31, 2099/);
    assert.match(formatProjectDeadline("2099-12-31T23:59"), /11:59/);
});

test("recognizes elapsed date-time deadlines while preserving legacy end-of-day dates", () => {
    assert.equal(isDeadlinePassed("2000-01-01T00:00"), true);
    assert.equal(isDeadlinePassed("2000-01-01"), true);
    assert.equal(isDeadlinePassed("2099-12-31T23:59"), false);
});
