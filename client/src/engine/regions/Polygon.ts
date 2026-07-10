import { Vector3 } from "three";

export interface RegionPolygon {

    corners: Vector3[];

}

export function polygonArea(points: Vector3[]) {

    let area = 0;

    for (let i = 0; i < points.length; i++) {

        const a = points[i];
        const b = points[(i + 1) % points.length];

        area += a.x * b.z - b.x * a.z;

    }

    return area / 2;

}