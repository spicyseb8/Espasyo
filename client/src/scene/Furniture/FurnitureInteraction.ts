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
    // Rotation
    //--------------------------------------------------

    rotationY =
        0;

    //--------------------------------------------------
    // Pointer
    //--------------------------------------------------

    readonly pointer =
        new Vector2();

    //--------------------------------------------------
    // Preview
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
    // Existing furniture move
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

    //--------------------------------------------------
    // Rotation
    //--------------------------------------------------

    rotateClockwise() {

        this.rotationY +=
            Math.PI / 2;

        this.rotationY =
            this.rotationY %
            (Math.PI * 2);
    }

    //--------------------------------------------------
    // Reset rotation
    //--------------------------------------------------

    resetRotation() {

        this.rotationY =
            0;
    }

    //--------------------------------------------------
    // Pointer
    //--------------------------------------------------

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

    //--------------------------------------------------
    // Start editing
    //--------------------------------------------------

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
    }

    //--------------------------------------------------
    // Finish editing
    //--------------------------------------------------

    finishEditing() {

        this.editingFurnitureId =
            null;

        this.editingOriginalPlacement =
            null;
    }

    //--------------------------------------------------
    // Cancel editing
    //--------------------------------------------------

    cancelEditing() {

        this.editingFurnitureId =
            null;

        this.editingOriginalPlacement =
            null;

        this.clearPreview();
    }

    //--------------------------------------------------
    // Pointer suppression
    //--------------------------------------------------

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

    //--------------------------------------------------
    // Preview result
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

    //--------------------------------------------------
    // Clear preview
    //--------------------------------------------------

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