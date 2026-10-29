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

export function findNearestWallEndpoint(
    point: Point3,
    corners: StructureCorner[],
    walls: StructureWall[],
    radius = 0.35
): StructureCorner | null {
    let nearest: StructureCorner | null = null;
    let nearestDistance = radius;
    const candidates = new Map<string, StructureCorner>();
    for (const corner of corners) candidates.set(corner.id, corner);
    for (const wall of walls) {
        candidates.set(wall.start.id, wall.start);
        candidates.set(wall.end.id, wall.end);
    }
    for (const corner of candidates.values()) {
        const currentDistance = distance(point, corner.position);
        if (currentDistance < nearestDistance) {
            nearestDistance = currentDistance;
            nearest = corner;
        }
    }
    return nearest;
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

export function resolveWallDrawingPoint(
    point: Point3,
    structure: ManagedStructure,
    snapCornerId: string | null = null,
    hostWallId: string | null = null
): Point3 {
    if (snapCornerId) {
        const corner = structure.corners.find(item => item.id === snapCornerId) ??
            structure.walls.flatMap(wall => [wall.start, wall.end])
                .find(endpoint => endpoint.id === snapCornerId);
        if (corner) return { ...corner.position };
    }

    const hostWall = hostWallId
        ? structure.walls.find(wall => wall.id === hostWallId)
        : undefined;
    if (hostWall) {
        return closestPointOnWall(point, hostWall);
    }

    let snapped = snapToGrid(point, structure.gridSize);
    snapped = snapToWallEndpoint(snapped, structure.walls);
    return snapToCorner(snapped, structure.corners);
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
        const ax = a.x - start.x;
        const az = a.z - start.z;
        if (Math.abs(denominator) < 0.000001) {
            if (Math.abs(ax * dz1 - az * dx1) > 0.000001) continue;
            const lengthSquared = dx1 * dx1 + dz1 * dz1;
            if (lengthSquared <= 0.000001) continue;
            for (const endpoint of [a, b]) {
                const parameter = ((endpoint.x - start.x) * dx1 + (endpoint.z - start.z) * dz1) / lengthSquared;
                if (parameter >= -0.000001 && parameter <= 1.000001) {
                    intersections.push({
                        wallId: wall.id,
                        point: { ...endpoint },
                        parameter: Math.max(0, Math.min(1, parameter))
                    });
                }
            }
            for (const endpoint of [start, end]) {
                const endpointParameter = ((endpoint.x - a.x) * dx2 + (endpoint.z - a.z) * dz2) /
                    (dx2 * dx2 + dz2 * dz2);
                if (
                    endpointParameter >= -0.000001 &&
                    endpointParameter <= 1.000001 &&
                    Math.abs((endpoint.x - a.x) * dz2 - (endpoint.z - a.z) * dx2) <= 0.000001
                ) {
                    intersections.push({
                        wallId: wall.id,
                        point: { ...endpoint },
                        parameter: endpoint === start ? 0 : 1
                    });
                }
            }
            continue;
        }
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
    if (
        startCorner.id === endCorner.id ||
        distance(startCorner.position, endCorner.position) <= 0.001
    ) return structure;

    const endPoint = endCorner.position;
    const corners = [...structure.corners];
    const sourceWalls = removeDuplicateWalls(structure.walls);

    const findWallEndpointAt = (point: Point3): StructureCorner | undefined => {
        for (const wall of sourceWalls) {
            for (const endpoint of [wall.start, wall.end]) {
                if (distance(endpoint.position, point) < 0.001) return endpoint;
            }
        }
        return undefined;
    };

    const findCornerAt = (point: Point3): StructureCorner | undefined => {
        const endpoint = findWallEndpointAt(point);
        if (endpoint) return endpoint;
        const corner = corners.find(item => distance(item.position, point) < 0.001);
        if (corner) return corner;
        return undefined;
    };

    const existingWalls = sourceWalls.map(wall => ({
        ...wall,
        start: findCornerAt(wall.start.position) ?? wall.start,
        end: findCornerAt(wall.end.position) ?? wall.end
    }));
    const getOrCreateCorner = (point: Point3): StructureCorner => {
        const existing = findCornerAt(point);
        if (existing) return existing;
        const corner = { id: crypto.randomUUID(), position: { ...point } };
        corners.push(corner);
        return corner;
    };

    const canonicalStart = findCornerAt(startCorner.position) ?? startCorner;
    const canonicalEnd = findCornerAt(endCorner.position) ?? endCorner;
    for (const corner of [startCorner, endCorner]) {
        if (!corners.some(existing => existing.id === corner.id)) {
            corners.push(corner);
        }
    }
    const intersections = findSegmentIntersections(startCorner.position, endPoint, existingWalls);
    const pathCorners = [
        { parameter: 0, corner: canonicalStart },
        ...intersections.map(intersection => ({
            parameter: intersection.parameter,
            corner: getOrCreateCorner(intersection.point)
        })),
        { parameter: 1, corner: canonicalEnd }
    ].sort((a, b) => a.parameter - b.parameter);

    const orderedCorners = pathCorners.reduce<StructureCorner[]>((ordered, item) => {
        const last = ordered.at(-1);
        if (!last || distance(last.position, item.corner.position) > 0.001) {
            ordered.push(item.corner);
        }
        return ordered;
    }, []);

    const walls: StructureWall[] = [];
    const splitWallSections = new Map<string, StructureWall[]>();
    for (const wall of existingWalls) {
        const dx = wall.end.position.x - wall.start.position.x;
        const dz = wall.end.position.z - wall.start.position.z;
        const lengthSquared = dx * dx + dz * dz;
        if (lengthSquared <= 0.000001) continue;

        const cuts = intersections
            .filter(intersection => intersection.wallId === wall.id)
            .map(intersection => {
                const parameter = (
                    (intersection.point.x - wall.start.position.x) * dx +
                    (intersection.point.z - wall.start.position.z) * dz
                ) / lengthSquared;
                const point = parameter <= 0.001
                    ? wall.start.position
                    : parameter >= 0.999
                    ? wall.end.position
                    : intersection.point;
                const corner = parameter <= 0.001
                    ? wall.start
                    : parameter >= 0.999
                    ? wall.end
                    : getOrCreateCorner(point);
                return { parameter: Math.max(0, Math.min(1, parameter)), corner };
            })
            .sort((a, b) => a.parameter - b.parameter);
        const wallCorners = [
            { parameter: 0, corner: wall.start },
            ...cuts,
            { parameter: 1, corner: wall.end }
        ].reduce<Array<{ parameter: number; corner: StructureCorner }>>((result, item) => {
            const last = result.at(-1);
            if (!last || distance(last.corner.position, item.corner.position) > 0.001) {
                result.push(item);
            }
            return result;
        }, []);

        const sections: StructureWall[] = [];
        for (let index = 0; index < wallCorners.length - 1; index += 1) {
            const start = wallCorners[index].corner;
            const end = wallCorners[index + 1].corner;
            if (distance(start.position, end.position) <= 0.001) continue;
            sections.push({
                id: sections.length === 0 ? wall.id : crypto.randomUUID(),
                start: { id: start.id, position: { ...start.position } },
                end: { id: end.id, position: { ...end.position } }
            });
        }
        splitWallSections.set(wall.id, sections);
        walls.push(...sections);
    }

    for (let index = 0; index < orderedCorners.length - 1; index += 1) {
        const start = orderedCorners[index];
        const end = orderedCorners[index + 1];
        if (distance(start.position, end.position) <= 0.001) continue;
        walls.push({
            id: crypto.randomUUID(),
            start: { id: start.id, position: { ...start.position } },
            end: { id: end.id, position: { ...end.position } }
        });
    }

    const remapElements = <T extends { wallId: string; position: Point3 }>(elements: T[]): T[] =>
        elements.map(element => {
            const sections = splitWallSections.get(element.wallId);
            if (!sections || sections.length <= 1) return element;
            const host = sections.find(section =>
                pointOnSegment2D(
                    element.position,
                    section.start.position,
                    section.end.position
                )
            );
            return host ? { ...element, wallId: host.id } : element;
        });
    const wallFinishes = { ...structure.wallFinishes };
    for (const [wallId, sections] of splitWallSections) {
        const finishes = structure.wallFinishes[wallId];
        if (finishes) {
            for (const section of sections) {
                if (section.id !== wallId) wallFinishes[section.id] = { ...finishes };
            }
        }
    }
    const candidate = {
        ...structure,
        corners,
        walls: removeDuplicateWalls(walls),
        doors: remapElements(structure.doors),
        windows: remapElements(structure.windows),
        openings: remapElements(structure.openings),
        wallFinishes
    };
    const normalized = normalizeStructure(candidate);
    return {
        ...candidate,
        corners: normalized.corners,
        walls: normalized.walls,
        doors: normalized.reassignedElements.doors,
        windows: normalized.reassignedElements.windows
    };
}

function pointOnSegment2D(point: Point3, start: Point3, end: Point3): boolean {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared <= 0.000001) return distance(point, start) <= 0.001;
    const t = ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared;
    if (t < -0.000001 || t > 1.000001) return false;
    return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz)) <= 0.001;
}

function pointInsidePolygon2D(point: Point3, polygon: Point3[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        if (pointOnSegment2D(point, a, b)) return false;
        if (
            (a.z > point.z) !== (b.z > point.z) &&
            point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
        ) {
            inside = !inside;
        }
    }
    return inside;
}

function segmentsCrossInterior(a: Point3, b: Point3, c: Point3, d: Point3): boolean {
    const cross = (p: Point3, q: Point3, r: Point3) =>
        (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
        ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function polygonContained2D(child: Point3[], parent: Point3[]): boolean {
    return child.every(point =>
        pointInsidePolygon2D(point, parent) ||
        parent.some((corner, index) => pointOnSegment2D(point, corner, parent[(index + 1) % parent.length]))
    );
}

export function hasPartialPolygonOverlap(a: Point3[], b: Point3[]): boolean {
    const intersects = a.some((point, index) =>
        b.some((other, otherIndex) =>
            segmentsCrossInterior(point, a[(index + 1) % a.length], other, b[(otherIndex + 1) % b.length])
        )
    );
    const containsPoint =
        a.some(point => pointInsidePolygon2D(point, b)) ||
        b.some(point => pointInsidePolygon2D(point, a));
    if (!intersects && !containsPoint) return false;
    return !polygonContained2D(a, b) && !polygonContained2D(b, a);
}
