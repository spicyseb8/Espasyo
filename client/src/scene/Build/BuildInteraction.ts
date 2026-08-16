import { Raycaster, Vector2 } from "three";

import type { PlacementTransform } from "./BuildPlacement";
import type { FurniturePlacement } from "./BuildFurniturePlacement";
import type { AssetBounds } from "./AssetBounds";
import type { FurnitureCollisionResult } from "../../engine/furniture/FurnitureCollision";

class BuildInteraction {

    //--------------------------------------------------
    // Shared raycaster
    //--------------------------------------------------

    readonly raycaster = new Raycaster();

    //--------------------------------------------------
    // Normalized pointer
    //--------------------------------------------------

    readonly pointer = new Vector2();

    //--------------------------------------------------
    // Current preview placement
    //--------------------------------------------------

    currentPlacement:
        | PlacementTransform
        | FurniturePlacement
        | null = null;

    currentBounds: AssetBounds | null = null;

    //--------------------------------------------------
    // Current furniture collision state
    //--------------------------------------------------

    currentFurnitureCollision:
        | FurnitureCollisionResult
        | null = null;

    //--------------------------------------------------
    // Pointer
    //--------------------------------------------------

    updatePointer(
        event: PointerEvent,
        canvas: HTMLCanvasElement
    ) {

        const rect =
            canvas.getBoundingClientRect();

        this.pointer.x =
            ((event.clientX - rect.left) / rect.width) * 2 - 1;

        this.pointer.y =
            -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    //--------------------------------------------------
    // Click
    //--------------------------------------------------

    pointerDown() {

        if (!this.currentPlacement)
            return null;

        if (!this.currentBounds)
            return null;

        return {
            transform: this.currentPlacement,
            bounds: this.currentBounds,
            collision: this.currentFurnitureCollision
        };
    }

}

export const buildInteraction =
    new BuildInteraction();