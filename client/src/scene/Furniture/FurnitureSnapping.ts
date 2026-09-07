import { Vector3 } from "three";

import type { Wall } from "../../engine/walls/WallTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";

import type { AssetBounds } from "../Build/AssetBounds";
import type { FurniturePlacement } from "./FurniturePlacement";

export const FURNITURE_SNAP_DISTANCE = 0.20;

export const FURNITURE_WALL_SNAP_GAP = 0.03;

export const FURNITURE_FURNITURE_SNAP_GAP = 0.01;

//--------------------------------------------------
// Axis
//--------------------------------------------------

interface Axis2D {
    x: number;
    z: number;
}

//--------------------------------------------------
// Snap candidate
//--------------------------------------------------

interface SnapCandidate {

    position: Vector3;

    distance: number;
}

//--------------------------------------------------
// Get local X axis
//--------------------------------------------------

function getXAxis(
    rotationY: number
): Axis2D {

    return {
        x:
            Math.cos(rotationY),

        z:
            Math.sin(rotationY)
    };
}

//--------------------------------------------------
// Get local Z axis
//--------------------------------------------------

function getZAxis(
    rotationY: number
): Axis2D {

    return {
        x:
            -Math.sin(rotationY),

        z:
            Math.cos(rotationY)
    };
}

//--------------------------------------------------
// Dot product
//--------------------------------------------------

function dot(
    a: Axis2D,
    b: Axis2D
): number {

    return (
        a.x * b.x +
        a.z * b.z
    );
}

//--------------------------------------------------
// Add offset
//--------------------------------------------------

function offset(
    point: Vector3,
    axis: Axis2D,
    amount: number
): Vector3 {

    return new Vector3(
        point.x +
            axis.x * amount,

        0,

        point.z +
            axis.z * amount
    );
}

//--------------------------------------------------
// Distance X/Z
//--------------------------------------------------

function distanceXZ(
    a: Vector3,
    b: Vector3
): number {

    const dx =
        a.x - b.x;

    const dz =
        a.z - b.z;

    return Math.sqrt(
        dx * dx +
        dz * dz
    );
}

//--------------------------------------------------
// Furniture extent along an axis
//--------------------------------------------------

function getFurnitureExtent(
    width: number,
    depth: number,
    rotationY: number,
    axis: Axis2D
): number {

    const localX =
        getXAxis(
            rotationY
        );

    const localZ =
        getZAxis(
            rotationY
        );

    return (
        width * 0.5 *
            Math.abs(
                dot(
                    localX,
                    axis
                )
            ) +

        depth * 0.5 *
            Math.abs(
                dot(
                    localZ,
                    axis
                )
            )
    );
}

//==================================================
// WALL CONNECTION HELPERS
//==================================================

//--------------------------------------------------
// Check whether two walls share a corner
//--------------------------------------------------

function wallsShareCorner(
    a: Wall,
    b: Wall
): boolean {

    return (
        a.start.id === b.start.id ||
        a.start.id === b.end.id ||
        a.end.id === b.start.id ||
        a.end.id === b.end.id
    );
}

//--------------------------------------------------
// Get connected wall component
//
// This is important when there are multiple rooms.
// We only calculate the inside side using walls
// connected to the current wall.
//--------------------------------------------------

function getConnectedWalls(
    source: Wall,
    walls: Wall[]
): Wall[] {

    const result: Wall[] = [];

    const visited =
        new Set<string>();

    const queue: Wall[] = [
        source
    ];

    while (
        queue.length > 0
    ) {

        const current =
            queue.shift();

        if (!current) {
            continue;
        }

        if (
            visited.has(
                current.id
            )
        ) {
            continue;
        }

        visited.add(
            current.id
        );

        result.push(
            current
        );

        for (
            const candidate of walls
        ) {

            if (
                visited.has(
                    candidate.id
                )
            ) {
                continue;
            }

            if (
                wallsShareCorner(
                    current,
                    candidate
                )
            ) {

                queue.push(
                    candidate
                );
            }
        }
    }

    return result;
}

//--------------------------------------------------
// Get center of connected room
//
// For normal closed rectangular / polygon rooms,
// the average of all unique corners gives a reliable
// inside reference point.
//
// This is done per connected component so another
// separated room cannot affect the result.
//--------------------------------------------------

function getRoomReferencePoint(
    sourceWall: Wall,
    walls: Wall[]
): Vector3 | null {

    const connectedWalls =
        getConnectedWalls(
            sourceWall,
            walls
        );

    if (
        connectedWalls.length === 0
    ) {
        return null;
    }

    const uniqueCorners =
        new Map<
            string,
            Vector3
        >();

    for (
        const wall of connectedWalls
    ) {

        uniqueCorners.set(
            wall.start.id,
            wall.start.position
        );

        uniqueCorners.set(
            wall.end.id,
            wall.end.position
        );
    }

    if (
        uniqueCorners.size === 0
    ) {
        return null;
    }

    const center =
        new Vector3();

    for (
        const position of
        uniqueCorners.values()
    ) {

        center.x +=
            position.x;

        center.z +=
            position.z;
    }

    center.x /=
        uniqueCorners.size;

    center.z /=
        uniqueCorners.size;

    center.y =
        0;

    return center;
}

//==================================================
// WALL SNAP
//==================================================

function getWallSnapCandidate(
    floorPoint: Vector3,
    bounds: AssetBounds,
    rotationY: number,
    wall: Wall,
    walls: Wall[],
    wallThickness: number
): SnapCandidate | null {

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

    if (
        wallLength <= 0.001
    ) {
        return null;
    }

    //--------------------------------------------------
    // Wall tangent
    //--------------------------------------------------

    const tangent: Axis2D = {
        x:
            dx / wallLength,

        z:
            dz / wallLength
    };

    //--------------------------------------------------
    // Wall normal
    //
    // This is the LEFT normal of the wall direction.
    //--------------------------------------------------

    const leftNormal: Axis2D = {
        x:
            -tangent.z,

        z:
            tangent.x
    };

    //--------------------------------------------------
    // Find the connected room reference point
    //--------------------------------------------------

    const roomCenter =
        getRoomReferencePoint(
            wall,
            walls
        );

    //--------------------------------------------------
    // Decide which side is INSIDE
    //
    // We do NOT use the mouse side.
    //
    // This prevents the furniture from snapping
    // through the wall when the mouse crosses it.
    //--------------------------------------------------

    let interiorNormal =
        leftNormal;

    if (
        roomCenter
    ) {

        const wallToCenterX =
            roomCenter.x -
            (
                start.x +
                end.x
            ) * 0.5;

        const wallToCenterZ =
            roomCenter.z -
            (
                start.z +
                end.z
            ) * 0.5;

        const sideValue =
            wallToCenterX *
                leftNormal.x +

            wallToCenterZ *
                leftNormal.z;

        //--------------------------------------------------
        // If the room center is on the opposite side,
        // use the opposite normal.
        //--------------------------------------------------

        if (
            sideValue < 0
        ) {

            interiorNormal = {
                x:
                    -leftNormal.x,

                z:
                    -leftNormal.z
            };
        }
    }

    //--------------------------------------------------
    // Closest point on wall
    //--------------------------------------------------

    const closest =
        getClosestPointOnWall(
            floorPoint,
            start,
            end
        );

    //--------------------------------------------------
    // Furniture extents
    //
    // Rotation is READ ONLY.
    // Nothing below changes rotationY.
    //--------------------------------------------------

    const normalExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            interiorNormal
        );

    const tangentExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            tangent
        );

    //--------------------------------------------------
    // Position along wall
    //--------------------------------------------------

    const relativeX =
        closest.x -
        start.x;

    const relativeZ =
        closest.z -
        start.z;

    let alongWall =
        relativeX *
            tangent.x +

        relativeZ *
            tangent.z;

    //--------------------------------------------------
    // Prevent the furniture from extending
    // past either end of the wall.
    //--------------------------------------------------

    if (
        wallLength <
        tangentExtent * 2
    ) {

        return null;
    }

    alongWall =
        Math.max(
            tangentExtent,

            Math.min(
                wallLength -
                    tangentExtent,

                alongWall
            )
        );

    //--------------------------------------------------
    // Point on the wall center line
    //--------------------------------------------------

    const wallPoint =
        offset(
            start,
            tangent,
            alongWall
        );

    //--------------------------------------------------
    // Push furniture INTO the room
    //
    // wallThickness / 2
    //     moves from wall center to wall face
    //
    // normalExtent
    //     moves furniture center outside its own half
    //     footprint
    //
    // gap
    //     keeps a tiny separation from the wall
    //--------------------------------------------------

    const targetPosition =
        offset(
            wallPoint,
            interiorNormal,

            wallThickness * 0.5 +
            normalExtent +
            FURNITURE_WALL_SNAP_GAP
        );

    //--------------------------------------------------
    // Check how close the mouse is to the snap target
    //--------------------------------------------------

    const distance =
        distanceXZ(
            floorPoint,
            targetPosition
        );

    if (
        distance >
        FURNITURE_SNAP_DISTANCE
    ) {

        return null;
    }

    return {

        position:
            targetPosition,

        distance
    };
}

//==================================================
// FURNITURE SNAP
//==================================================

function getFurnitureSnapCandidate(
    floorPoint: Vector3,
    bounds: AssetBounds,
    rotationY: number,
    existing: Furniture
): SnapCandidate | null {

    //--------------------------------------------------
    // Direction from existing furniture to cursor
    //--------------------------------------------------

    let dx =
        floorPoint.x -
        existing.position.x;

    let dz =
        floorPoint.z -
        existing.position.z;

    let length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    //--------------------------------------------------
    // If cursor is almost exactly at center,
    // use preview's current X axis.
    //--------------------------------------------------

    if (
        length < 0.0001
    ) {

        const axis =
            getXAxis(
                rotationY
            );

        dx =
            axis.x;

        dz =
            axis.z;

        length =
            1;
    }

    dx /=
        length;

    dz /=
        length;

    const direction: Axis2D = {
        x:
            dx,

        z:
            dz
    };

    //--------------------------------------------------
    // Existing furniture extent toward cursor
    //--------------------------------------------------

    const existingExtent =
        getFurnitureExtent(
            existing.width,
            existing.depth,
            existing.rotationY,
            direction
        );

    //--------------------------------------------------
    // Preview furniture extent toward existing
    //--------------------------------------------------

    const oppositeDirection: Axis2D = {
        x:
            -direction.x,

        z:
            -direction.z
    };

    const previewExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            oppositeDirection
        );

    //--------------------------------------------------
    // Separation
    //--------------------------------------------------

    const separation =
        existingExtent +
        previewExtent +
        FURNITURE_FURNITURE_SNAP_GAP;

    //--------------------------------------------------
    // Target position
    //--------------------------------------------------

    const targetPosition =
        new Vector3(

            existing.position.x +
                direction.x *
                separation,

            0,

            existing.position.z +
                direction.z *
                separation
        );

    //--------------------------------------------------
    // Distance from cursor
    //--------------------------------------------------

    const distance =
        distanceXZ(
            floorPoint,
            targetPosition
        );

    if (
        distance >
        FURNITURE_SNAP_DISTANCE
    ) {

        return null;
    }

    return {

        position:
            targetPosition,

        distance
    };
}

//==================================================
// CLOSEST POINT ON WALL
//==================================================

function getClosestPointOnWall(
    point: Vector3,
    start: Vector3,
    end: Vector3
): Vector3 {

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

        return start.clone();
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

    return new Vector3(

        start.x +
            dx * t,

        0,

        start.z +
            dz * t
    );
}

//==================================================
// MAIN SNAP
//==================================================

export function snapFurniturePlacement(
    floorPoint: Vector3,
    placement: FurniturePlacement,
    bounds: AssetBounds,
    walls: Wall[],
    furniture: Furniture[],
    wallThickness: number
): FurniturePlacement {

    const candidates:
        SnapCandidate[] = [];

    //--------------------------------------------------
    // Walls
    //--------------------------------------------------

    for (
        const wall of walls
    ) {

        const candidate =
            getWallSnapCandidate(
                floorPoint,
                bounds,

                //--------------------------------------------------
                // IMPORTANT:
                // Pass rotation only.
                // This function NEVER changes it.
                //--------------------------------------------------

                placement.rotationY,

                wall,
                walls,
                wallThickness
            );

        if (candidate) {

            candidates.push(
                candidate
            );
        }
    }

    //--------------------------------------------------
    // Existing furniture
    //--------------------------------------------------

    for (
        const existing of furniture
    ) {

        const candidate =
            getFurnitureSnapCandidate(
                floorPoint,
                bounds,
                placement.rotationY,
                existing
            );

        if (candidate) {

            candidates.push(
                candidate
            );
        }
    }

    //--------------------------------------------------
    // No snap
    //--------------------------------------------------

    if (
        candidates.length === 0
    ) {

        return placement;
    }

    //--------------------------------------------------
    // Closest snap wins
    //--------------------------------------------------

    candidates.sort(
        (a, b) =>
            a.distance -
            b.distance
    );

    const best =
        candidates[0];

    //--------------------------------------------------
    // IMPORTANT
    //
    // ONLY POSITION CHANGES.
    //
    // The existing furniture rotation is preserved.
    // No automatic rotation happens here.
    //--------------------------------------------------

    return {

        ...placement,

        position:
            best.position,

        rotationY:
            placement.rotationY
    };
}