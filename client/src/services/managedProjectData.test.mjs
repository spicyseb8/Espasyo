import assert from "node:assert/strict";
import test from "node:test";
import { canMutateManagedStructure, mergeManagedInteriorData } from "./managedProjectData.ts";

test("managed interior merge preserves published structure", () => {
    const published = { walls: [{ id: "wall-1" }], doors: [{ id: "door-1" }], furniture: [] };
    const merged = mergeManagedInteriorData(published, {
        furniture: [{ id: "chair-1" }],
        floorFinishes: { room: "tile" },
        wallFinishes: { room: { "wall-1": "paint" } }
    });

    assert.deepEqual(merged.walls, published.walls);
    assert.deepEqual(merged.doors, published.doors);
    assert.deepEqual(merged.furniture, [{ id: "chair-1" }]);
});

test("legacy structure remains editable and managed structure does not", () => {
    assert.equal(canMutateManagedStructure(undefined), true);
    assert.equal(canMutateManagedStructure("legacy"), true);
    assert.equal(canMutateManagedStructure("admin-managed"), false);
});
