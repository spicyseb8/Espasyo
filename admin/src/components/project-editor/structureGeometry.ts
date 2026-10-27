import type { ManagedStructure, StructureCorner, StructureWall, StructureElement } from "./structureTypes";

export interface Point3 {
    x: number;
    y: number;
    z: number;
}

export interface WallSegment {
    start: Point3;
    end: Point3;
}

export interface RoomPreviewGeometry {
    corners: [Point3, Point3, Point3, Point3];
    width: number;
    length: number;
    area: number;
}

export function getRoomPreviewGeometry(start: Point3, end: Point3): RoomPreviewGeometry {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);
    const width = maxX - minX;
    const length = maxZ - minZ;

    return {
        corners: [
            { x: minX, y: 0, z: minZ },
            { x: maxX, y: 0, z: minZ },
            { x: maxX, y: 0, z: maxZ },
            { x: minX, y: 0, z: maxZ }
        ],
        width,
        length,
        area: width * length
    };
}

function distance(a: Point3, b: Point3): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function snapToGrid(point: Point3, gridSize: number): Point3 {
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: point.y,
        z: Math.round(point.z / gridSize) * gridSize
    };
}

export function snapToCorner(point: Point3, corners: StructureCorner[], radius = 0.15): Point3 {
    let nearest: Point3 | null = null;
    let nearestDistance = radius;
    for (const corner of corners) {
        const currentDistance = distance(point, corner.position);
        if (currentDistance < nearestDistance) {
            nearestDistance = currentDistance;
            nearest = corner.position;
        }
    }
    return nearest ? { ...nearest } : { ...point };
}

export function snapToWallEndpoint(point: Point3, walls: StructureWall[], radius = 0.35): Point3 {
    let nearest: Point3 | null = null;
    let nearestDistance = radius;
    for (const wall of walls) {
        for (const endpoint of [wall.start.position, wall.end.position]) {
            const currentDistance = distance(point, endpoint);
            if (currentDistance < nearestDistance) {
                nearestDistance = currentDistance;
                nearest = endpoint;
            }
        }
    }
    return nearest ? { ...nearest } : { ...point };
}

export function closestPointOnWall(point: Point3, wall: StructureWall): Point3 {
    const start = wall.start.position;
    const end = wall.end.position;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared === 0) return { ...start };
    const t = Math.max(0, Math.min(1,
        ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
    ));
    return { x: start.x + dx * t, y: 0, z: start.z + dz * t };
}

export function snapToWall(point: Point3, walls: StructureWall[], radius = 0.35): Point3 {
    let nearest = { ...point };
    let nearestDistance = radius;
    for (const wall of walls) {
        const projected = closestPointOnWall(point, wall);
        const currentDistance = distance(point, projected);
        if (currentDistance < nearestDistance) {
            nearestDistance = currentDistance;
            nearest = projected;
        }
    }
    return nearest;
}

export function snap90Degrees(start: Point3, end: Point3, tolerance = 0.2): Point3 {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    if (Math.abs(dz) < tolerance) return { ...end, z: start.z };
    if (Math.abs(dx) < tolerance) return { ...end, x: start.x };
    return { ...end };
}

export function findExistingCorner(point: Point3, corners: StructureCorner[], tolerance = 0.05): StructureCorner | null {
    let nearest: StructureCorner | null = null;
    let nearestDistance = tolerance;
    for (const corner of corners) {
        const currentDistance = distance(point, corner.position);
        if (currentDistance < nearestDistance) {
            nearestDistance = currentDistance;
            nearest = corner;
        }
    }
    return nearest;
}

export function findOrCreateCorner(point: Point3, corners: StructureCorner[]): { corners: StructureCorner[]; corner: StructureCorner } {
    const existing = findExistingCorner(point, corners);
    if (existing) return { corners, corner: existing };
    const corner = { id: crypto.randomUUID(), position: { ...point } };
    return { corners: [...corners, corner], corner };
}

function orientation(a: Point3, b: Point3, c: Point3): number {
    return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

export interface SegmentIntersection {
    wallId: string;
    point: Point3;
    parameter: number;
}

export function findSegmentIntersections(start: Point3, end: Point3, walls: StructureWall[]): SegmentIntersection[] {
    const intersections: SegmentIntersection[] = [];
    const dx1 = end.x - start.x;
    const dz1 = end.z - start.z;
    for (const wall of walls) {
        const a = wall.start.position;
        const b = wall.end.position;
        const dx2 = b.x - a.x;
        const dz2 = b.z - a.z;
        const denominator = dx1 * dz2 - dz1 * dx2;
        if (Math.abs(denominator) < 0.000001) continue;
        const ax = a.x - start.x;
        const az = a.z - start.z;
        const t = (ax * dz2 - az * dx2) / denominator;
        const u = (ax * dz1 - az * dx1) / denominator;
        if (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001) continue;
        intersections.push({
            wallId: wall.id,
            point: { x: start.x + t * dx1, y: 0, z: start.z + t * dz1 },
            parameter: t
        });
    }
    return intersections.sort((a, b) => a.parameter - b.parameter);
}

export function splitWall(wall: StructureWall, splitCorner: StructureCorner): [StructureWall, StructureWall] {
    return [
        { id: crypto.randomUUID(), start: wall.start, end: { id: splitCorner.id, position: { ...splitCorner.position } } },
        { id: crypto.randomUUID(), start: { id: splitCorner.id, position: { ...splitCorner.position } }, end: wall.end }
    ];
}

export function removeDuplicateWalls(walls: StructureWall[]): StructureWall[] {
    const unique: StructureWall[] = [];
    for (const wall of walls) {
        const duplicate = unique.some(other =>
            (other.start.id === wall.start.id && other.end.id === wall.end.id)
            || (other.start.id === wall.end.id && other.end.id === wall.start.id)
        );
        if (!duplicate) unique.push(wall);
    }
    return unique;
}

function areCollinear(a: Point3, b: Point3, c: Point3): boolean {
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    if (ab === 0 || bc === 0) return false;
    const cross = Math.abs(orientation(a, b, c));
    return cross / (ab * bc) < 0.0001;
}

export function mergeCollinearWalls(corners: StructureCorner[], walls: StructureWall[]): { corners: StructureCorner[]; walls: StructureWall[] } {
    let nextWalls = [...walls];
    let nextCorners = [...corners];
    let changed = true;
    while (changed) {
        changed = false;
        for (const corner of [...nextCorners]) {
            const connected = nextWalls.filter(wall => wall.start.id === corner.id || wall.end.id === corner.id);
            if (connected.length !== 2) continue;
            const wallA = connected[0];
            const wallB = connected[1];
            const otherA = wallA.start.id === corner.id ? wallA.end : wallA.start;
            const otherB = wallB.start.id === corner.id ? wallB.end : wallB.start;
            if (!areCollinear(otherA.position, corner.position, otherB.position)) continue;
            nextWalls = nextWalls.filter(wall => wall.id !== wallA.id && wall.id !== wallB.id);
            nextWalls.push({ id: wallA.id, start: otherA, end: otherB });
            nextCorners = nextCorners.filter(item => item.id !== corner.id);
            changed = true;
            break;
        }
    }
    return { corners: nextCorners, walls: removeDuplicateWalls(nextWalls) };
}

export interface NormalizeStructureResult {
    corners: StructureCorner[];
    walls: StructureWall[];
    reassignedElements: { doors: StructureElement[]; windows: StructureElement[] };
}

export function normalizeStructure(structure: ManagedStructure): NormalizeStructureResult {
    let corners = [...structure.corners];
    let walls = removeDuplicateWalls(structure.walls);
    const doors = structure.doors.map(element => ({ ...element }));
    const windows = structure.windows.map(element => ({ ...element }));

    // Existing elements retain their wall when host wall IDs survive normalization.
    // Split walls are handled separately by placeWall and preserve stable host IDs for existing elements.
    const merged = mergeCollinearWalls(corners, walls);
    corners = merged.corners;
    walls = merged.walls;

    // Remove orphaned corners only after structural cleanup.
    const usedCornerIds = new Set(walls.flatMap(wall => [wall.start.id, wall.end.id]));
    corners = corners.filter(corner => usedCornerIds.has(corner.id));

    return {
        corners,
        walls,
        reassignedElements: { doors, windows }
    };
}

export function wallLength(wall: StructureWall): number {
    return distance(wall.start.position, wall.end.position);
}

export function wallSurfaceArea(wall: StructureWall, height: number): number {
    return wallLength(wall) * height;
}

export function addWallSegmentToStructure(
    structure: ManagedStructure,
    startCorner: StructureCorner,
    endCorner: StructureCorner
): ManagedStructure {
    if (startCorner.id === endCorner.id) return structure;

    const endPoint = snap90Degrees(startCorner.position, endCorner.position);
    let corners = [...structure.corners];
    let walls = [...structure.walls];
    for (const corner of [startCorner, endCorner]) {
        if (!corners.some(existing => existing.id === corner.id)) {
            corners.push(corner);
        }
    }
    const intersections = findSegmentIntersections(startCorner.position, endPoint, walls);
    const orderedCorners = [startCorner];

    for (const intersection of intersections) {
        const existingCorner = corners.find(corner =>
            distance(corner.position, intersection.point) < 0.001
        );
        const splitCorner = existingCorner ?? {
            id: crypto.randomUUID(),
            position: intersection.point
        };
        if (!existingCorner) corners = [...corners, splitCorner];
        const hitWall = walls.find(wall => wall.id === intersection.wallId);
        if (hitWall) {
            const alreadySplit = walls.some(wall =>
                wall.start.id === splitCorner.id || wall.end.id === splitCorner.id
            );
            if (!alreadySplit) {
                const [left, right] = splitWall(hitWall, splitCorner);
                walls = walls.filter(wall => wall.id !== hitWall.id);
                walls.push(left, right);
            }
        }
        if (!orderedCorners.some(corner => corner.id === splitCorner.id)) {
            orderedCorners.push(splitCorner);
        }
    }

    if (!orderedCorners.some(corner => corner.id === endCorner.id)) {
        orderedCorners.push(endCorner);
    }
    for (let index = 0; index < orderedCorners.length - 1; index += 1) {
        walls.push({
            id: crypto.randomUUID(),
            start: { id: orderedCorners[index].id, position: orderedCorners[index].position },
            end: { id: orderedCorners[index + 1].id, position: orderedCorners[index + 1].position }
        });
    }

    const candidate = { ...structure, corners, walls };
    const normalized = normalizeStructure(candidate);
    return {
        ...candidate,
        corners: normalized.corners,
        walls: normalized.walls,
        doors: normalized.reassignedElements.doors,
        windows: normalized.reassignedElements.windows
    };
}
