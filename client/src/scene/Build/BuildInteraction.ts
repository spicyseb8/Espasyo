import { Raycaster, Vector2 } from "three";

import type { PlacementTransform } from "./BuildPlacement";
import type { AssetBounds } from "./AssetBounds";

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

    currentPlacement: PlacementTransform | null = null;

    currentBounds: AssetBounds | null = null;

    //--------------------------------------------------
    // Pointer
    //--------------------------------------------------

    updatePointer(
        event: PointerEvent,
        canvas: HTMLCanvasElement
    ) {

        const rect = canvas.getBoundingClientRect();

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

            bounds: this.currentBounds

        };

    }

}

export const buildInteraction = new BuildInteraction();