import {
    useThree
} from "@react-three/fiber";

import {
    useEffect
} from "react";

import useEditor
    from "../../context/editor/useEditor";

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

    const {
        gl
    } = useThree();

    const {
        state,
        dispatch
    } = useEditor();


    useEffect(() => {

        const canvas =
            gl.domElement;


        //==================================================
        // POINTER MOVE
        //==================================================

        function onPointerMove(
            e: PointerEvent
        ) {

            //--------------------------------------------------
            // Existing furniture move
            //
            // IMPORTANT:
            // Moving furniture does NOT require
            // BuildTool.Furniture.
            //--------------------------------------------------

            if (
                state.movingFurnitureId
            ) {

                furnitureInteraction
                    .updatePointer(
                        e,
                        canvas
                    );

                return;
            }

            //--------------------------------------------------
            // New furniture placement
            //--------------------------------------------------

            if (
                state.buildTool !==
                BuildTool.Furniture
            ) {

                return;
            }

            furnitureInteraction
                .updatePointer(
                    e,
                    canvas
                );
        }


        //==================================================
        // KEYBOARD
        //==================================================

        function onKeyDown(
            e: KeyboardEvent
        ) {

            //--------------------------------------------------
            // Rotate is allowed while:
            //
            // 1. New furniture is being placed
            // 2. Existing furniture is being moved
            //--------------------------------------------------

            const furnitureMode =
                state.buildTool ===
                BuildTool.Furniture;

            const movingFurniture =
                state.movingFurnitureId !==
                null;

            if (
                !furnitureMode &&
                !movingFurniture
            ) {

                return;
            }

            //--------------------------------------------------
            // Ignore typing fields
            //--------------------------------------------------

            const target =
                e.target as HTMLElement | null;

            if (
                target
            ) {

                const tag =
                    target.tagName
                        ?.toLowerCase();

                if (
                    tag === "input" ||
                    tag === "textarea" ||
                    tag === "select" ||
                    target.isContentEditable
                ) {

                    return;
                }
            }

            //--------------------------------------------------
            // Rotate
            //--------------------------------------------------

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


        //==================================================
        // POINTER DOWN
        //==================================================

        function onPointerDown(
            e: PointerEvent
        ) {

            //--------------------------------------------------
            // Left click only
            //--------------------------------------------------

            if (
                e.button !== 0
            ) {

                return;
            }


            //==================================================
            // MOVE EXISTING FURNITURE
            //==================================================

            if (
                state.movingFurnitureId
            ) {

                //--------------------------------------------------
                // Furniture owns this click
                //--------------------------------------------------

                e.preventDefault();
                e.stopPropagation();

                furnitureInteraction
                    .suppressPointerUp();

                //--------------------------------------------------
                // Update pointer
                //--------------------------------------------------

                furnitureInteraction
                    .updatePointer(
                        e,
                        canvas
                    );

                //--------------------------------------------------
                // Current preview
                //--------------------------------------------------

                const result =
                    furnitureInteraction
                        .pointerDown();

                if (
                    !result
                ) {

                    return;
                }

                //--------------------------------------------------
                // Invalid position
                //--------------------------------------------------

                if (
                    !result.collision ||
                    !result.collision.valid
                ) {

                    console.log(
                        "Furniture move blocked:",
                        result.collision?.reason
                    );

                    return;
                }

                //--------------------------------------------------
                // Update existing furniture
                //--------------------------------------------------

                dispatch({

                    type:
                        "UPDATE_FURNITURE",

                    payload: {

                        id:
                            state.movingFurnitureId,

                        changes: {

                            position:
                                result.transform
                                    .position
                                    .clone(),

                            rotationY:
                                result.transform
                                    .rotationY,

                            modelOffset:
                                result.transform
                                    .modelOffset
                                    .clone()

                        }

                    }

                });

                //--------------------------------------------------
                // Finish move
                //--------------------------------------------------

                furnitureInteraction
                    .finishEditing();

                furnitureInteraction
                    .resetRotation();

                dispatch({

                    type:
                        "SET_MOVING_FURNITURE",

                    payload:
                        null

                });

                //--------------------------------------------------
                // selectedAsset should remain null
                // during existing furniture movement.
                //--------------------------------------------------

                return;
            }


            //==================================================
            // NEW FURNITURE
            //==================================================

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
            // Update pointer
            //--------------------------------------------------

            furnitureInteraction
                .updatePointer(
                    e,
                    canvas
                );

            //--------------------------------------------------
            // Selected asset required
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

            if (
                !result
            ) {

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
            // Keep selectedAsset + BuildTool.Furniture
            //
            // This preserves continuous placement.
            //--------------------------------------------------
        }


        //==================================================
        // RIGHT CLICK
        //==================================================

        function onContextMenu(
            e: MouseEvent
        ) {

            //==================================================
            // CANCEL EXISTING FURNITURE MOVE
            //==================================================

            if (
                state.movingFurnitureId
            ) {

                e.preventDefault();
                e.stopPropagation();

                //--------------------------------------------------
                // Cancel editing
                //
                // FurnitureScene will show the original object
                // again because movingFurnitureId becomes null.
                //--------------------------------------------------

                furnitureInteraction
                    .cancelEditing();

                furnitureInteraction
                    .resetRotation();

                dispatch({

                    type:
                        "SET_MOVING_FURNITURE",

                    payload:
                        null

                });

                //--------------------------------------------------
                // selectedFurnitureId stays selected.
                //
                // selectedAsset is not touched because Move mode
                // does not use selectedAsset anymore.
                //--------------------------------------------------

                return;
            }


            //==================================================
            // CANCEL NEW FURNITURE PREVIEW
            //==================================================

            if (
                state.buildTool !==
                BuildTool.Furniture
            ) {

                return;
            }

            e.preventDefault();
            e.stopPropagation();

            furnitureInteraction
                .clearPreview();

            furnitureInteraction
                .resetRotation();

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


        //==================================================
        // POINTER UP
        //==================================================

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


        //==================================================
        // REGISTER
        //==================================================

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

        window.addEventListener(
            "pointerup",
            onPointerUp,
            true
        );


        //==================================================
        // CLEANUP
        //==================================================

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

        state.buildTool,

        state.selectedAsset,

        state.movingFurnitureId,

        dispatch

    ]);


    return null;
}