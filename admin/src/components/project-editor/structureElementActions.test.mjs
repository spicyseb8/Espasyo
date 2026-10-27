import assert from "node:assert/strict";
import test from "node:test";
import { createManagedStructure } from "./structureTypes.ts";
import {
    applyStructureElementPlacement,
    removeStructureElement
} from "./structureElementActions.ts";
import { calculateBuildElementPlacement } from "./buildElementPlacement.ts";

const wall = {
    id: "wall-b",
    start: { id: "corner-b1", position: { x: 0, y: 0, z: 0 } },
    end: { id: "corner-b2", position: { x: 5, y: 0, z: 0 } }
};

const sourceDoor = {
    id: "door-a",
    assetId: "asset-door",
    wallId: "wall-a",
    position: { x: 1, y: 0, z: 0 },
    rotationY: Math.PI / 2,
    width: 0.9,
    height: 2.1,
    wallWidth: 0.9,
    depth: 0.12
};

function candidate(overrides = {}) {
    return {
        kind: "door",
        wallId: wall.id,
        position: { x: 3, y: 0, z: 0 },
        direction: { x: 1, z: 0 },
        rotationY: Math.PI / 2,
        wallRotationY: 0,
        width: sourceDoor.width,
        height: sourceDoor.height,
        depth: sourceDoor.depth,
        wallWidth: sourceDoor.wallWidth,
        valid: true,
        reason: "",
        ...overrides
    };
}

function structure(overrides = {}) {
    return {
        ...createManagedStructure("project", "Plan", "owner"),
        walls: [wall, {
            id: "wall-a",
            start: { id: "corner-a1", position: { x: 0, y: 0, z: 1 } },
            end: { id: "corner-a2", position: { x: 5, y: 0, z: 1 } }
        }],
        doors: [sourceDoor],
        ...overrides
    };
}

test("moving a door preserves its identity and asset while updating its hosted placement", () => {
    const updated = applyStructureElementPlacement(
        structure(),
        "door",
        sourceDoor,
        "move",
        candidate(),
        "unused"
    );

    assert.ok(updated);
    assert.equal(updated.doors.length, 1);
    assert.equal(updated.doors[0].id, sourceDoor.id);
    assert.equal(updated.doors[0].assetId, sourceDoor.assetId);
    assert.equal(updated.doors[0].wallId, wall.id);
    assert.deepEqual(updated.doors[0].position, { x: 3, y: 0, z: 0 });
    assert.equal(updated.doors[0].width, sourceDoor.width);
    assert.equal(updated.doors[0].depth, sourceDoor.depth);
});

test("duplicating a window adds a new ID and preserves source properties", () => {
    const sourceWindow = {
        ...sourceDoor,
        id: "window-a",
        assetId: "asset-window",
        height: 1.2
    };
    const base = structure({ doors: [], windows: [sourceWindow] });
    const duplicated = applyStructureElementPlacement(
        base,
        "window",
        sourceWindow,
        "duplicate",
        candidate({ kind: "window", height: sourceWindow.height }),
        "window-copy"
    );

    assert.ok(duplicated);
    assert.equal(duplicated.windows.length, 2);
    assert.equal(duplicated.windows[1].id, "window-copy");
    assert.equal(duplicated.windows[1].assetId, sourceWindow.assetId);
    assert.equal(duplicated.windows[1].height, sourceWindow.height);
    assert.equal(duplicated.windows[1].wallId, wall.id);
});

test("invalid or unhosted placements and duplicate IDs are rejected", () => {
    const base = structure();

    assert.equal(applyStructureElementPlacement(
        base, "door", sourceDoor, "move", candidate({ valid: false }), "unused"
    ), null);
    assert.equal(applyStructureElementPlacement(
        base, "door", sourceDoor, "move", candidate({ wallId: "missing-wall" }), "unused"
    ), null);
    assert.equal(applyStructureElementPlacement(
        base, "door", sourceDoor, "duplicate", candidate(), sourceDoor.id
    ), null);
});

test("removing a selected element affects only its collection", () => {
    const base = structure({
        windows: [{ ...sourceDoor, id: "window-a" }]
    });
    const updated = removeStructureElement(base, "door", sourceDoor.id);

    assert.ok(updated);
    assert.deepEqual(updated.doors, []);
    assert.equal(updated.windows.length, 1);
    assert.equal(removeStructureElement(updated, "door", sourceDoor.id), null);
});

test("move placement ignores the source collision but rejects other hosted elements", () => {
    const base = structure({
        doors: [{
            ...sourceDoor,
            wallId: wall.id,
            position: { x: 2, y: 0, z: 0 }
        }]
    });
    const asset = {
        id: sourceDoor.assetId,
        name: "Door",
        thumbnail: "",
        model: "door.glb",
        type: "door",
        rotationOffsetY: Math.PI / 2
    };
    const movedCandidate = calculateBuildElementPlacement({
        structure: base,
        asset,
        point: { x: 2, y: 0, z: 0 },
        placementWidth: sourceDoor.width,
        placementHeight: sourceDoor.height,
        placementDepth: sourceDoor.depth,
        preferredWallId: wall.id,
        excludeElementId: sourceDoor.id
    });
    assert.equal(movedCandidate?.valid, true);

    const overlappingCandidate = calculateBuildElementPlacement({
        structure: {
            ...base,
            windows: [{
                ...sourceDoor,
                id: "window-overlap",
                wallId: wall.id,
                position: { x: 3, y: 0, z: 0 }
            }]
        },
        asset,
        point: { x: 2.5, y: 0, z: 0 },
        placementWidth: sourceDoor.width,
        placementHeight: sourceDoor.height,
        placementDepth: sourceDoor.depth,
        preferredWallId: wall.id,
        excludeElementId: sourceDoor.id
    });
    assert.equal(overlappingCandidate?.valid, false);
});
