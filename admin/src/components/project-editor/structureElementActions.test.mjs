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
        referencePoint: { x: 2, y: 2, z: 3 },
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
        referencePoint: { x: 2.5, y: 2, z: 3 },
        placementWidth: sourceDoor.width,
        placementHeight: sourceDoor.height,
        placementDepth: sourceDoor.depth,
        preferredWallId: wall.id,
        excludeElementId: sourceDoor.id
    });
    assert.equal(overlappingCandidate?.valid, false);
});

test("door and window facing is side-based for either wall direction without moving the placement", () => {
    const assetTypes = [
        {
            id: "door-asset",
            name: "Door",
            thumbnail: "",
            model: "door.glb",
            type: "door",
            rotationOffsetY: Math.PI / 2
        },
        {
            id: "window-asset",
            name: "Window",
            thumbnail: "",
            model: "window.glb",
            type: "window",
            rotationOffsetY: 0
        }
    ];
    const walls = [
        {
            id: "wall-x",
            start: { id: "x-start", position: { x: 0, y: 0, z: 0 } },
            end: { id: "x-end", position: { x: 5, y: 0, z: 0 } }
        },
        {
            id: "wall-x-reversed",
            start: { id: "x-end", position: { x: 5, y: 0, z: 0 } },
            end: { id: "x-start", position: { x: 0, y: 0, z: 0 } }
        },
        {
            id: "wall-z",
            start: { id: "z-start", position: { x: 0, y: 0, z: 0 } },
            end: { id: "z-end", position: { x: 0, y: 0, z: 5 } }
        },
        {
            id: "wall-z-reversed",
            start: { id: "z-end", position: { x: 0, y: 0, z: 5 } },
            end: { id: "z-start", position: { x: 0, y: 0, z: 0 } }
        }
    ];
    const angleDifference = (first, second) =>
        Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));

    for (const asset of assetTypes) {
        for (const [wall, reversedWall, point, referencePoint] of [
            [walls[0], walls[1], { x: 2.5, y: 0, z: 0 }, { x: 2.5, y: 2, z: 3 }],
            [walls[2], walls[3], { x: 0, y: 0, z: 2.5 }, { x: 3, y: 2, z: 2.5 }]
        ]) {
            const base = {
                ...createManagedStructure("project", "Plan", "owner"),
                walls: [wall],
                doors: [],
                windows: [],
                openings: []
            };
            const reversedBase = { ...base, walls: [reversedWall] };
            const placement = {
                asset,
                point: { ...point, y: asset.type === "window" ? 1.2 : 0 },
                referencePoint,
                placementWidth: 0.9,
                placementHeight: 1.2,
                placementDepth: 0.12
            };
            const expectedPosition = {
                ...point,
                y: asset.type === "window" ? 1.2 : 0
            };
            const firstSide = calculateBuildElementPlacement({
                ...placement,
                structure: base,
                preferredWallId: wall.id
            });
            const reversedSide = calculateBuildElementPlacement({
                ...placement,
                structure: reversedBase,
                preferredWallId: reversedWall.id
            });
            const oppositeSide = calculateBuildElementPlacement({
                ...placement,
                structure: base,
                preferredWallId: wall.id,
                referencePoint: {
                    x: referencePoint.x * -1,
                    y: referencePoint.y,
                    z: referencePoint.z * -1
                }
            });

            assert.ok(firstSide);
            assert.ok(reversedSide);
            assert.ok(oppositeSide);
            const offset = asset.rotationOffsetY ?? (asset.type === "door" ? Math.PI / 2 : 0);
            assert.ok(angleDifference(firstSide.rotationY + offset, reversedSide.rotationY + offset) < 1e-10);
            assert.ok(Math.abs(angleDifference(firstSide.rotationY + offset, oppositeSide.rotationY + offset) - Math.PI) < 1e-10);
            assert.deepEqual(firstSide.position, expectedPosition);
            assert.deepEqual(reversedSide.position, firstSide.position);
            assert.deepEqual(oppositeSide.position, firstSide.position);
        }
    }
});
