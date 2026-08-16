import { Vector3 } from "three";

import type { Wall } from "../walls/WallTypes";
import type { Furniture } from "./FurnitureTypes";

export type FurnitureCollisionReason =
    | "none"
    | "wall"
    | "furniture";

export interface FurnitureCollisionResult {
    valid: boolean;
    reason: FurnitureCollisionReason;
}

//--------------------------------------------------
// Simple 2D footprint
//--------------------------------------------------

interface Rect2D {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

//--------------------------------------------------
// Create an axis-aligned footprint
//--------------------------------------------------
// Version 1 deliberately ignores rotation.
// Your furniture is currently placed with rotationY = 0.
// We'll upgrade this to rotated bounds later.
//--------------------------------------------------

function getFurnitureRect(
    position: Vector3,
    width: number,
    depth: number,
    padding: number
): Rect2D {

    const halfWidth =
        width * 0.5 + padding;

    const halfDepth =
        depth * 0.5 + padding;

    return {
        minX: position.x - halfWidth,
        maxX: position.x + halfWidth,
        minZ: position.z - halfDepth,
        maxZ: position.z + halfDepth
    };
}

//--------------------------------------------------
// Rectangle overlap
//--------------------------------------------------

function rectanglesOverlap(
    a: Rect2D,
    b: Rect2D
): boolean {

    return (
        a.minX < b.maxX &&
        a.maxX > b.minX &&
        a.minZ < b.maxZ &&
        a.maxZ > b.minZ
    );
}

//--------------------------------------------------
// Distance from a point to a line segment in X/Z
//--------------------------------------------------

function distancePointToSegmentXZ(
    point: Vector3,
    start: Vector3,
    end: Vector3
): number {

    const sx = start.x;
    const sz = start.z;

    const ex = end.x;
    const ez = end.z;

    const px = point.x;
    const pz = point.z;

    const dx = ex - sx;
    const dz = ez - sz;

    const lengthSquared =
        dx * dx + dz * dz;

    if (lengthSquared === 0) {
        const x = px - sx;
        const z = pz - sz;

        return Math.sqrt(
            x * x + z * z
        );
    }

    let t =
        ((px - sx) * dx +
            (pz - sz) * dz) /
        lengthSquared;

    t = Math.max(
        0,
        Math.min(1, t)
    );

    const closestX =
        sx + dx * t;

    const closestZ =
        sz + dz * t;

    const differenceX =
        px - closestX;

    const differenceZ =
        pz - closestZ;

    return Math.sqrt(
        differenceX * differenceX +
        differenceZ * differenceZ
    );
}

//--------------------------------------------------
// Furniture vs wall
//--------------------------------------------------
// Version 1:
// We approximate the furniture footprint with a circle.
// This is intentionally conservative and works well
// for preventing furniture from touching walls.
//--------------------------------------------------

function collidesWithWall(
    position: Vector3,
    width: number,
    depth: number,
    wall: Wall,
    wallThickness: number,
    padding: number
): boolean {

    const furnitureRadius =
        Math.sqrt(
            Math.pow(width * 0.5, 2) +
            Math.pow(depth * 0.5, 2)
        );

    const allowedDistance =
        furnitureRadius +
        wallThickness * 0.5 +
        padding;

    const distance =
        distancePointToSegmentXZ(
            position,
            wall.start.position,
            wall.end.position
        );

    return distance < allowedDistance;
}

//--------------------------------------------------
// Furniture vs existing furniture
//--------------------------------------------------

function collidesWithFurniture(
    position: Vector3,
    width: number,
    depth: number,
    existing: Furniture,
    padding: number
): boolean {

    const previewRect =
        getFurnitureRect(
            position,
            width,
            depth,
            padding
        );

    const existingRect =
        getFurnitureRect(
            existing.position,
            existing.width,
            existing.depth,
            padding
        );

    return rectanglesOverlap(
        previewRect,
        existingRect
    );
}

//--------------------------------------------------
// Main collision check
//--------------------------------------------------

export function checkFurnitureCollision(
    position: Vector3,
    width: number,
    depth: number,
    walls: Wall[],
    furniture: Furniture[],
    wallThickness: number,
    padding = 0.05
): FurnitureCollisionResult {

    //--------------------------------------------------
    // Check walls
    //--------------------------------------------------

    for (const wall of walls) {

        if (
            collidesWithWall(
                position,
                width,
                depth,
                wall,
                wallThickness,
                padding
            )
        ) {

            return {
                valid: false,
                reason: "wall"
            };
        }
    }

    //--------------------------------------------------
    // Check existing furniture
    //--------------------------------------------------

    for (const existing of furniture) {

        if (
            collidesWithFurniture(
                position,
                width,
                depth,
                existing,
                padding
            )
        ) {

            return {
                valid: false,
                reason: "furniture"
            };
        }
    }

    //--------------------------------------------------
    // No collision
    //--------------------------------------------------

    return {
        valid: true,
        reason: "none"
    };
}