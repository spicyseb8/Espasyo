import { Object3D, Raycaster, Vector3 } from "three";

import type { Wall } from "./WallTypes";

import {

    closestPointOnWall

} from "./wallSnapping";

//----------------------------------------------------
// Distance-based hit test (ground point -> nearest wall)
//----------------------------------------------------
// Kept for anything else that still wants a "closest wall
// to a ground point" query (e.g. snapping).
//----------------------------------------------------

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

//----------------------------------------------------
// Raycast-based wall hit test
//----------------------------------------------------
// The wall mesh itself intercepts the ray -- click anywhere
// on the wall (top, side, thick or thin) and it counts.
//
// Returns both the wall AND the actual 3D point the ray hit
// on that wall, projected straight down onto the ground
// (y = 0). That projected point is what should be used as
// the "click point" everywhere -- Default, Join, and Split
// modes all consume it the same way.
//----------------------------------------------------

export interface WallPointHit {

    wall: Wall;

    point: Vector3;

}

export function hitWallAtPoint(

    point: Vector3,

    walls: Wall[],

    radius = 0.25

): WallPointHit | null {

    for (const wall of walls) {

        const closest = closestPointOnWall(

            point,

            wall

        );

        if (

            closest.distanceTo(point) < radius

        ) {

            return {

                wall,

                point: closest

            };

        }

    }

    return null;

}
export interface WallRaycastHit {

    wall: Wall;

    point: Vector3;

}

export function hitWallByRaycast(

    raycaster: Raycaster,

    objects: Object3D[],

    walls: Wall[]

): WallRaycastHit | null {

    const intersects = raycaster.intersectObjects(

        objects,

        true

    );

    for (const hit of intersects) {

        const wallId = hit.object.userData?.wallId;

        if (!wallId)
            continue;

        const wall = walls.find(

            w => w.id === wallId

        );

        if (!wall)
            continue;

        // Project the hit point vertically onto the ground --
        // we want the (x, z) of where the ray hit the wall,
        // not the wall's actual height.
        const point = hit.point.clone();

        point.y = 0;

        return {

            wall,

            point

        };

    }

    return null;

}