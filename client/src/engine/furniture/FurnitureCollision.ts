import { Vector3 } from "three";

import type { Wall } from "../walls/WallTypes";
import type { Furniture } from "./FurnitureTypes";
import {
    calculateStaircaseGeometry,
    type ProceduralStaircaseGeometry,
    type StaircaseDimensions
} from "../../../../shared/staircaseGeometry.ts";

export type FurnitureCollisionReason =
    | "none"
    | "wall"
    | "furniture"
    | "staircase";

export interface FurnitureStaircaseObstacle extends StaircaseDimensions {
    position: { x: number; y: number; z: number };
    rotationY: number;
}

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

function collidesWithStaircase(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    stair: FurnitureStaircaseObstacle,
    padding: number
): boolean {
    let geometry: ProceduralStaircaseGeometry;
    try {
        geometry = calculateStaircaseGeometry(stair);
    } catch {
        return false;
    }

    const cosine = Math.cos(stair.rotationY);
    const sine = Math.sin(stair.rotationY);
    const worldCenter = (x: number, z: number) => new Vector3(
        stair.position.x + x * cosine + z * sine,
        0,
        stair.position.z - x * sine + z * cosine
    );
    const obstacleRotation = -stair.rotationY;
    for (const flight of geometry.flights) {
        const alongX = Math.abs(flight.direction.x) > 0.5;
        const center = worldCenter(
            flight.start.x + flight.direction.x * flight.run / 2,
            flight.start.z + flight.direction.z * flight.run / 2
        );
        if (obbOverlap(
            position,
            width,
            depth,
            rotationY,
            center,
            alongX ? flight.run : flight.width,
            alongX ? flight.width : flight.run,
            obstacleRotation,
            padding
        )) return true;
    }

    for (const landing of geometry.landings) {
        const center = worldCenter(landing.center.x, landing.center.z);
        if (obbOverlap(
            position,
            width,
            depth,
            rotationY,
            center,
            landing.size.x,
            landing.size.z,
            obstacleRotation,
            padding
        )) return true;
    }
    return false;
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
        stairs?: FurnitureStaircaseObstacle[];
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
    // Staircase collision (active-floor data only)
    //--------------------------------------------------

    for (const stair of options?.stairs ?? []) {
        if (collidesWithStaircase(
            position,
            width,
            depth,
            rotationY,
            stair,
            padding
        )) {
            return {
                valid: false,
                reason: "staircase"
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