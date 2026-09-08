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

//==================================================
// Axis
//==================================================

interface Axis2D {
    x: number;
    z: number;
}

//==================================================
// Get local X axis
//==================================================

function getXAxis(
    rotationY: number
): Axis2D {
    return {
        x: Math.cos(rotationY),
        z: Math.sin(rotationY)
    };
}

//==================================================
// Get local Z axis
//==================================================

function getZAxis(
    rotationY: number
): Axis2D {
    return {
        x: -Math.sin(rotationY),
        z: Math.cos(rotationY)
    };
}

//==================================================
// Get OBB corners
//==================================================

function getCorners(
    center: Vector3,
    width: number,
    depth: number,
    rotationY: number
): Vector3[] {
    const xAxis =
        getXAxis(
            rotationY
        );

    const zAxis =
        getZAxis(
            rotationY
        );

    const halfWidth =
        width * 0.5;

    const halfDepth =
        depth * 0.5;

    return [
        new Vector3(
            center.x +
                xAxis.x * halfWidth +
                zAxis.x * halfDepth,

            center.y,

            center.z +
                xAxis.z * halfWidth +
                zAxis.z * halfDepth
        ),

        new Vector3(
            center.x +
                xAxis.x * halfWidth -
                zAxis.x * halfDepth,

            center.y,

            center.z +
                xAxis.z * halfWidth -
                zAxis.z * halfDepth
        ),

        new Vector3(
            center.x -
                xAxis.x * halfWidth +
                zAxis.x * halfDepth,

            center.y,

            center.z -
                xAxis.z * halfWidth +
                zAxis.z * halfDepth
        ),

        new Vector3(
            center.x -
                xAxis.x * halfWidth -
                zAxis.x * halfDepth,

            center.y,

            center.z -
                xAxis.z * halfWidth -
                zAxis.z * halfDepth
        )
    ];
}

//==================================================
// Project corners onto axis
//==================================================

function projectCorners(
    corners: Vector3[],
    axis: Axis2D
): {
    min: number;
    max: number;
} {
    let min =
        Number.POSITIVE_INFINITY;

    let max =
        Number.NEGATIVE_INFINITY;

    for (
        const corner of corners
    ) {
        const value =
            corner.x * axis.x +
            corner.z * axis.z;

        min =
            Math.min(
                min,
                value
            );

        max =
            Math.max(
                max,
                value
            );
    }

    return {
        min,
        max
    };
}

//==================================================
// 2D interval overlap
//==================================================

function intervalsOverlap(
    aMin: number,
    aMax: number,
    bMin: number,
    bMax: number,
    padding: number
): boolean {
    return !(
        aMax + padding < bMin ||
        bMax + padding < aMin
    );
}

//==================================================
// OBB overlap
//==================================================

function obbOverlap(
    aPosition: Vector3,
    aWidth: number,
    aDepth: number,
    aRotationY: number,

    bPosition: Vector3,
    bWidth: number,
    bDepth: number,
    bRotationY: number,

    padding: number
): boolean {
    const aCorners =
        getCorners(
            aPosition,
            aWidth,
            aDepth,
            aRotationY
        );

    const bCorners =
        getCorners(
            bPosition,
            bWidth,
            bDepth,
            bRotationY
        );

    const axes: Axis2D[] = [
        getXAxis(
            aRotationY
        ),

        getZAxis(
            aRotationY
        ),

        getXAxis(
            bRotationY
        ),

        getZAxis(
            bRotationY
        )
    ];

    for (
        const axis of axes
    ) {
        const aProjection =
            projectCorners(
                aCorners,
                axis
            );

        const bProjection =
            projectCorners(
                bCorners,
                axis
            );

        if (
            !intervalsOverlap(
                aProjection.min,
                aProjection.max,
                bProjection.min,
                bProjection.max,
                padding
            )
        ) {
            return false;
        }
    }

    return true;
}

//==================================================
// Vertical overlap
//==================================================

function verticalOverlap(
    aBottom: number,
    aHeight: number,
    bBottom: number,
    bHeight: number,
    padding: number
): boolean {
    const aTop =
        aBottom +
        aHeight;

    const bTop =
        bBottom +
        bHeight;

    return !(
        aTop + padding < bBottom ||
        bTop + padding < aBottom
    );
}

//==================================================
// Wall collision
//==================================================

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
        end.x -
        start.x;

    const dz =
        end.z -
        start.z;

    const wallLength =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (
        wallLength <= 0.001
    ) {
        return false;
    }

    const wallCenter =
        new Vector3(
            (
                start.x +
                end.x
            ) * 0.5,

            0,

            (
                start.z +
                end.z
            ) * 0.5
        );

    const wallRotation =
        Math.atan2(
            dz,
            dx
        );

    return obbOverlap(
        position,
        width,
        depth,
        rotationY,

        wallCenter,
        wallLength,
        wallThickness,
        wallRotation,

        padding
    );
}

//==================================================
// Furniture collision
//==================================================

function collidesWithFurniture(
    position: Vector3,
    width: number,
    depth: number,
    height: number,
    rotationY: number,
    furniture: Furniture,
    padding: number
): boolean {
    if (
        !verticalOverlap(
            position.y,
            height,
            furniture.position.y,
            furniture.height,
            padding
        )
    ) {
        return false;
    }

    return obbOverlap(
        position,
        width,
        depth,
        rotationY,

        furniture.position,
        furniture.width,
        furniture.depth,
        furniture.rotationY,

        padding
    );
}

//==================================================
// Main collision check
//==================================================

export function checkFurnitureCollision(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    walls: Wall[],
    furniture: Furniture[],
    wallThickness: number,
    padding = 0.01,
    options?: {
        height?: number;
        ignoreWallId?: string | null;
        ignoreFurnitureId?: string | null;
    }
): FurnitureCollisionResult {
    const height =
        options?.height ?? 0;

    //--------------------------------------------------
    // Check walls
    //--------------------------------------------------

    for (
        const wall of walls
    ) {
        if (
            options?.ignoreWallId &&
            wall.id ===
                options.ignoreWallId
        ) {
            continue;
        }

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
    // Check furniture
    //--------------------------------------------------

    for (
        const existing of furniture
    ) {
        if (
            options?.ignoreFurnitureId &&
            existing.id ===
                options.ignoreFurnitureId
        ) {
            continue;
        }

        if (
            collidesWithFurniture(
                position,
                width,
                depth,
                height,
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