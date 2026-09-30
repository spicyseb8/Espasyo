import {
    Raycaster,
    Vector2
} from "three";

import type {
    FurniturePlacement
} from "./FurniturePlacement";

import type {
    AssetBounds
} from "../Build/AssetBounds";

import type {
    FurnitureCollisionResult
} from "../../engine/furniture/FurnitureCollision";


class FurnitureInteraction {

    //--------------------------------------------------
    // Raycaster
    //--------------------------------------------------

    readonly raycaster =
        new Raycaster();


    //--------------------------------------------------
    // Rotation for NEW furniture placement
    //--------------------------------------------------

    rotationY =
        0;


    //--------------------------------------------------
    // Pointer
    //--------------------------------------------------

    readonly pointer =
        new Vector2();


    //--------------------------------------------------
    // Current preview
    //--------------------------------------------------

    currentPlacement:
        FurniturePlacement | null =
        null;

    currentBounds:
        AssetBounds | null =
        null;

    currentCollision:
        FurnitureCollisionResult | null =
        null;


    //--------------------------------------------------
    // Existing furniture movement
    //--------------------------------------------------

    editingFurnitureId:
        string | null =
        null;

    editingOriginalPlacement:
        FurniturePlacement | null =
        null;


    //--------------------------------------------------
    // Pointer-up suppression
    //--------------------------------------------------

    private suppressNextPointerUp =
        false;


    //==================================================
    // EXISTING FURNITURE ROTATION
    //==================================================

    //--------------------------------------------------
    // Furniture currently being rotated
    //--------------------------------------------------

    rotatingFurnitureId:
        string | null =
        null;


    //--------------------------------------------------
    // Original rotation before rotation begins
    //--------------------------------------------------

    rotationOriginalY =
        0;


    //--------------------------------------------------
    // Current live rotation preview
    //--------------------------------------------------

    rotationPreviewY:
        number | null =
        null;


    //--------------------------------------------------
    // Whether current live rotation is valid
    //--------------------------------------------------

    rotationPreviewValid =
        true;


    //==================================================
    // NEW FURNITURE ROTATION
    //==================================================

    //--------------------------------------------------
    // Quick keyboard rotation.
    //
    // This remains a 90° shortcut.
    // The Rotate toolbar provides free-angle rotation.
    //--------------------------------------------------

    rotateClockwise() {

        this.rotationY +=
            Math.PI / 2;

        this.rotationY =
            this.rotationY %
            (Math.PI * 2);
    }


    //--------------------------------------------------
    // Reset NEW furniture rotation
    //--------------------------------------------------

    resetRotation() {

        this.rotationY =
            0;
    }


    //==================================================
    // EXISTING FURNITURE ROTATION
    //==================================================

    startRotation(
        furnitureId: string,
        rotationY: number
    ) {

        this.rotatingFurnitureId =
            furnitureId;

        this.rotationOriginalY =
            rotationY;

        this.rotationPreviewY =
            rotationY;

        this.rotationPreviewValid =
            true;
    }


    setRotationPreview(
        furnitureId: string,
        rotationY: number,
        valid: boolean
    ) {

        if (
            this.rotatingFurnitureId !==
            furnitureId
        ) {
            return;
        }

        this.rotationPreviewY =
            rotationY;

        this.rotationPreviewValid =
            valid;
    }


    clearRotationPreview() {

        this.rotatingFurnitureId =
            null;

        this.rotationOriginalY =
            0;

        this.rotationPreviewY =
            null;

        this.rotationPreviewValid =
            true;
    }


    //==================================================
    // POINTER
    //==================================================

    updatePointer(
        event: PointerEvent,
        canvas: HTMLCanvasElement
    ) {

        const rect =
            canvas.getBoundingClientRect();

        if (
            rect.width === 0 ||
            rect.height === 0
        ) {
            return;
        }

        this.pointer.x =
            (
                (
                    event.clientX -
                    rect.left
                ) /
                rect.width
            ) * 2 - 1;

        this.pointer.y =
            -(
                (
                    event.clientY -
                    rect.top
                ) /
                rect.height
            ) * 2 + 1;
    }


    //==================================================
    // START EDITING
    //==================================================

    startEditing(
        furnitureId: string,
        rotationY: number
    ) {

        this.editingFurnitureId =
            furnitureId;

        this.rotationY =
            rotationY;

        this.editingOriginalPlacement =
            null;

        this.clearPreview();

        //--------------------------------------------------
        // Make sure an old rotation session is gone.
        //--------------------------------------------------

        this.clearRotationPreview();
    }


    //==================================================
    // FINISH EDITING
    //==================================================

    finishEditing() {

        this.editingFurnitureId =
            null;

        this.editingOriginalPlacement =
            null;

        this.clearRotationPreview();
    }


    //==================================================
    // CANCEL EDITING
    //==================================================

    cancelEditing() {

        this.editingFurnitureId =
            null;

        this.editingOriginalPlacement =
            null;

        this.clearPreview();

        this.clearRotationPreview();
    }


    //==================================================
    // POINTER SUPPRESSION
    //==================================================

    suppressPointerUp() {

        this.suppressNextPointerUp =
            true;
    }


    consumePointerUpSuppression(): boolean {

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
    // PREVIEW RESULT
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
                this.currentCollision

        };
    }


    //==================================================
    // CLEAR PREVIEW
    //==================================================

    clearPreview() {

        this.currentPlacement =
            null;

        this.currentBounds =
            null;

        this.currentCollision =
            null;
    }
}


export const furnitureInteraction =
    new FurnitureInteraction();