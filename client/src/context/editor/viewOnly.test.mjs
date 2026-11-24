import assert from "node:assert/strict";
import test from "node:test";

const {
    canDispatchInViewOnly,
    canPerformProjectWrite,
    isProjectStatusViewOnly,
    shouldShowDeadlinePassedNotice
} = await import("./viewOnly.ts");

test("submitted and approved project statuses use view-only mode", () => {
    assert.equal(isProjectStatusViewOnly("submitted"), true);
    assert.equal(isProjectStatusViewOnly("approved"), true);
});

test("other project statuses preserve their existing editor behavior", () => {
    for (const status of ["draft", "available", "ongoing", "revision-requested", "rejected", undefined]) {
        assert.equal(isProjectStatusViewOnly(status), false);
    }
});

test("submitted and approved projects suppress the expired-deadline notice", () => {
    assert.equal(shouldShowDeadlinePassedNotice("submitted", true), false);
    assert.equal(shouldShowDeadlinePassedNotice("approved", true), false);
    assert.equal(shouldShowDeadlinePassedNotice("submitted", false), false);
});

test("unsubmitted expired projects keep the deadline notice", () => {
    for (const status of ["available", "ongoing", "revision-requested", undefined]) {
        assert.equal(shouldShowDeadlinePassedNotice(status, true), true);
    }
    assert.equal(shouldShowDeadlinePassedNotice("ongoing", false), false);
});

test("view-only mode blocks all project save and submit operations", () => {
    assert.equal(canPerformProjectWrite(true, "save"), false);
    assert.equal(canPerformProjectWrite(true, "submit"), false);
    assert.equal(canPerformProjectWrite(false, "save"), true);
    assert.equal(canPerformProjectWrite(false, "submit"), true);
});

test("view-only editor dispatch permits navigation and walkthrough without edits", () => {
    assert.equal(canDispatchInViewOnly("LOAD_PROJECT"), true);
    assert.equal(canDispatchInViewOnly("CLEAR_PROJECT"), true);
    assert.equal(canDispatchInViewOnly("SWITCH_FLOOR"), true);
    assert.equal(canDispatchInViewOnly("TOGGLE_WALKTHROUGH"), true);
    assert.equal(canDispatchInViewOnly("ADD_FURNITURE"), false);
    assert.equal(canDispatchInViewOnly("UPDATE_FURNITURE"), false);
    assert.equal(canDispatchInViewOnly("REMOVE_FURNITURE"), false);
    assert.equal(canDispatchInViewOnly("SET_PROJECT_BUDGET"), false);
    assert.equal(canDispatchInViewOnly("SET_FLOOR_FINISH"), false);
    assert.equal(canDispatchInViewOnly("SET_WALL_FINISH"), false);
});
