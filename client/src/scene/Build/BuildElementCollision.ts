import {
    Vector3
} from "three";

import {
    BuildTool
} from "../../context/BuildTool";

import type {
    Asset
} from "../../assets/Asset";

import type {
    Door
} from "../../engine/doors/DoorTypes";

import type {
    Window
} from "../../engine/windows/WindowTypes";

import type {
    Opening
} from "../../engine/openings/OpeningTypes";

import type {
    PlacementTransform
} from "./BuildPlacement";

import type {
    AssetBounds
} from "./AssetBounds";

//==================================================
// Collision reason
//==================================================

export type BuildElementCollisionReason =
    | "none"
    | "door"
    | "window"
    | "opening";

//==================================================
// Collision result
//==================================================

export interface BuildElementCollisionResult {

    valid:
        boolean;

    reason:
        BuildElementCollisionReason;
}

//==================================================
// Interval
//==================================================

interface Interval {

    start:
        number;

    end:
        number;
}

//==================================================
// Collision tolerance
//
// A tiny amount of touching is allowed.
// Actual overlap becomes invalid.
//==================================================

const COLLISION_TOLERANCE =
    0.001;

//==================================================
// Check interval overlap
//==================================================

function intervalsOverlap(
    a: Interval,
    b: Interval
): boolean {

    return (
        a.start <
            b.end -
            COLLISION_TOLERANCE &&

        b.start <
            a.end -
            COLLISION_TOLERANCE
    );
}

//==================================================
// Get wall direction
//==================================================

function getWallDirection(
    wall: PlacementTransform["wall"]
): Vector3 {

    const direction =
        new Vector3()
            .subVectors(
                wall.end.position,
                wall.start.position
            );

    if (
        direction.lengthSq() <=
        0.000001
    ) {

        return new Vector3(
            1,
            0,
            0
        );
    }

    direction.normalize();

    direction.y =
        0;

    return direction;
}

//==================================================
// Get local X axis for a Y rotation
//==================================================

function getLocalXAxis(
    rotationY: number
): Vector3 {

    return new Vector3(
        Math.cos(
            rotationY
        ),
        0,
        Math.sin(
            rotationY
        )
    ).normalize();
}

//==================================================
// Get local Z axis for a Y rotation
//==================================================

function getLocalZAxis(
    rotationY: number
): Vector3 {

    return new Vector3(
        -Math.sin(
            rotationY
        ),
        0,
        Math.cos(
            rotationY
        )
    ).normalize();
}

//==================================================
// Get actual width of an object along the wall
//
// This is the important part.
//
// A rectangular object may be rotated relative to
// the wall, so its width along the wall isn't always
// simply "width".
//
// We project BOTH local dimensions onto the wall.
//==================================================

function getProjectedWidthAlongWall(
    width: number,
    depth: number,
    rotationY: number,
    wallDirection: Vector3
): number {

    const localX =
        getLocalXAxis(
            rotationY
        );

    const localZ =
        getLocalZAxis(
            rotationY
        );

    const xProjection =
        Math.abs(
            localX.dot(
                wallDirection
            )
        );

    const zProjection =
        Math.abs(
            localZ.dot(
                wallDirection
            )
        );

    const projectedWidth =
        width *
            xProjection +

        depth *
            zProjection;

    return Math.max(
        projectedWidth,
        0.001
    );
}

//==================================================
// Get center distance along wall
//==================================================

function getDistanceAlongWall(
    position: Vector3,
    wall: PlacementTransform["wall"]
): number {

    const direction =
        getWallDirection(
            wall
        );

    const relative =
        position
            .clone()
            .sub(
                wall.start.position
            );

    return relative.dot(
        direction
    );
}

//==================================================
// Create horizontal interval
//==================================================

function createHorizontalInterval(
    centerDistance: number,
    width: number
): Interval {

    const halfWidth =
        width *
        0.5;

    return {

        start:
            centerDistance -
            halfWidth,

        end:
            centerDistance +
            halfWidth
    };
}

//==================================================
// CURRENT PREVIEW WIDTH
//==================================================
//
// This is based on the ACTUAL preview rotation.
//
// For Door / Window:
//
// finalRotation =
//     wall rotation +
//     asset rotation offset
//
// For Opening:
//
// width is already directly along the wall.
//==================================================

function getCurrentPreviewWidth(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds
): number {

    //--------------------------------------------------
    // Opening
    //--------------------------------------------------

    if (
        asset.type ===
        BuildTool.Opening
    ) {

        return Math.max(
            bounds.width,
            0.001
        );
    }

    //--------------------------------------------------
    // Final model rotation
    //--------------------------------------------------

    const rotationOffsetY =
        asset.rotationOffsetY ??
        0;

    const finalRotationY =
        transform.rotationY +
        rotationOffsetY;

    //--------------------------------------------------
    // Wall direction
    //--------------------------------------------------

    const wallDirection =
        getWallDirection(
            transform.wall
        );

    //--------------------------------------------------
    // Project actual model footprint
    //--------------------------------------------------

    return getProjectedWidthAlongWall(
        bounds.width,
        bounds.depth,
        finalRotationY,
        wallDirection
    );
}

//==================================================
// CURRENT HORIZONTAL INTERVAL
//==================================================

function getCurrentHorizontalInterval(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds
): Interval {

    const centerDistance =
        getDistanceAlongWall(
            transform.position,
            transform.wall
        );

    const width =
        getCurrentPreviewWidth(
            asset,
            transform,
            bounds
        );

    return createHorizontalInterval(
        centerDistance,
        width
    );
}

//==================================================
// CURRENT VERTICAL INTERVAL
//==================================================

function getCurrentVerticalInterval(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds,
    wallHeight: number
): Interval {

    //--------------------------------------------------
    // Door
    //--------------------------------------------------

    if (
        asset.type ===
        BuildTool.Door
    ) {

        return {

            start:
                0,

            end:
                Math.min(
                    wallHeight,
                    bounds.height
                )
        };
    }

    //--------------------------------------------------
    // Opening
    //--------------------------------------------------

    if (
        asset.type ===
        BuildTool.Opening
    ) {

        return {

            start:
                0,

            end:
                Math.min(
                    wallHeight,
                    bounds.height
                )
        };
    }

    //--------------------------------------------------
    // Window
    //
    // BuildPlacement centers windows at wallHeight / 2.
    //--------------------------------------------------

    const halfHeight =
        bounds.height *
        0.5;

    return {

        start:
            Math.max(
                0,
                transform.position.y -
                halfHeight
            ),

        end:
            Math.min(
                wallHeight,
                transform.position.y +
                halfHeight
            )
    };
}

//==================================================
// EXISTING DOOR HORIZONTAL WIDTH
//==================================================

function getExistingDoorWidth(
    door: Door,
    wall: PlacementTransform["wall"]
): number {

    //--------------------------------------------------
    // Door placement stores its width/depth as the
    // model footprint.
    //
    // Project both dimensions against the wall.
    //--------------------------------------------------

    return getProjectedWidthAlongWall(
        door.width,
        door.depth,
        door.rotationY,
        getWallDirection(
            wall
        )
    );
}

//==================================================
// EXISTING WINDOW HORIZONTAL WIDTH
//==================================================

function getExistingWindowWidth(
    window: Window,
    wall: PlacementTransform["wall"]
): number {

    //--------------------------------------------------
    // placeWindow() already stores the physical model
    // width/depth.
    //
    // Project that footprint against this wall.
    //--------------------------------------------------

    return getProjectedWidthAlongWall(
        window.width,
        window.depth,
        window.rotationY,
        getWallDirection(
            wall
        )
    );
}

//==================================================
// EXISTING OPENING WIDTH
//==================================================

function getExistingOpeningWidth(
    opening: Opening
): number {

    //--------------------------------------------------
    // Opening width is directly along the wall.
    //--------------------------------------------------

    return Math.max(
        opening.width,
        0.001
    );
}

//==================================================
// EXISTING DOOR VERTICAL INTERVAL
//==================================================

function getExistingDoorVerticalInterval(
    door: Door,
    wallHeight: number
): Interval {

    return {

        start:
            0,

        end:
            Math.min(
                wallHeight,
                door.height
            )
    };
}

//==================================================
// EXISTING WINDOW VERTICAL INTERVAL
//==================================================

function getExistingWindowVerticalInterval(
    window: Window,
    wallHeight: number
): Interval {

    const halfHeight =
        window.height *
        0.5;

    return {

        start:
            Math.max(
                0,
                window.position.y -
                halfHeight
            ),

        end:
            Math.min(
                wallHeight,
                window.position.y +
                halfHeight
            )
    };
}

//==================================================
// EXISTING OPENING VERTICAL INTERVAL
//==================================================

function getExistingOpeningVerticalInterval(
    opening: Opening,
    wallHeight: number
): Interval {

    return {

        start:
            0,

        end:
            Math.min(
                wallHeight,
                opening.height
            )
    };
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

    //==================================================
    // CURRENT PREVIEW
    //==================================================

    const currentHorizontal =
        getCurrentHorizontalInterval(
            asset,
            transform,
            bounds
        );

    const currentVertical =
        getCurrentVerticalInterval(
            asset,
            transform,
            bounds,
            wallHeight
        );

    //==================================================
    // KEEP PREVIEW INSIDE WALL
    //==================================================

    if (
        currentHorizontal.start <
        -COLLISION_TOLERANCE
    ) {

        return {

            valid:
                false,

            reason:
                "none"
        };
    }

    if (
        currentHorizontal.end >
        transform.wallLength +
        COLLISION_TOLERANCE
    ) {

        return {

            valid:
                false,

            reason:
                "none"
        };
    }

    //==================================================
    // DOORS
    //==================================================

    for (
        const door of doors
    ) {

        //--------------------------------------------------
        // Different wall = no collision.
        //--------------------------------------------------

        if (
            door.wallId !==
            transform.wall.id
        ) {
            continue;
        }

        //--------------------------------------------------
        // Door center along current wall.
        //--------------------------------------------------

        const centerDistance =
            getDistanceAlongWall(
                door.position,
                transform.wall
            );

        //--------------------------------------------------
        // Actual door footprint along wall.
        //--------------------------------------------------

        const width =
            getExistingDoorWidth(
                door,
                transform.wall
            );

        const horizontal =
            createHorizontalInterval(
                centerDistance,
                width
            );

        const vertical =
            getExistingDoorVerticalInterval(
                door,
                wallHeight
            );

        //--------------------------------------------------
        // PREVIEW FOOTPRINT vs DOOR FOOTPRINT
        //--------------------------------------------------

        if (
            intervalsOverlap(
                currentHorizontal,
                horizontal
            ) &&

            intervalsOverlap(
                currentVertical,
                vertical
            )
        ) {

            return {

                valid:
                    false,

                reason:
                    "door"
            };
        }
    }

    //==================================================
    // WINDOWS
    //==================================================

    for (
        const window of windows
    ) {

        //--------------------------------------------------
        // Different wall = no collision.
        //--------------------------------------------------

        if (
            window.wallId !==
            transform.wall.id
        ) {
            continue;
        }

        //--------------------------------------------------
        // Window center along wall.
        //--------------------------------------------------

        const centerDistance =
            getDistanceAlongWall(
                window.position,
                transform.wall
            );

        //--------------------------------------------------
        // Actual window footprint along wall.
        //--------------------------------------------------

        const width =
            getExistingWindowWidth(
                window,
                transform.wall
            );

        const horizontal =
            createHorizontalInterval(
                centerDistance,
                width
            );

        const vertical =
            getExistingWindowVerticalInterval(
                window,
                wallHeight
            );

        //--------------------------------------------------
        // PREVIEW FOOTPRINT vs WINDOW FOOTPRINT
        //--------------------------------------------------

        if (
            intervalsOverlap(
                currentHorizontal,
                horizontal
            ) &&

            intervalsOverlap(
                currentVertical,
                vertical
            )
        ) {

            return {

                valid:
                    false,

                reason:
                    "window"
            };
        }
    }

    //==================================================
    // OPENINGS
    //==================================================

    for (
        const opening of openings
    ) {

        //--------------------------------------------------
        // Different wall = no collision.
        //--------------------------------------------------

        if (
            opening.wallId !==
            transform.wall.id
        ) {
            continue;
        }

        //--------------------------------------------------
        // Opening center along wall.
        //--------------------------------------------------

        const centerDistance =
            getDistanceAlongWall(
                opening.position,
                transform.wall
            );

        //--------------------------------------------------
        // Opening footprint.
        //--------------------------------------------------

        const horizontal =
            createHorizontalInterval(
                centerDistance,
                getExistingOpeningWidth(
                    opening
                )
            );

        const vertical =
            getExistingOpeningVerticalInterval(
                opening,
                wallHeight
            );

        //--------------------------------------------------
        // PREVIEW FOOTPRINT vs OPENING FOOTPRINT
        //--------------------------------------------------

        if (
            intervalsOverlap(
                currentHorizontal,
                horizontal
            ) &&

            intervalsOverlap(
                currentVertical,
                vertical
            )
        ) {

            return {

                valid:
                    false,

                reason:
                    "opening"
            };
        }
    }

    //==================================================
    // NO COLLISION
    //==================================================

    return {

        valid:
            true,

        reason:
            "none"
    };
}