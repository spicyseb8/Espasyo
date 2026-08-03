import { Vector3 } from "three";

import type { Wall } from "./WallTypes";

export interface WallIntersection {

    wall: Wall;

    point: Vector3;

}

export function findSegmentIntersections(

    start: Vector3,
    end: Vector3,

    walls: Wall[]

): WallIntersection[] {

    const intersections: WallIntersection[] = [];

    for (const wall of walls) {

        const point = getSegmentIntersection(

            start,
            end,

            wall.start.position,
            wall.end.position

        );

        if (!point)
            continue;

        intersections.push({

            wall,
            point

        });

    }

    //----------------------------------------
    // Closest first
    //----------------------------------------

    intersections.sort(

        (a, b) =>

            a.point.distanceTo(start) -

            b.point.distanceTo(start)

    );

    return intersections;

}