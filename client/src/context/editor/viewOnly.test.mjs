import assert from "node:assert/strict";
import test from "node:test";

const { canDispatchInViewOnly, canPerformProjectWrite } = await import("./viewOnly.ts");

test("view-only mode blocks all project save and submit operations", () => {
    assert.equal(canPerformProjectWrite(true, "save"), false);
    assert.equal(canPerformProjectWrite(true, "submit"), false);
    assert.equal(canPerformProjectWrite(false, "save"), true);
    assert.equal(canPerformProjectWrite(false, "submit"), true);
});

test("view-only editor dispatch permits only loading, clearing, and floor navigation", () => {
    assert.equal(canDispatchInViewOnly("LOAD_PROJECT"), true);
    assert.equal(canDispatchInViewOnly("CLEAR_PROJECT"), true);
    assert.equal(canDispatchInViewOnly("SWITCH_FLOOR"), true);
    assert.equal(canDispatchInViewOnly("ADD_FURNITURE"), false);
    assert.equal(canDispatchInViewOnly("UPDATE_FURNITURE"), false);
    assert.equal(canDispatchInViewOnly("REMOVE_FURNITURE"), false);
    assert.equal(canDispatchInViewOnly("SET_FLOOR_FINISH"), false);
    assert.equal(canDispatchInViewOnly("SET_WALL_FINISH"), false);
});
