import { Vector3 } from "three";
import type { Wall } from "./WallTypes";

export interface WallIntersection {

    wall: Wall;

    point: Vector3;

    distance: number;

}

const EPSILON = 0.0001;

export function findWallIntersections(

    start: Vector3,

    end: Vector3,

    walls: Wall[]

): WallIntersection[] {

    const intersections: WallIntersection[] = [];

    for (const wall of walls) {

        const hit = segmentIntersection(

            start,
            end,

            wall.start.position,
            wall.end.position

        );

        if (!hit)
            continue;

        // Ignore intersections exactly on the wall's endpoints.
        // Connecting to an existing corner is handled elsewhere.
        if (

            hit.distanceTo(wall.start.position) < EPSILON ||

            hit.distanceTo(wall.end.position) < EPSILON

        ) {

            continue;

        }

        intersections.push({

            wall,

            point: hit,

            distance: hit.distanceTo(start)

        });

    }

    // Closest intersection first
    intersections.sort(

        (a, b) => a.distance - b.distance

    );

    return intersections;

}

function segmentIntersection(

    a1: Vector3,
    a2: Vector3,

    b1: Vector3,
    b2: Vector3

): Vector3 | null {

    const x1 = a1.x;
    const z1 = a1.z;

    const x2 = a2.x;
    const z2 = a2.z;

    const x3 = b1.x;
    const z3 = b1.z;

    const x4 = b2.x;
    const z4 = b2.z;

    const denominator =

        (x1 - x2) * (z3 - z4) -

        (z1 - z2) * (x3 - x4);

    if (Math.abs(denominator) < EPSILON)
        return null;

    const t =

        ((x1 - x3) * (z3 - z4) -

            (z1 - z3) * (x3 - x4)) /

        denominator;

    const u =

        ((x1 - x3) * (z1 - z2) -

            (z1 - z3) * (x1 - x2)) /

        denominator;

    if (

        t < 0 ||
        t > 1 ||

        u < 0 ||
        u > 1

    ) {

        return null;

    }

    return new Vector3(

        x1 + t * (x2 - x1),

        0,

        z1 + t * (z2 - z1)

    );

}