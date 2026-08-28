import {
    Object3D,
    Raycaster,
    Vector3
} from "three";

import type {
    Wall
} from "./WallTypes";

import {
    closestPointOnWall
} from "./wallSnapping";

//----------------------------------------------------
// Distance-based hit test
//----------------------------------------------------

export function hitWall(
    point: Vector3,
    walls: Wall[],
    radius = 0.25
): Wall | null {

    for (
        const wall of walls
    ) {

        const closest =
            closestPointOnWall(
                point,
                wall
            );

        if (
            closest.distanceTo(
                point
            ) < radius
        ) {

            return wall;

        }

    }

    return null;
}
function isWallFinishObject(
    object: Object3D
): boolean {

    let current:
        Object3D | null =
        object;

    while (
        current
    ) {

        if (
            current.userData?.isWallFinish === true
        ) {

            return true;

        }

        current =
            current.parent;

    }

    return false;
}
//----------------------------------------------------
// Distance-based wall point hit
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

    for (
        const wall of walls
    ) {

        const closest =
            closestPointOnWall(
                point,
                wall
            );

        if (
            closest.distanceTo(
                point
            ) < radius
        ) {

            return {

                wall,

                point:
                    closest

            };

        }

    }

    return null;
}

//----------------------------------------------------
// Raycast-based wall hit
//----------------------------------------------------

export interface WallRaycastHit {

    wall: Wall;

    point: Vector3;

}

export function hitWallByRaycast(

    raycaster: Raycaster,

    objects: Object3D[],

    walls: Wall[]

): WallRaycastHit | null {

    const intersects =
        raycaster.intersectObjects(
            objects,
            true
        );

    //--------------------------------------------------
    // Check every intersection in distance order.
    //
    // Do NOT immediately accept wall-finish surfaces.
    //--------------------------------------------------

    for (
        const hit of intersects
    ) {

        const object =
            hit.object;

        //--------------------------------------------------
        // Ignore wall finish surfaces.
        //
        // These are visual material layers and should
        // never become the target for window/door/opening
        // placement.
        //--------------------------------------------------

            if (
        isWallFinishObject(object)
            ) {
                continue;
            }

        //--------------------------------------------------
        // Find the wall ID.
        //--------------------------------------------------

        const wallId =
            object.userData?.wallId;

        if (
            !wallId
        ) {

            continue;

        }

        //--------------------------------------------------
        // Find actual logical wall.
        //--------------------------------------------------

        const wall =
            walls.find(
                w =>
                    w.id ===
                    wallId
            );

        if (
            !wall
        ) {

            continue;

        }

        //--------------------------------------------------
        // Use actual ray hit point.
        //--------------------------------------------------

        const point =
            hit.point.clone();

        //--------------------------------------------------
        // Build placement operates on X/Z ground
        // coordinates.
        //--------------------------------------------------

        point.y = 0;

        return {

            wall,

            point

        };

    }

    return null;
}