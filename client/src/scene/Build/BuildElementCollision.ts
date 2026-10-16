import { Vector3 } from "three";

import { BuildTool } from "../../context/BuildTool";

import type { Asset } from "../../assets/Asset";
import type { Door } from "../../engine/doors/DoorTypes";
import type { Window } from "../../engine/windows/WindowTypes";
import type { Opening } from "../../engine/openings/OpeningTypes";
import type { PlacementTransform } from "./BuildPlacement";
import type { AssetBounds } from "./AssetBounds";

//==================================================
// Types
//==================================================

export type BuildElementCollisionReason =
    | "none"
    | "door"
    | "window"
    | "opening";

export interface BuildElementCollisionResult {
    valid: boolean;
    reason: BuildElementCollisionReason;
}

interface Interval {
    start: number;
    end: number;
}

//==================================================
// Collision tolerance (touching is allowed)
//==================================================

const COLLISION_TOLERANCE = 0.001;

function intervalsOverlap(a: Interval, b: Interval): boolean {
    return (
        a.start < b.end - COLLISION_TOLERANCE &&
        b.start < a.end - COLLISION_TOLERANCE
    );
}

//==================================================
// Wall direction
//
// FIX: zero Y *before* normalizing.
//==================================================

function getWallDirection(wall: PlacementTransform["wall"]): Vector3 {

    const direction = new Vector3().subVectors(
        wall.end.position,
        wall.start.position
    );

    direction.y = 0;

    if (direction.lengthSq() <= 0.000001) {
        return new Vector3(1, 0, 0);
    }

    return direction.normalize();
}

//==================================================
// Local axes for a Three.js Y rotation
//
// FIX: signs were flipped.
// Three.js rotation.y = θ:
//   local X -> ( cos θ, 0, -sin θ)
//   local Z -> ( sin θ, 0,  cos θ)
//==================================================

function getLocalXAxis(rotationY: number): Vector3 {
    return new Vector3(
        Math.cos(rotationY),
        0,
        -Math.sin(rotationY)
    ).normalize();
}

function getLocalZAxis(rotationY: number): Vector3 {
    return new Vector3(
        Math.sin(rotationY),
        0,
        Math.cos(rotationY)
    ).normalize();
}

//==================================================
// Width of a rotated rectangle along the wall
//==================================================

function getProjectedWidthAlongWall(
    width: number,
    depth: number,
    rotationY: number,
    wallDirection: Vector3
): number {

    const xProjection = Math.abs(
        getLocalXAxis(rotationY).dot(wallDirection)
    );

    const zProjection = Math.abs(
        getLocalZAxis(rotationY).dot(wallDirection)
    );

    return Math.max(
        width * xProjection + depth * zProjection,
        0.001
    );
}

//==================================================
// Distance of a point along the wall
//==================================================

function getDistanceAlongWall(
    position: Vector3,
    wall: PlacementTransform["wall"]
): number {

    return position
        .clone()
        .sub(wall.start.position)
        .dot(getWallDirection(wall));
}

function createHorizontalInterval(
    centerDistance: number,
    width: number
): Interval {

    const half = width * 0.5;

    return {
        start: centerDistance - half,
        end: centerDistance + half
    };
}

//==================================================
// CURRENT PREVIEW WIDTH ALONG WALL
//
// EXPORTED: placeDoor / placeWindow call this so the
// placed item stores the exact same width the preview
// used. Preview and placed items can no longer disagree.
//==================================================

export function getCurrentPreviewWidth(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds
): number {

    if (asset.type === BuildTool.Opening) {
        return Math.max(bounds.width, 0.001);
    }

    const finalRotationY =
        transform.rotationY +
        (asset.rotationOffsetY ?? 0);

    return getProjectedWidthAlongWall(
        bounds.width,
        bounds.depth,
        finalRotationY,
        getWallDirection(transform.wall)
    );
}

//==================================================
// CURRENT PREVIEW INTERVALS
//==================================================

function getCurrentHorizontalInterval(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds
): Interval {

    return createHorizontalInterval(
        getDistanceAlongWall(transform.position, transform.wall),
        getCurrentPreviewWidth(asset, transform, bounds)
    );
}

function getCurrentVerticalInterval(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds,
    wallHeight: number
): Interval {

    if (
        asset.type === BuildTool.Door ||
        asset.type === BuildTool.Opening
    ) {
        return {
            start: 0,
            end: Math.min(wallHeight, bounds.height)
        };
    }

    // Window: centered on position.y
    const half = bounds.height * 0.5;

    return {
        start: Math.max(0, transform.position.y - half),
        end: Math.min(wallHeight, transform.position.y + half)
    };
}

//==================================================
// EXISTING ITEM WIDTHS
//
// FIX: use the stored wallWidth (already along the
// wall). Fallback to width for legacy saved items.
// No second projection.
//==================================================

function getExistingDoorWidth(door: Door): number {
    return Math.max(door.wallWidth ?? door.width, 0.001);
}

function getExistingWindowWidth(window: Window): number {
    return Math.max(window.wallWidth ?? window.width, 0.001);
}

function getExistingOpeningWidth(opening: Opening): number {
    return Math.max(opening.width, 0.001);
}

//==================================================
// EXISTING ITEM VERTICAL INTERVALS
//==================================================

function getExistingDoorVerticalInterval(
    door: Door,
    wallHeight: number
): Interval {
    return { start: 0, end: Math.min(wallHeight, door.height) };
}

function getExistingWindowVerticalInterval(
    window: Window,
    wallHeight: number
): Interval {

    const half = window.height * 0.5;

    return {
        start: Math.max(0, window.position.y - half),
        end: Math.min(wallHeight, window.position.y + half)
    };
}

function getExistingOpeningVerticalInterval(
    opening: Opening,
    wallHeight: number
): Interval {
    return { start: 0, end: Math.min(wallHeight, opening.height) };
}

//==================================================
// MAIN COLLISION
//==================================================

export function checkBuildElementCollision(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds,
    doors: Door[],
    windows: Window[],
    openings: Opening[],
    wallHeight: number
): BuildElementCollisionResult {

    const currentHorizontal =
        getCurrentHorizontalInterval(asset, transform, bounds);

    const currentVertical =
        getCurrentVerticalInterval(asset, transform, bounds, wallHeight);

    //--------------------------------------------------
    // Keep preview inside wall
    //--------------------------------------------------

    if (
        currentHorizontal.start < -COLLISION_TOLERANCE ||
        currentHorizontal.end >
            transform.wallLength + COLLISION_TOLERANCE
    ) {
        return { valid: false, reason: "none" };
    }

    //--------------------------------------------------
    // Doors
    //--------------------------------------------------

    for (const door of doors) {

        if (door.wallId !== transform.wall.id) continue;

        const horizontal = createHorizontalInterval(
            getDistanceAlongWall(door.position, transform.wall),
            getExistingDoorWidth(door)
        );

        const vertical =
            getExistingDoorVerticalInterval(door, wallHeight);

        if (
            intervalsOverlap(currentHorizontal, horizontal) &&
            intervalsOverlap(currentVertical, vertical)
        ) {
            return { valid: false, reason: "door" };
        }
    }

    //--------------------------------------------------
    // Windows
    //--------------------------------------------------

    for (const window of windows) {

        if (window.wallId !== transform.wall.id) continue;

        const horizontal = createHorizontalInterval(
            getDistanceAlongWall(window.position, transform.wall),
            getExistingWindowWidth(window)
        );

        const vertical =
            getExistingWindowVerticalInterval(window, wallHeight);

        if (
            intervalsOverlap(currentHorizontal, horizontal) &&
            intervalsOverlap(currentVertical, vertical)
        ) {
            return { valid: false, reason: "window" };
        }
    }

    //--------------------------------------------------
    // Openings
    //--------------------------------------------------

    for (const opening of openings) {

        if (opening.wallId !== transform.wall.id) continue;

        const horizontal = createHorizontalInterval(
            getDistanceAlongWall(opening.position, transform.wall),
            getExistingOpeningWidth(opening)
        );

        const vertical =
            getExistingOpeningVerticalInterval(opening, wallHeight);

        if (
            intervalsOverlap(currentHorizontal, horizontal) &&
            intervalsOverlap(currentVertical, vertical)
        ) {
            return { valid: false, reason: "opening" };
        }
    }

    return { valid: true, reason: "none" };
}