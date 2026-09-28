import { Vector3 } from "three";

import type { Wall } from "../walls/WallTypes";

export interface BoundaryLoop {
    corners: Vector3[];
    wallIds: string[];
}

export interface RegionPolygon {
    corners: Vector3[];
}

export interface Region extends RegionPolygon {
    id: string;

    walls: Wall[];

    // The outer boundary of this region plus any enclosed
    // child boundaries that should be treated as holes.
    boundaryLoops: BoundaryLoop[];

    parentRegionId: string | null;

    childRegionIds: string[];

    adjacentRegionIds: string[];

    area: number;

    perimeter: number;

    relationshipSummary: string[];
}

export function polygonArea(points: Vector3[]): number {
    if (points.length < 3) {
        return 0;
    }

    let area = 0;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];

        area += a.x * b.z - b.x * a.z;
    }

    return area / 2;
}

export function pointInPolygon(
    point: Vector3,
    polygon: Vector3[]
): boolean {

    if (polygon.length < 3) {
        return false;
    }

    let inside = false;

    for (
        let i = 0, j = polygon.length - 1;
        i < polygon.length;
        j = i++
    ) {
        const a = polygon[i];
        const b = polygon[j];

        const intersects =
            ((a.z > point.z) !== (b.z > point.z)) &&
            (
                point.x <
                ((b.x - a.x) * (point.z - a.z)) /
                (b.z - a.z) +
                a.x
            );

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
}

export function polygonPerimeter(
    points: Vector3[]
): number {

    if (points.length < 2) {
        return 0;
    }

    let perimeter = 0;

    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];

        perimeter += current.distanceTo(next);
    }

    return perimeter;
}