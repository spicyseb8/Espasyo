import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { buildAdminWallMeshes } from "../project-loader/engine/walls/AdminWallMeshBuilder.ts";
import { polygonArea } from "../project-loader/engine/regions/Polygon.ts";
import {
    addWallSegmentToStructure,
    findOrCreateCorner,
    getRoomPreviewGeometry,
    findSegmentIntersections,
    mergeCollinearWalls,
    removeDuplicateWalls,
    snap90Degrees,
    snapToCorner,
    snapToGrid,
    wallSurfaceArea
} from "./structureGeometry.ts";
import { createManagedStructure } from "./structureTypes.ts";
import { calculateBuildElementPlacement } from "./buildElementPlacement.ts";

test("grid and corner snapping match source geometry conventions", () => {
    assert.deepEqual(snapToGrid({ x: 0.63, y: 0, z: -0.62 }, 0.25), { x: 0.75, y: 0, z: -0.5 });
    assert.deepEqual(snapToCorner({ x: 1.02, y: 0, z: 0 }, [{ id: "a", position: { x: 1, y: 0, z: 0 } }]), { x: 1, y: 0, z: 0 });
});

test("90-degree snapping preserves aligned axis", () => {
    assert.deepEqual(snap90Degrees({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0.05 }), { x: 2, y: 0, z: 0 });
});

test("room preview uses snapped X/Z bounds for dimensions and area", () => {
    const preview = getRoomPreviewGeometry(
        { x: 1, y: 0, z: 2 },
        { x: -3, y: 0, z: 7 }
    );

    assert.deepEqual(preview.corners, [
        { x: -3, y: 0, z: 2 },
        { x: 1, y: 0, z: 2 },
        { x: 1, y: 0, z: 7 },
        { x: -3, y: 0, z: 7 }
    ]);
    assert.equal(preview.width, 4);
    assert.equal(preview.length, 5);
    assert.equal(preview.area, 20);
});

test("wall surface area uses endpoint distance and wall height", () => {
    const wall = {
        id: "angled",
        start: { id: "a", position: { x: 0, y: 0, z: 0 } },
        end: { id: "b", position: { x: 3, y: 0, z: 4 } }
    };
    assert.equal(wallSurfaceArea(wall, 2.5), 12.5);
});

test("floor area uses polygon geometry for irregular room shapes", () => {
    const concaveFloor = [
        new Vector3(0, 0, 0),
        new Vector3(4, 0, 0),
        new Vector3(4, 0, 1),
        new Vector3(1, 0, 1),
        new Vector3(1, 0, 3),
        new Vector3(0, 0, 3)
    ];
    assert.equal(Math.abs(polygonArea(concaveFloor)), 6);
});

test("door placement uses projected wall width and model rotation metadata", () => {
    const structure = createManagedStructure("p1", "Plan", "owner");
    const start = { id: "a", position: { x: 0, y: 0, z: 0 } };
    const end = { id: "b", position: { x: 4, y: 0, z: 0 } };
    const candidate = calculateBuildElementPlacement({
        structure: {
            ...structure,
            layoutConfirmed: true,
            corners: [start, end],
            walls: [{ id: "wall", start, end }]
        },
        asset: {
            id: "door",
            name: "Door",
            thumbnail: "",
            model: "door.glb",
            type: "door",
            width: 0.9,
            height: 2.1,
            depth: 0.12,
            rotationOffsetY: Math.PI / 2
        },
        point: { x: 3, y: 0, z: 0.05 },
        placementWidth: 0.9,
        placementHeight: 2.1,
        preferredWallId: "wall"
    });

    assert.ok(candidate);
    assert.equal(candidate.valid, true);
    assert.equal(candidate.wallId, "wall");
    assert.equal(candidate.position.x, 3);
    assert.equal(candidate.position.y, 0);
    assert.equal(candidate.wallWidth, 0.9);
    assert.equal(candidate.rotationY, Math.PI / 2);
});

test("window placement uses pointer elevation and rejects overlapping elements", () => {
    const base = createManagedStructure("p1", "Plan", "owner");
    const start = { id: "a", position: { x: 0, y: 0, z: 0 } };
    const end = { id: "b", position: { x: 4, y: 0, z: 0 } };
    const wall = { id: "wall", start, end };
    const structure = {
        ...base,
        layoutConfirmed: true,
        corners: [start, end],
        walls: [wall],
        doors: [{
            id: "existing-door",
            assetId: "door",
            wallId: "wall",
            position: { x: 2, y: 0, z: 0 },
            rotationY: Math.PI / 2,
            width: 0.9,
            wallWidth: 1,
            height: 2,
            depth: 0.12
        }]
    };
    const candidate = calculateBuildElementPlacement({
        structure,
        asset: {
            id: "window",
            name: "Window",
            thumbnail: "",
            model: "window.glb",
            type: "window",
            width: 1,
            height: 1,
            depth: 0.1
        },
        point: { x: 2, y: 1.5, z: 0 },
        placementWidth: 1,
        placementHeight: 1,
        preferredWallId: "wall"
    });

    assert.ok(candidate);
    assert.equal(candidate.position.y, 1.5);
    assert.equal(candidate.valid, false);
    assert.match(candidate.reason, /overlap/);
});

test("windows can occupy different elevations and must fit within wall vertical bounds", () => {
    const base = createManagedStructure("p1", "Plan", "owner");
    const start = { id: "a", position: { x: 0, y: 0, z: 0 } };
    const end = { id: "b", position: { x: 5, y: 0, z: 0 } };
    const structure = {
        ...base,
        layoutConfirmed: true,
        corners: [start, end],
        walls: [{ id: "wall", start, end }]
    };
    const asset = {
        id: "window",
        name: "Window",
        thumbnail: "",
        model: "window.glb",
        type: "window",
        width: 1,
        height: 1,
        depth: 0.1
    };
    const place = y => calculateBuildElementPlacement({
        structure,
        asset,
        point: { x: 2, y, z: 0 },
        placementWidth: 1,
        placementHeight: 1,
        preferredWallId: "wall"
    });

    const lower = place(0.75);
    const upper = place(2.25);
    const belowWall = place(0.4);
    const aboveWall = place(2.8);

    assert.equal(lower?.position.y, 0.75);
    assert.equal(lower?.valid, true);
    assert.equal(upper?.position.y, 2.25);
    assert.equal(upper?.valid, true);
    assert.equal(belowWall?.valid, false);
    assert.match(belowWall.reason, /bottom and top/);
    assert.equal(aboveWall?.valid, false);
    assert.match(aboveWall.reason, /bottom and top/);
});

test("door wall cutout uses wallWidth with width fallback for legacy records", () => {
    const wall = {
        id: "wall",
        start: { id: "a", position: new Vector3(0, 0, 0) },
        end: { id: "b", position: new Vector3(4, 0, 0) }
    };
    const baseDoor = {
        id: "door",
        wallId: "wall",
        position: new Vector3(2, 0, 0),
        width: 1,
        height: 2
    };
    const cutoutWallWidth = (door) => buildAdminWallMeshes(
        wall,
        3,
        0.15,
        [door],
        [],
        []
    ).find(piece => piece.kind === "header")?.width;

    assert.ok(Math.abs(cutoutWallWidth({ ...baseDoor, wallWidth: 0.7 }) - 0.7) < 0.001);
    assert.equal(cutoutWallWidth(baseDoor), 1);
});

test("window wall cutout uses wallWidth with width fallback for legacy records", () => {
    const wall = {
        id: "wall",
        start: { id: "a", position: new Vector3(0, 0, 0) },
        end: { id: "b", position: new Vector3(4, 0, 0) }
    };
    const baseWindow = {
        id: "window",
        wallId: "wall",
        position: new Vector3(2, 1.5, 0),
        width: 1,
        height: 1
    };
    const cutoutWallWidth = (window) => buildAdminWallMeshes(
        wall,
        3,
        0.15,
        [],
        [],
        [window]
    ).find(piece => piece.kind === "header")?.width;

    assert.ok(Math.abs(cutoutWallWidth({ ...baseWindow, wallWidth: 0.7 }) - 0.7) < 0.001);
    assert.equal(cutoutWallWidth(baseWindow), 1);
});

test("moving a door or window temporarily restores the full wall without changing structural data", () => {
    const wall = {
        id: "wall",
        start: { id: "a", position: new Vector3(0, 0, 0) },
        end: { id: "b", position: new Vector3(4, 0, 0) }
    };
    const door = {
        id: "door",
        wallId: "wall",
        position: new Vector3(1, 0, 0),
        width: 1,
        height: 2
    };
    const window = {
        id: "window",
        wallId: "wall",
        position: new Vector3(3, 1.5, 0),
        width: 1,
        height: 1
    };
    const doorMoveWall = buildAdminWallMeshes(
        wall, 3, 0.15, [door], [], [], door.id
    );
    const windowMoveWall = buildAdminWallMeshes(
        wall, 3, 0.15, [], [], [window], window.id
    );

    assert.equal(doorMoveWall.length, 1);
    assert.equal(doorMoveWall[0].kind, "full");
    assert.equal(windowMoveWall.length, 1);
    assert.equal(windowMoveWall[0].kind, "full");
    const confirmedWindowMoveWall = buildAdminWallMeshes(
        wall,
        3,
        0.15,
        [],
        [],
        [{ ...window, position: new Vector3(3, 1.5, 0) }]
    );
    assert.equal(confirmedWindowMoveWall.length, 4);
    assert.ok(confirmedWindowMoveWall.every(piece => piece.kind !== "full"));
    assert.equal(door.wallId, "wall");
    assert.equal(door.position.x, 1);
    assert.equal(window.wallId, "wall");
    assert.equal(window.position.y, 1.5);
});

test("window cutout geometry follows the persisted vertical center", () => {
    const wall = {
        id: "wall",
        start: { id: "a", position: new Vector3(0, 0, 0) },
        end: { id: "b", position: new Vector3(5, 0, 0) }
    };
    const window = {
        id: "window",
        wallId: "wall",
        position: new Vector3(2.5, 1, 0),
        width: 1,
        height: 0.8
    };
    const pieces = buildAdminWallMeshes(wall, 3, 0.15, [], [], [window]);
    const verticalCutoutPieces = pieces.filter(piece =>
        piece.kind === "header" && Math.abs(piece.width - 1) < 0.001
    );

    assert.equal(verticalCutoutPieces.length, 2);
    assert.ok(verticalCutoutPieces.some(piece => Math.abs(piece.position.y - 0.3) < 0.001));
    assert.ok(verticalCutoutPieces.some(piece => Math.abs(piece.position.y - 2.2) < 0.001));
});

test("corner lookup and creation preserve stable IDs", () => {
    const corners = [{ id: "corner-a", position: { x: 1, y: 0, z: 1 } }];
    const existing = findOrCreateCorner({ x: 1.02, y: 0, z: 1 }, corners);
    assert.equal(existing.corner.id, "corner-a");
    const created = findOrCreateCorner({ x: 5, y: 0, z: 5 }, corners);
    assert.notEqual(created.corner.id, "corner-a");
    assert.equal(created.corners.length, 2);
});

test("new wall intersections are ordered", () => {
    const wall = { id: "wall-a", start: { id: "a", position: { x: 0, y: 0, z: 0 } }, end: { id: "b", position: { x: 0, y: 0, z: 4 } } };
    const intersections = findSegmentIntersections({ x: -1, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, [wall]);
    assert.equal(intersections.length, 1);
    assert.deepEqual(intersections[0].point, { x: 0, y: 0, z: 2 });
});

test("duplicate walls are removed and collinear walls are merged", () => {
    const walls = [
        { id: "a", start: { id: "c1", position: { x: 0, y: 0, z: 0 } }, end: { id: "c2", position: { x: 1, y: 0, z: 0 } } },
        { id: "b", start: { id: "c2", position: { x: 1, y: 0, z: 0 } }, end: { id: "c3", position: { x: 2, y: 0, z: 0 } } },
        { id: "copy", start: { id: "c2", position: { x: 1, y: 0, z: 0 } }, end: { id: "c1", position: { x: 0, y: 0, z: 0 } } }
    ];
    const corners = [
        { id: "c1", position: { x: 0, y: 0, z: 0 } },
        { id: "c2", position: { x: 1, y: 0, z: 0 } },
        { id: "c3", position: { x: 2, y: 0, z: 0 } }
    ];
    const deduplicated = removeDuplicateWalls(walls);
    assert.equal(deduplicated.length, 2);
    const merged = mergeCollinearWalls(corners, deduplicated);
    assert.equal(merged.walls.length, 1);
});

test("room wall segments share corners and create a closed rectangle", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const points = [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 4, y: 0, z: 3 },
        { x: 0, y: 0, z: 3 }
    ];
    const corners = points.map(position => ({
        id: `corner-${position.x}-${position.z}`,
        position
    }));
    structure = { ...structure, corners };

    for (let index = 0; index < corners.length; index += 1) {
        structure = addWallSegmentToStructure(
            structure,
            corners[index],
            corners[(index + 1) % corners.length]
        );
    }

    assert.equal(structure.walls.length, 4);
    assert.equal(structure.corners.length, 4);
});

test("wall segment insertion splits existing walls at intersections", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const start = { id: "start", position: { x: -1, y: 0, z: 2 } };
    const end = { id: "end", position: { x: 1, y: 0, z: 2 } };
    const north = { id: "north", position: { x: 0, y: 0, z: 0 } };
    const south = { id: "south", position: { x: 0, y: 0, z: 4 } };
    structure = {
        ...structure,
        corners: [start, end, north, south],
        walls: [{
            id: "existing",
            start: { id: north.id, position: north.position },
            end: { id: south.id, position: south.position }
        }]
    };

    structure = addWallSegmentToStructure(structure, start, end);

    assert.equal(structure.walls.length, 4);
    assert.equal(structure.corners.length, 5);
});

test("arch rise changes the shared admin wall opening geometry", () => {
    const wall = {
        id: "wall",
        start: { id: "a", position: new Vector3(0, 0, 0) },
        end: { id: "b", position: new Vector3(6, 0, 0) }
    };
    const opening = {
        id: "opening",
        wallId: "wall",
        position: new Vector3(3, 0, 0),
        width: 2,
        height: 2,
        shape: "arch"
    };
    const lowerArch = buildAdminWallMeshes(wall, 3, 0.15, [], [{ ...opening, archRise: 0.5 }], []);
    const tallerArch = buildAdminWallMeshes(wall, 3, 0.15, [], [{ ...opening, archRise: 1 }], []);
    const pieces = (items) => items.map(piece => [
        piece.position.x,
        piece.position.y,
        piece.position.z,
        piece.width,
        piece.height
    ]);

    assert.notDeepEqual(pieces(lowerArch), pieces(tallerArch));
});
