import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { buildAdminWallMeshes } from "../project-loader/engine/walls/AdminWallMeshBuilder.ts";
import { polygonArea } from "../project-loader/engine/regions/Polygon.ts";
import {
    addWallSegmentToStructure,
    findOrCreateCorner,
    findNearestWallEndpoint,
    getRoomPreviewGeometry,
    findSegmentIntersections,
    hasPartialPolygonOverlap,
    mergeCollinearWalls,
    resolveWallDrawingPoint,
    removeDuplicateWalls,
    snap90Degrees,
    snapToCorner,
    snapToGrid,
    wallSurfaceArea
} from "./structureGeometry.ts";
import { createManagedStructure } from "./structureTypes.ts";
import { calculateBuildElementPlacement } from "./buildElementPlacement.ts";
import { solveRegions } from "../project-loader/engine/regions/RegionSolver.ts";
import { createAdminFloorGeometry } from "../project-loader/loader-components/floorGeometry.ts";

function solveStructureRegions(structure) {
    return solveRegions(
        structure.corners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, 0, corner.position.z)
        })),
        structure.walls.map(wall => ({
            id: wall.id,
            start: { id: wall.start.id, position: new Vector3(wall.start.position.x, 0, wall.start.position.z) },
            end: { id: wall.end.id, position: new Vector3(wall.end.position.x, 0, wall.end.position.z) }
        }))
    );
}

function assertFloorTriangulation(regions) {
    const meshes = [];
    for (const region of regions) {
        const geometry = createAdminFloorGeometry(region.boundaryLoops);
        assert.ok(geometry, `region ${region.id} should produce floor geometry`);
        const positions = geometry.getAttribute("position");
        const indices = geometry.getIndex();
        assert.ok(positions && positions.count >= 3);
        assert.ok(indices && indices.count >= 3);
        assert.ok([...positions.array].every(Number.isFinite));
        for (let index = 0; index < indices.count; index += 3) {
            const a = new Vector3().fromBufferAttribute(positions, indices.getX(index));
            const b = new Vector3().fromBufferAttribute(positions, indices.getX(index + 1));
            const c = new Vector3().fromBufferAttribute(positions, indices.getX(index + 2));
            assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 0);
        }
        meshes.push({
            area: Math.abs(region.area),
            vertexCount: positions.count,
            indexCount: indices.count
        });
        geometry.dispose();
    }
    return meshes;
}

function addRectangularRoom(structure, minX, minZ, maxX, maxZ, prefix) {
    const corners = [
        { id: `${prefix}-sw`, position: { x: minX, y: 0, z: minZ } },
        { id: `${prefix}-se`, position: { x: maxX, y: 0, z: minZ } },
        { id: `${prefix}-ne`, position: { x: maxX, y: 0, z: maxZ } },
        { id: `${prefix}-nw`, position: { x: minX, y: 0, z: maxZ } }
    ];
    let result = { ...structure, corners: [...structure.corners, ...corners] };
    for (let index = 0; index < corners.length; index += 1) {
        result = addWallSegmentToStructure(
            result,
            corners[index],
            corners[(index + 1) % corners.length]
        );
    }
    return result;
}

function addWallAtPoints(structure, startPosition, endPosition) {
    const start = findOrCreateCorner(startPosition, structure.corners);
    const withStart = { ...structure, corners: start.corners };
    const end = findOrCreateCorner(endPosition, withStart.corners);
    return addWallSegmentToStructure(
        { ...withStart, corners: end.corners },
        start.corner,
        end.corner
    );
}

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

test("wall endpoint snapping reuses existing corner IDs and coordinates", () => {
    const corner = { id: "endpoint", position: { x: 2, y: 0, z: 3 } };
    const nearest = findNearestWallEndpoint(
        { x: 2.1, y: 0, z: 3 },
        [],
        [{ id: "wall", start: corner, end: { id: "end", position: { x: 4, y: 0, z: 3 } } }]
    );

    assert.equal(nearest.id, "endpoint");
    assert.deepEqual(nearest.position, corner.position);
});

test("committed wall endpoints retain the resolved snap coordinate and reject zero length", () => {
    const structure = createManagedStructure("p1", "Plan", "owner");
    const start = { id: "start", position: { x: 0, y: 0, z: 0 } };
    const snappedEnd = { id: "corner", position: { x: 2, y: 0, z: 1.5 } };
    const withWall = addWallSegmentToStructure(
        { ...structure, corners: [start, snappedEnd] },
        start,
        snappedEnd
    );

    assert.deepEqual(withWall.walls[0].end.position, snappedEnd.position);
    assert.equal(
        addWallSegmentToStructure(withWall, snappedEnd, snappedEnd),
        withWall
    );
});

test("partial room overlaps are distinguished from adjoining and nested regions", () => {
    const first = [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 4, y: 0, z: 4 },
        { x: 0, y: 0, z: 4 }
    ];
    const adjoining = [
        { x: 4, y: 0, z: 0 },
        { x: 8, y: 0, z: 0 },
        { x: 8, y: 0, z: 4 },
        { x: 4, y: 0, z: 4 }
    ];
    const overlapping = [
        { x: 2, y: 0, z: 2 },
        { x: 6, y: 0, z: 2 },
        { x: 6, y: 0, z: 6 },
        { x: 2, y: 0, z: 6 }
    ];
    const nested = [
        { x: 1, y: 0, z: 1 },
        { x: 3, y: 0, z: 1 },
        { x: 3, y: 0, z: 3 },
        { x: 1, y: 0, z: 3 }
    ];

    assert.equal(hasPartialPolygonOverlap(first, adjoining), false);
    assert.equal(hasPartialPolygonOverlap(first, overlapping), true);
    assert.equal(hasPartialPolygonOverlap(first, nested), false);
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

test("adjoining rooms preserve both floor regions without boundary-touching holes", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const points = [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 8, y: 0, z: 0 },
        { x: 0, y: 0, z: 3 },
        { x: 4, y: 0, z: 3 },
        { x: 8, y: 0, z: 3 }
    ];
    const corners = points.map((position, index) => ({ id: `c${index}`, position }));
    structure = { ...structure, corners };

    const roomLoops = [
        [corners[0], corners[1], corners[4], corners[3]],
        [corners[1], corners[2], corners[5], corners[4]]
    ];
    for (const loop of roomLoops) {
        for (let index = 0; index < loop.length; index += 1) {
            structure = addWallSegmentToStructure(
                structure,
                loop[index],
                loop[(index + 1) % loop.length]
            );
        }
    }

    const regions = solveRegions(
        structure.corners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, corner.position.y, corner.position.z)
        })),
        structure.walls.map(wall => ({
            id: wall.id,
            start: { id: wall.start.id, position: new Vector3(wall.start.position.x, 0, wall.start.position.z) },
            end: { id: wall.end.id, position: new Vector3(wall.end.position.x, 0, wall.end.position.z) }
        }))
    );

    assert.equal(regions.length, 2);
    assert.deepEqual(regions.map(region => Math.abs(region.area)).sort(), [12, 12]);
    assert.ok(regions.every(region => region.boundaryLoops.length === 1));
    assert.ok(regions.every(region => region.adjacentRegionIds.length === 1));
});

test("partially overlapping wall loops resolve to non-overlapping valid floor faces", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const loops = [
        [
            { x: 0, y: 0, z: 0 },
            { x: 4, y: 0, z: 0 },
            { x: 4, y: 0, z: 4 },
            { x: 0, y: 0, z: 4 }
        ],
        [
            { x: 2, y: 0, z: 2 },
            { x: 6, y: 0, z: 2 },
            { x: 6, y: 0, z: 6 },
            { x: 2, y: 0, z: 6 }
        ]
    ].map((positions, loopIndex) =>
        positions.map((position, index) => ({
            id: `overlap-${loopIndex}-${index}`,
            position
        }))
    );
    structure = { ...structure, corners: loops.flat() };
    for (const loop of loops) {
        for (let index = 0; index < loop.length; index += 1) {
            structure = addWallSegmentToStructure(
                structure,
                loop[index],
                loop[(index + 1) % loop.length]
            );
        }
    }

    const regions = solveRegions(
        structure.corners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, 0, corner.position.z)
        })),
        structure.walls.map(wall => ({
            id: wall.id,
            start: { id: wall.start.id, position: new Vector3(wall.start.position.x, 0, wall.start.position.z) },
            end: { id: wall.end.id, position: new Vector3(wall.end.position.x, 0, wall.end.position.z) }
        }))
    );

    assert.deepEqual(regions.map(region => Math.abs(region.area)).sort((a, b) => a - b), [4, 12, 12]);
    assert.ok(regions.every(region => region.boundaryLoops.length === 1));
});

test("strictly nested room floors retain a valid contained floor region", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const loops = [
        [
            { x: 0, y: 0, z: 0 },
            { x: 6, y: 0, z: 0 },
            { x: 6, y: 0, z: 6 },
            { x: 0, y: 0, z: 6 }
        ],
        [
            { x: 2, y: 0, z: 2 },
            { x: 4, y: 0, z: 2 },
            { x: 4, y: 0, z: 4 },
            { x: 2, y: 0, z: 4 }
        ]
    ].map((positions, loopIndex) =>
        positions.map((position, index) => ({
            id: `loop-${loopIndex}-corner-${index}`,
            position
        }))
    );
    structure = { ...structure, corners: loops.flat() };
    for (const loop of loops) {
        for (let index = 0; index < loop.length; index += 1) {
            structure = addWallSegmentToStructure(
                structure,
                loop[index],
                loop[(index + 1) % loop.length]
            );
        }
    }

    const regions = solveRegions(
        structure.corners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, 0, corner.position.z)
        })),
        structure.walls.map(wall => ({
            id: wall.id,
            start: { id: wall.start.id, position: new Vector3(wall.start.position.x, 0, wall.start.position.z) },
            end: { id: wall.end.id, position: new Vector3(wall.end.position.x, 0, wall.end.position.z) }
        }))
    );

    assert.equal(regions.length, 2);
    const parent = regions.find(region => region.childRegionIds.length === 1);
    const child = regions.find(region => region.parentRegionId !== null);
    assert.ok(parent);
    assert.ok(child);
    assert.equal(parent.boundaryLoops.length, 2);
    assert.equal(Math.abs(parent.area), 32);
    assert.equal(Math.abs(child.area), 4);
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

test("a wall intersecting both sides of a room splits its boundary into two valid floors", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const corners = [
        { id: "sw", position: { x: 0, y: 0, z: 0 } },
        { id: "se", position: { x: 4, y: 0, z: 0 } },
        { id: "ne", position: { x: 4, y: 0, z: 4 } },
        { id: "nw", position: { x: 0, y: 0, z: 4 } }
    ];
    structure = {
        ...structure,
        corners,
        doors: [{
            id: "existing-door",
            assetId: "door",
            wallId: "east",
            position: { x: 4, y: 0, z: 1 },
            rotationY: 0,
            width: 0.9,
            height: 2,
            depth: 0.1
        }],
        wallFinishes: { east: { north: "finish-a", south: "finish-b" } }
    };

    for (const [index, [start, end]] of [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]]
    ].entries()) {
        structure = addWallSegmentToStructure(structure, start, end);
        if (index === 1) {
            structure.walls = structure.walls.map(wall =>
                wall.start.id === "se" && wall.end.id === "ne"
                    ? { ...wall, id: "east" }
                    : wall
            );
        }
    }

    const start = { id: "outside-west", position: { x: -1, y: 0, z: 2 } };
    const end = { id: "outside-east", position: { x: 5, y: 0, z: 2 } };
    structure = addWallSegmentToStructure(
        { ...structure, corners: [...structure.corners, start, end] },
        start,
        end
    );

    const regions = solveRegions(
        structure.corners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, 0, corner.position.z)
        })),
        structure.walls.map(wall => ({
            id: wall.id,
            start: { id: wall.start.id, position: new Vector3(wall.start.position.x, 0, wall.start.position.z) },
            end: { id: wall.end.id, position: new Vector3(wall.end.position.x, 0, wall.end.position.z) }
        }))
    );
    const doorHost = structure.walls.find(wall => wall.id === structure.doors[0].wallId);
    const finishBearingEastSections = structure.walls.filter(wall =>
        wall.start.position.x === 4 && wall.end.position.x === 4
    );

    assert.deepEqual(regions.map(region => Math.abs(region.area)).sort((a, b) => a - b), [8, 8]);
    assert.equal(regions.every(region => region.corners.length === 4), true);
    assert.ok(doorHost);
    assert.equal(doorHost.start.position.x, 4);
    assert.equal(doorHost.end.position.x, 4);
    assert.ok(
        structure.doors[0].position.z >= Math.min(doorHost.start.position.z, doorHost.end.position.z) &&
        structure.doors[0].position.z <= Math.max(doorHost.start.position.z, doorHost.end.position.z)
    );
    assert.ok(finishBearingEastSections.length >= 2);
    assert.ok(finishBearingEastSections.every(wall => structure.wallFinishes[wall.id]));
});

test("a one-sided wall intersection preserves the existing closed floor", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const corners = [
        { id: "sw", position: { x: 0, y: 0, z: 0 } },
        { id: "se", position: { x: 4, y: 0, z: 0 } },
        { id: "ne", position: { x: 4, y: 0, z: 4 } },
        { id: "nw", position: { x: 0, y: 0, z: 4 } }
    ];
    structure = { ...structure, corners };
    for (const [start, end] of [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]]
    ]) {
        structure = addWallSegmentToStructure(structure, start, end);
    }
    const start = { id: "outside", position: { x: -1, y: 0, z: 2 } };
    const end = { id: "boundary", position: { x: 0, y: 0, z: 2 } };
    structure = addWallSegmentToStructure(
        { ...structure, corners: [...structure.corners, start, end] },
        start,
        end
    );

    const regions = solveRegions(
        structure.corners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, 0, corner.position.z)
        })),
        structure.walls.map(wall => ({
            id: wall.id,
            start: { id: wall.start.id, position: new Vector3(wall.start.position.x, 0, wall.start.position.z) },
            end: { id: wall.end.id, position: new Vector3(wall.end.position.x, 0, wall.end.position.z) }
        }))
    );

    assert.equal(regions.length, 1);
    assert.equal(Math.abs(regions[0].area), 16);
});

test("overlapping collinear wall segments share one normalized boundary", () => {
    let structure = createManagedStructure("p1", "Plan", "owner");
    const corners = [
        { id: "a", position: { x: 0, y: 0, z: 0 } },
        { id: "b", position: { x: 4, y: 0, z: 0 } },
        { id: "c", position: { x: 2, y: 0, z: 0 } },
        { id: "d", position: { x: 6, y: 0, z: 0 } }
    ];
    structure = {
        ...structure,
        corners,
        walls: [{
            id: "existing",
            start: { id: "a", position: corners[0].position },
            end: { id: "b", position: corners[1].position }
        }]
    };

    structure = addWallSegmentToStructure(structure, corners[2], corners[3]);

    assert.equal(structure.walls.length, 1);
    assert.equal(structure.walls[0].start.position.x, 0);
    assert.equal(structure.walls[0].end.position.x, 6);
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

test("a closed room produces a triangulated floor from the admin floor geometry builder", () => {
    const structure = addRectangularRoom(
        createManagedStructure("p1", "Plan", "owner"),
        0,
        0,
        4,
        4,
        "room"
    );
    const regions = solveStructureRegions(structure);

    assert.equal(regions.length, 1);
    assert.equal(Math.abs(regions[0].area), 16);
    assertFloorTriangulation(regions);
});

test("wall-face clicks snap to host wall centerlines and divide an off-grid room", () => {
    let structure = addRectangularRoom(
        createManagedStructure("p1", "Plan", "owner"),
        0.13,
        0.13,
        4.13,
        4.13,
        "room"
    );
    const before = solveStructureRegions(structure);
    assert.equal(before.length, 1);
    assertFloorTriangulation(before);

    const westWall = structure.walls.find(wall =>
        wall.start.position.x === 0.13 && wall.end.position.x === 0.13
    );
    const eastWall = structure.walls.find(wall =>
        wall.start.position.x === 4.13 && wall.end.position.x === 4.13
    );
    assert.ok(westWall);
    assert.ok(eastWall);

    const clickNearWestFace = { x: 0.205, y: 0, z: 2.13 };
    const clickNearEastFace = { x: 4.055, y: 0, z: 2.13 };
    const gridSnappedWest = snapToGrid(clickNearWestFace, structure.gridSize);
    const gridSnappedEast = snapToGrid(clickNearEastFace, structure.gridSize);
    assert.ok(gridSnappedWest.x > westWall.start.position.x);
    assert.ok(gridSnappedEast.x < eastWall.start.position.x);
    const priorGridSnapRegions = solveStructureRegions(
        addWallAtPoints(structure, gridSnappedWest, gridSnappedEast)
    );
    assert.equal(priorGridSnapRegions.length, 1);
    assert.ok(Math.abs(Math.abs(priorGridSnapRegions[0].area) - 16) < 1e-9);

    const start = resolveWallDrawingPoint(clickNearWestFace, structure, null, westWall.id);
    const end = resolveWallDrawingPoint(clickNearEastFace, structure, null, eastWall.id);
    assert.equal(start.x, 0.13);
    assert.equal(end.x, 4.13);
    structure = addWallAtPoints(structure, start, end);

    const regions = solveStructureRegions(structure);
    assert.deepEqual(regions.map(region => Math.abs(region.area)).sort(), [8, 8]);
    assert.deepEqual(
        assertFloorTriangulation(regions)
            .map(mesh => [mesh.area, mesh.vertexCount, mesh.indexCount])
            .sort((a, b) => a[0] - b[0]),
        [[8, 4, 6], [8, 4, 6]]
    );
});

test("a wall connecting only one room boundary preserves the original floor", () => {
    const base = addRectangularRoom(
        createManagedStructure("p1", "Plan", "owner"),
        0,
        0,
        4,
        4,
        "room"
    );
    const westWall = base.walls.find(wall =>
        wall.start.position.x === 0 && wall.end.position.x === 0
    );
    assert.ok(westWall);
    const start = resolveWallDrawingPoint(
        { x: 0, y: 0, z: 2 },
        base,
        null,
        westWall.id
    );
    const structure = addWallAtPoints(
        base,
        start,
        { x: 2, y: 0, z: 2 }
    );
    const regions = solveStructureRegions(structure);

    assert.equal(regions.length, 1);
    assert.equal(Math.abs(regions[0].area), 16);
    assertFloorTriangulation(regions);
});

test("adjoining rooms sharing a wall retain two triangulated floor regions", () => {
    let structure = addRectangularRoom(
        createManagedStructure("p1", "Plan", "owner"),
        0,
        0,
        4,
        4,
        "west"
    );
    structure = addRectangularRoom(structure, 4, 0, 8, 4, "east");
    const regions = solveStructureRegions(structure);

    assert.deepEqual(regions.map(region => Math.abs(region.area)).sort(), [16, 16]);
    assertFloorTriangulation(regions);
});

test("undo and redo snapshots preserve valid room floor triangulation", () => {
    const before = addRectangularRoom(
        createManagedStructure("p1", "Plan", "owner"),
        0,
        0,
        4,
        4,
        "room"
    );
    const partition = addWallAtPoints(
        before,
        { x: 0, y: 0, z: 2 },
        { x: 4, y: 0, z: 2 }
    );
    const undoState = before;
    const redoState = partition;

    assert.deepEqual(solveStructureRegions(undoState).map(region => Math.abs(region.area)), [16]);
    assertFloorTriangulation(solveStructureRegions(undoState));
    assert.deepEqual(solveStructureRegions(redoState).map(region => Math.abs(region.area)).sort(), [8, 8]);
    assertFloorTriangulation(solveStructureRegions(redoState));
});
