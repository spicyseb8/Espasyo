import { Vector3 } from "three";
import type { Wall } from "./WallTypes";

// Wall snapping utilities for editor

export function snapToGrid(
    point: Vector3,
    gridSize: number
): Vector3 {

    return new Vector3(

        Math.round(point.x / gridSize) * gridSize,

        point.y,

        Math.round(point.z / gridSize) * gridSize

    );

}

export function snap90Degrees(
    start: Vector3,
    end: Vector3
): Vector3 {

    const snapped = end.clone();

    const dx = snapped.x - start.x;
    const dz = snapped.z - start.z;

    const threshold = 0.35;

    if (Math.abs(dx) > Math.abs(dz) * (1 + threshold)) {

        snapped.z = start.z;

    }

    else if (Math.abs(dz) > Math.abs(dx) * (1 + threshold)) {

        snapped.x = start.x;

    }

    return snapped;

}

export function snapToWallEndpoint(

    point: Vector3,

    walls: Wall[],

    radius = 0.35

): Vector3 {

    const snapped = point.clone();

    let closestDistance = radius;

    for (const wall of walls) {

        const endpoints = [

            wall.start.position,

            wall.end.position

        ];

        for (const endpoint of endpoints) {

            const distance = point.distanceTo(endpoint);

            if (distance < closestDistance) {

                closestDistance = distance;

                snapped.copy(endpoint);

            }

        }

    }

    return snapped;

}
/**
 * Returns the closest point on a wall segment.
 */
export function closestPointOnWall(

    point: Vector3,

    wall: Wall

): Vector3 {

    const wallVector = wall.end.position.clone().sub(wall.start.position);

    const pointVector = point.clone().sub(wall.start.position);

    const lengthSquared = wallVector.lengthSq();

    if (lengthSquared === 0) {

        return wall.start.position.clone();

    }

    let t = pointVector.dot(wallVector) / lengthSquared;

    t = Math.max(0, Math.min(1, t));

    return wall.start.position.clone().add(

        wallVector.multiplyScalar(t)

    );

}


export function snapToWall(

    point: Vector3,

    walls: Wall[],

    radius = 0.35

): Vector3 {

    let snapped = point.clone();

    let closestDistance = radius;

    for (const wall of walls) {

        const closest = closestPointOnWall(

            point,

            wall

        );

        const distance = point.distanceTo(closest);

        if (distance < closestDistance) {

            closestDistance = distance;

            snapped = closest;

        }

    }

    return snapped;

}