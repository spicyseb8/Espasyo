import {
    Raycaster,
    Vector2
} from "three";

import type {
    PlacementTransform
} from "./BuildPlacement";

import type {
    AssetBounds
} from "./AssetBounds";

import type {
    BuildElementCollisionResult
} from "./BuildElementCollision";


//==================================================
// MOVE TARGET
//==================================================

export type BuildMoveTarget =
    | {
        type: "door";
        id: string;
    }
    | {
        type: "window";
        id: string;
    }
    | null;


//==================================================
// BUILD INTERACTION
//==================================================

class BuildInteraction {

    //--------------------------------------------------
    // Shared raycaster
    //--------------------------------------------------

    readonly raycaster =
        new Raycaster();


    //--------------------------------------------------
    // Normalized pointer
    //--------------------------------------------------

    readonly pointer =
        new Vector2();


    //--------------------------------------------------
    // Prevent preview from using camera center
    // before mouse enters canvas.
    //--------------------------------------------------

    hasPointer =
        false;


    //--------------------------------------------------
    // Current preview placement
    //--------------------------------------------------

    currentPlacement:
        | PlacementTransform
        | null =
        null;


    //--------------------------------------------------
    // Current bounds
    //--------------------------------------------------

    currentBounds:
        | AssetBounds
        | null =
        null;


    //--------------------------------------------------
    // Current collision
    //--------------------------------------------------

    currentCollision:
        | BuildElementCollisionResult
        | null =
        null;


    //--------------------------------------------------
    // Exact wall currently under the preview
    //
    // This is populated directly from the wall raycast.
    //--------------------------------------------------

    currentWallId:
        string | null =
        null;


    //--------------------------------------------------
    // Existing door/window move target
    //--------------------------------------------------

    moveTarget:
        BuildMoveTarget =
        null;


    //--------------------------------------------------
    // Pointer-up suppression
    //--------------------------------------------------

    private suppressNextPointerUp =
        false;


    //==================================================
    // UPDATE POINTER
    //==================================================

    updatePointer(
        event: PointerEvent,
        canvas: HTMLCanvasElement
    ) {

        const rect =
            canvas.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {

            return;
        }

        const x =
            event.clientX;

        const y =
            event.clientY;

        const insideCanvas =
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom;

        //--------------------------------------------------
        // Ignore pointer movement outside canvas.
        //--------------------------------------------------

        if (
            !insideCanvas
        ) {

            this.hasPointer =
                false;

            return;
        }

        //--------------------------------------------------
        // Convert to NDC.
        //--------------------------------------------------

        this.pointer.x =
            (
                (
                    x -
                    rect.left
                ) /
                rect.width
            ) *
            2 -
            1;

        this.pointer.y =
            -(
                (
                    y -
                    rect.top
                ) /
                rect.height
            ) *
            2 +
            1;

        this.hasPointer =
            true;
    }


    //==================================================
    // BEGIN DOOR MOVE
    //==================================================

    beginDoorMove(
        id: string
    ) {

        this.moveTarget = {

            type:
                "door",

            id

        };

        this.currentWallId =
            null;

        this.clear();
    }


    //==================================================
    // BEGIN WINDOW MOVE
    //==================================================

    beginWindowMove(
        id: string
    ) {

        this.moveTarget = {

            type:
                "window",

            id

        };

        this.currentWallId =
            null;

        this.clear();
    }


    //==================================================
    // END MOVE
    //==================================================

    endMove() {

        this.moveTarget =
            null;

        this.currentWallId =
            null;

        this.clear();
    }


    //==================================================
    // CANCEL MOVE
    //==================================================

    cancelMove() {

        this.moveTarget =
            null;

        this.currentWallId =
            null;

        this.clear();
    }


    //==================================================
    // IS MOVING
    //==================================================

    isMoving():
        boolean {

        return (
            this.moveTarget !==
            null
        );
    }


    //==================================================
    // CLEAR CURRENT PREVIEW
    //==================================================

    clear() {

        this.currentPlacement =
            null;

        this.currentBounds =
            null;

        this.currentCollision =
            null;

        this.currentWallId =
            null;
    }


    //==================================================
    // SUPPRESS NEXT POINTERUP
    //==================================================

    suppressPointerUp() {

        this.suppressNextPointerUp =
            true;
    }


    //==================================================
    // CONSUME POINTERUP SUPPRESSION
    //==================================================

    consumePointerUpSuppression():
        boolean {

        if (
            !this.suppressNextPointerUp
        ) {

            return false;
        }

        this.suppressNextPointerUp =
            false;

        return true;
    }


    //==================================================
    // GET CURRENT PREVIEW RESULT
    //==================================================

    pointerDown() {

        if (
            !this.currentPlacement
        ) {

            return null;
        }

        if (
            !this.currentBounds
        ) {

            return null;
        }

        return {

            transform:
                this.currentPlacement,

            bounds:
                this.currentBounds,

            collision:
                this.currentCollision,

            wallId:
                this.currentWallId

        };
    }
}


//==================================================
// SINGLE INSTANCE
//==================================================

export const buildInteraction =
    new BuildInteraction();