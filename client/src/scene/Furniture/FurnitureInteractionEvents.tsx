import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import useEditor from "../../context/editor/useEditor";

import {
    furnitureInteraction
} from "./FurnitureInteraction";

import {
    placeFurniture
} from "../../engine/furniture/PlaceFurniture";

import {
    BuildTool
} from "../../context/BuildTool";

export default function FurnitureInteractionEvents() {

    const { gl } =
        useThree();

    const {
        state,
        dispatch
    } = useEditor();

    useEffect(() => {

        const canvas =
            gl.domElement;

        //--------------------------------------------------
        // Pointer move
        //--------------------------------------------------

        function onPointerMove(
            e: PointerEvent
        ) {

            if (
                state.buildTool !==
                BuildTool.Furniture
            ) {
                return;
            }

            furnitureInteraction.updatePointer(
                e,
                canvas
            );
        }

            function onKeyDown(
        e: KeyboardEvent
    ) {

        if (
            state.buildTool !==
            BuildTool.Furniture
        ) {
            return;
        }

        if (
            e.key.toLowerCase() !==
            "r"
        ) {
            return;
        }

        e.preventDefault();

        furnitureInteraction
            .rotateClockwise();

    }

        //--------------------------------------------------
        // Pointer down
        //--------------------------------------------------

        function onPointerDown(
            e: PointerEvent
        ) {

            if (
                e.button !== 0
            ) {
                return;
            }

            //--------------------------------------------------
            // Furniture must be active
            //--------------------------------------------------

            if (
                state.buildTool !==
                BuildTool.Furniture
            ) {
                return;
            }

            //--------------------------------------------------
            // Furniture owns this click
            //--------------------------------------------------

            e.preventDefault();
            e.stopPropagation();

            furnitureInteraction
                .suppressPointerUp();

            //--------------------------------------------------
            // Update pointer first
            //--------------------------------------------------

            furnitureInteraction
                .updatePointer(
                    e,
                    canvas
                );

            //--------------------------------------------------
            // Selected furniture must exist
            //--------------------------------------------------

            if (
                !state.selectedAsset
            ) {
                return;
            }

            if (
                state.selectedAsset.type !==
                BuildTool.Furniture
            ) {
                return;
            }

            //--------------------------------------------------
            // Current preview
            //--------------------------------------------------

            const result =
                furnitureInteraction
                    .pointerDown();

            if (!result) {
                return;
            }

            //--------------------------------------------------
            // Collision check
            //--------------------------------------------------

            if (
                !result.collision ||
                !result.collision.valid
            ) {

                console.log(
                    "Furniture placement blocked:",
                    result.collision?.reason
                );

                return;
            }

            //--------------------------------------------------
            // Create furniture
            //--------------------------------------------------

            const furniture =
                placeFurniture(
                    state.selectedAsset,
                    result.transform,
                    result.bounds
                );

            //--------------------------------------------------
            // Store furniture
            //--------------------------------------------------

            dispatch({
                type:
                    "ADD_FURNITURE",

                payload:
                    furniture
            });

            //--------------------------------------------------
            // IMPORTANT:
            //
            // Do NOT clear selectedAsset.
            // Do NOT exit BuildTool.Furniture.
            //
            // This keeps continuous placement enabled.
            //--------------------------------------------------

        }

        //--------------------------------------------------
        // Right click / context menu
        //--------------------------------------------------

        function onContextMenu(
            e: MouseEvent
        ) {

            if (
                state.buildTool !==
                BuildTool.Furniture
            ) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            //--------------------------------------------------
            // Cancel furniture placement
            //--------------------------------------------------

            furnitureInteraction
                .clearPreview();

            dispatch({
                type:
                    "SET_SELECTED_ASSET",

                payload:
                    null
            });

            dispatch({
                type:
                    "SET_BUILD_TOOL",

                payload:
                    BuildTool.None
            });
        }

        //--------------------------------------------------
        // Pointer up suppression
        //--------------------------------------------------

        function onPointerUp(
            e: PointerEvent
        ) {

            if (
                !furnitureInteraction
                    .consumePointerUpSuppression()
            ) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
        }


        //--------------------------------------------------
        // Register
        //--------------------------------------------------

        window.addEventListener(
            "keydown",
            onKeyDown
        );
        canvas.addEventListener(
            "pointermove",
            onPointerMove
        );

        canvas.addEventListener(
            "pointerdown",
            onPointerDown
        );

        canvas.addEventListener(
            "contextmenu",
            onContextMenu
        );

        //--------------------------------------------------
        // Capture pointerup so WallDrawer cannot
        // interpret a furniture click.
        //--------------------------------------------------

        window.addEventListener(
            "pointerup",
            onPointerUp,
            true
        );

        //--------------------------------------------------
        // Cleanup
        //--------------------------------------------------

        return () => {
            
            window.removeEventListener(
                "keydown",
                 onKeyDown
        );
            canvas.removeEventListener(
                "pointermove",
                onPointerMove
            );

            canvas.removeEventListener(
                "pointerdown",
                onPointerDown
            );

            canvas.removeEventListener(
                "contextmenu",
                onContextMenu
            );

            window.removeEventListener(
                "pointerup",
                onPointerUp,
                true
            );
        };

    }, [

        gl,

        state.selectedAsset,

        state.buildTool,

        dispatch

    ]);

    return null;
}