import {
    Object3D,
    Raycaster,
    Vector3
} from "three";

import type {
    Wall
} from "./WallTypes";

export interface WallPointHit {
    wall: Wall;
    point: Vector3;
}

export interface WallRaycastHit {
    wall: Wall;
    point: Vector3;
    surfacePoint: Vector3;
}

export function hitWallAtPoint(
    point: Vector3,
    walls: Wall[],
    radius = 0.15
): WallPointHit | null {
    return hitWall(
        point,
        walls,
        radius
    );
}
    /*
     * Existing callers can continue using this.
     * It always uses Y = 0.
     */
    point: Vector3;

    /*
     * Actual 3D wall hit.
     * Furniture mounting uses this.
     */
    surfacePoint: Vector3;


//==================================================
// Logical wall hit
//==================================================

export function hitWall(
    point: Vector3,
    walls: Wall[],
    radius = 0.15
): WallPointHit | null {
    let closest:
        WallPointHit | null = null;

    let closestDistance =
        Number.POSITIVE_INFINITY;

    for (
        const wall of walls
    ) {
        const start =
            wall.start.position;

        const end =
            wall.end.position;

        const dx =
            end.x -
            start.x;

        const dz =
            end.z -
            start.z;

        const lengthSquared =
            dx * dx +
            dz * dz;

        if (
            lengthSquared <=
            0.000001
        ) {
            continue;
        }

        let t =
            (
                (
                    point.x -
                    start.x
                ) * dx +

                (
                    point.z -
                    start.z
                ) * dz
            ) /
            lengthSquared;

        t =
            Math.max(
                0,
                Math.min(
                    1,
                    t
                )
            );

        const nearest =
            new Vector3(
                start.x +
                    dx * t,

                0,

                start.z +
                    dz * t
            );

        const distance =
            nearest.distanceTo(
                new Vector3(
                    point.x,
                    0,
                    point.z
                )
            );

        if (
            distance <= radius &&
            distance < closestDistance
        ) {
            closestDistance =
                distance;

            closest = {
                wall,
                point: nearest
            };
        }
    }

    return closest;
}

//==================================================
// Walk object hierarchy
//==================================================

function findWallId(
    object: Object3D
): string | null {
    let current:
        Object3D | null =
        object;

    while (current) {
        const wallId =
            current.userData
                ?.wallId;

        if (
            typeof wallId ===
            "string"
        ) {
            return wallId;
        }

        current =
            current.parent;
    }

    return null;
}

//==================================================
// Raycast wall
//==================================================

export function hitWallByRaycast(
    raycaster: Raycaster,
    objects: Object3D[],
    walls: Wall[]
): WallRaycastHit | null {
    const hits =
        raycaster.intersectObjects(
            objects,
            true
        );

    for (
        const hit of hits
    ) {
        /*
         * Ignore wall finish objects.
         */
        if (
            hit.object.userData
                ?.isWallFinish === true
        ) {
            continue;
        }

        const wallId =
            findWallId(
                hit.object
            );

        if (!wallId) {
            continue;
        }

        const wall =
            walls.find(
                candidate =>
                    candidate.id ===
                    wallId
            );

        if (!wall) {
            continue;
        }

        const surfacePoint =
            hit.point.clone();

        const point =
            surfacePoint.clone();
        
        /*
         * Keep existing wall tools
         * working at floor level.
         */
        point.y = 0;

        return {
            wall,
            point,
            surfacePoint
        };
    }

    return null;
}