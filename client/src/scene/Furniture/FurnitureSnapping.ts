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
        x: Math.cos(rotationY),
        z: Math.sin(rotationY)
    };
}

//--------------------------------------------------
// Get local Z axis
//--------------------------------------------------

function getZAxis(
    rotationY: number
): Axis2D {

    return {
        x: -Math.sin(rotationY),
        z: Math.cos(rotationY)
    };
}

//--------------------------------------------------
// Dot
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
        getXAxis(rotationY);

    const localZ =
        getZAxis(rotationY);

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
// WALL SNAP
//==================================================

function getWallSnapCandidate(
    floorPoint: Vector3,
    bounds: AssetBounds,
    rotationY: number,
    wall: Wall,
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
        x: dx / wallLength,
        z: dz / wallLength
    };

    //--------------------------------------------------
    // Wall normal
    //--------------------------------------------------

    const normal: Axis2D = {
        x: -tangent.z,
        z: tangent.x
    };

    //--------------------------------------------------
    // Which side is the mouse on?
    //--------------------------------------------------

    const closest =
        getClosestPointOnWall(
            floorPoint,
            start,
            end
        );

    const sideX =
        floorPoint.x -
        closest.x;

    const sideZ =
        floorPoint.z -
        closest.z;

    const sideValue =
        sideX * normal.x +
        sideZ * normal.z;

    const sideSign =
        sideValue >= 0
            ? 1
            : -1;

    //--------------------------------------------------
    // Furniture extents based on ITS CURRENT rotation
    //--------------------------------------------------

    const normalExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            normal
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
        relativeX * tangent.x +
        relativeZ * tangent.z;

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
    // Center on wall line
    //--------------------------------------------------

    const wallPoint =
        offset(
            start,
            tangent,
            alongWall
        );

    //--------------------------------------------------
    // Push furniture outside wall
    //
    // Current rotation is preserved.
    //--------------------------------------------------

    const targetPosition =
        offset(
            wallPoint,
            normal,
            sideSign *
                (
                    wallThickness * 0.5 +
                    normalExtent +
                    FURNITURE_WALL_SNAP_GAP
                )
        );

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
    // use the preview's current X axis.
    //--------------------------------------------------

    if (length < 0.0001) {

        const axis =
            getXAxis(
                rotationY
            );

        dx =
            axis.x;

        dz =
            axis.z;

        length = 1;
    }

    dx /= length;
    dz /= length;

    const direction: Axis2D = {
        x: dx,
        z: dz
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
        x: -direction.x,
        z: -direction.z
    };

    const previewExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            oppositeDirection
        );

    //--------------------------------------------------
    // Place edges beside one another
    //--------------------------------------------------

    const separation =
        existingExtent +
        previewExtent +
        FURNITURE_FURNITURE_SNAP_GAP;

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
        end.x - start.x;

    const dz =
        end.z - start.z;

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
            (point.x - start.x) * dx +
            (point.z - start.z) * dz
        ) /
        lengthSquared;

    t =
        Math.max(
            0,
            Math.min(1, t)
        );

    return new Vector3(
        start.x + dx * t,
        0,
        start.z + dz * t
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
                placement.rotationY,
                wall,
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
    // Nothing to snap to
    //--------------------------------------------------

    if (
        candidates.length === 0
    ) {

        return placement;
    }

    //--------------------------------------------------
    // Closest candidate wins
    //--------------------------------------------------

    candidates.sort(
        (a, b) =>
            a.distance -
            b.distance
    );

    const best =
        candidates[0];

    //--------------------------------------------------
    // IMPORTANT:
    //
    // Position changes.
    // Rotation DOES NOT change.
    //--------------------------------------------------

    return {

        ...placement,

        position:
            best.position

    };
}