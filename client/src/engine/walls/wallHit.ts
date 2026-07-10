import { Vector3 } from "three";

import type { Wall } from "./WallTypes";

import {

    closestPointOnWall

} from "./wallSnapping";

export function hitWall(

    point: Vector3,

    walls: Wall[],

    radius = 0.25

): Wall | null {

    for (const wall of walls) {

        const closest = closestPointOnWall(

            point,

            wall

        );

        if (

            closest.distanceTo(point) < radius

        ) {

            return wall;

        }

    }

    return null;

}