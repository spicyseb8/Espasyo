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
// Oriented rectangle in X/Z plane
//--------------------------------------------------

interface OBB2D {

    center: Vector3;

    halfWidth: number;
    halfDepth: number;

    rotationY: number;

    axisX: {
        x: number;
        z: number;
    };

    axisZ: {
        x: number;
        z: number;
    };
}

//--------------------------------------------------
// Create rotated furniture footprint
//--------------------------------------------------

function createOBB(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    padding: number
): OBB2D {

    return {

        center:
            position.clone(),

        halfWidth:
            width * 0.5 + padding,

        halfDepth:
            depth * 0.5 + padding,

        rotationY,

        axisX: {
            x: Math.cos(rotationY),
            z: Math.sin(rotationY)
        },

        axisZ: {
            x: -Math.sin(rotationY),
            z: Math.cos(rotationY)
        }

    };
}

//--------------------------------------------------
// Dot product in X/Z
//--------------------------------------------------

function dot(
    ax: number,
    az: number,
    bx: number,
    bz: number
): number {

    return (
        ax * bx +
        az * bz
    );
}

//--------------------------------------------------
// Projection radius of an OBB onto an axis
//--------------------------------------------------

function getProjectionRadius(
    box: OBB2D,
    axisX: number,
    axisZ: number
): number {

    const xProjection =
        Math.abs(
            dot(
                box.axisX.x,
                box.axisX.z,
                axisX,
                axisZ
            )
        );

    const zProjection =
        Math.abs(
            dot(
                box.axisZ.x,
                box.axisZ.z,
                axisX,
                axisZ
            )
        );

    return (
        box.halfWidth *
            xProjection +

        box.halfDepth *
            zProjection
    );
}

//--------------------------------------------------
// OBB vs OBB collision
//--------------------------------------------------

function obbOverlap(
    a: OBB2D,
    b: OBB2D
): boolean {

    const axes = [
        a.axisX,
        a.axisZ,
        b.axisX,
        b.axisZ
    ];

    const dx =
        b.center.x -
        a.center.x;

    const dz =
        b.center.z -
        a.center.z;

    for (const axis of axes) {

        const distance =
            Math.abs(
                dot(
                    dx,
                    dz,
                    axis.x,
                    axis.z
                )
            );

        const radiusA =
            getProjectionRadius(
                a,
                axis.x,
                axis.z
            );

        const radiusB =
            getProjectionRadius(
                b,
                axis.x,
                axis.z
            );

        if (
            distance >=
            radiusA + radiusB
        ) {
            return false;
        }
    }

    return true;
}

//--------------------------------------------------
// Furniture vs wall
//--------------------------------------------------

function collidesWithWall(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    wall: Wall,
    wallThickness: number,
    padding: number
): boolean {

    const start =
        wall.start.position;

    const end =
        wall.end.position;

    const dx =
        end.x - start.x;

    const dz =
        end.z - start.z;

    const wallLength =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (wallLength === 0)
        return false;

    //--------------------------------------------------
    // Wall center
    //--------------------------------------------------

    const wallCenter =
        new Vector3(
            (start.x + end.x) * 0.5,
            0,
            (start.z + end.z) * 0.5
        );

    //--------------------------------------------------
    // Wall rotation
    //--------------------------------------------------

    const wallRotation =
        Math.atan2(
            dz,
            dx
        );

    //--------------------------------------------------
    // Furniture footprint
    //--------------------------------------------------

    const furnitureBox =
        createOBB(
            position,
            width,
            depth,
            rotationY,
            padding
        );

    //--------------------------------------------------
    // Wall footprint
    //--------------------------------------------------

    const wallBox =
        createOBB(
            wallCenter,
            wallLength,
            wallThickness,
            wallRotation,
            padding
        );

    return obbOverlap(
        furnitureBox,
        wallBox
    );
}

//--------------------------------------------------
// Furniture vs furniture
//--------------------------------------------------

function collidesWithFurniture(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    existing: Furniture,
    padding: number
): boolean {

    const previewBox =
        createOBB(
            position,
            width,
            depth,
            rotationY,
            padding
        );

    const existingBox =
        createOBB(
            existing.position,
            existing.width,
            existing.depth,
            existing.rotationY,
            padding
        );

    return obbOverlap(
        previewBox,
        existingBox
    );
}

//--------------------------------------------------
// Main collision check
//--------------------------------------------------

export function checkFurnitureCollision(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    walls: Wall[],
    furniture: Furniture[],
    wallThickness: number,
    padding = 0.01
): FurnitureCollisionResult {

    //--------------------------------------------------
    // Walls
    //--------------------------------------------------

    for (const wall of walls) {

        if (
            collidesWithWall(
                position,
                width,
                depth,
                rotationY,
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
    // Existing furniture
    //--------------------------------------------------

    for (
        const existing of furniture
    ) {

        if (
            collidesWithFurniture(
                position,
                width,
                depth,
                rotationY,
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