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
    // before the mouse actually enters the canvas.
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
    // Pointer-up suppression
    //--------------------------------------------------

    private suppressNextPointerUp =
        false;

    //--------------------------------------------------
    // Update pointer
    //--------------------------------------------------

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
        // Ignore pointer movement outside the canvas.
        //--------------------------------------------------

        if (!insideCanvas) {

            this.hasPointer =
                false;

            return;
        }

        //--------------------------------------------------
        // Convert screen coordinates to NDC.
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

    //--------------------------------------------------
    // Clear current preview data
    //--------------------------------------------------

    clear() {

        this.currentPlacement =
            null;

        this.currentBounds =
            null;

        this.currentCollision =
            null;
    }

    //--------------------------------------------------
    // Suppress next pointerup
    //--------------------------------------------------

    suppressPointerUp() {

        this.suppressNextPointerUp =
            true;
    }

    //--------------------------------------------------
    // Consume pointerup suppression
    //--------------------------------------------------

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

    //--------------------------------------------------
    // Get current preview result
    //--------------------------------------------------

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
                this.currentCollision
        };
    }
}

export const buildInteraction =
    new BuildInteraction();