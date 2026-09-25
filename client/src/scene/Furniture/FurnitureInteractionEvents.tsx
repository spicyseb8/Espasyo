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
            // Rotate shortcut is available while:
            //
            // 1. placing new furniture
            // 2. moving existing furniture
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
            // Ignore text fields.
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
            // R = quick 90° rotation
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
            // EXISTING FURNITURE MOVE
            //==================================================

            if (
                state.movingFurnitureId
            ) {

                e.preventDefault();
                e.stopPropagation();


                furnitureInteraction
                    .suppressPointerUp();


                //--------------------------------------------------
                // Update pointer at exact click location.
                //--------------------------------------------------

                furnitureInteraction
                    .updatePointer(
                        e,
                        canvas
                    );


                //--------------------------------------------------
                // Get current preview.
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
                // Invalid move.
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
                // Update furniture.
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
                // Finish move.
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
                // selectedAsset stays null during move.
                //--------------------------------------------------

                return;

            }


            //==================================================
            // NEW FURNITURE / DUPLICATE PREVIEW
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
                .suppressPointerUp();


            //--------------------------------------------------
            // Update pointer at exact click location.
            //--------------------------------------------------

            furnitureInteraction
                .updatePointer(
                    e,
                    canvas
                );


            //--------------------------------------------------
            // An Asset is required.
            //
            // For a duplicate, SelectionToolbar has already
            // placed the original asset into selectedAsset.
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
            // Get the current preview.
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
            // Collision.
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


            //==================================================
            // CREATE FURNITURE
            //==================================================

            const furniture =
                placeFurniture(

                    state.selectedAsset,

                    result.transform,

                    result.bounds

                );


            //==================================================
            // ADD TO SCENE
            //==================================================

            dispatch({

                type:
                    "ADD_FURNITURE",

                payload:
                    furniture

            });


            //--------------------------------------------------
            // IMPORTANT:
            //
            // We do NOT explicitly clear selectedAsset or
            // buildTool here.
            //
            // Your FurniturePreview already watches
            // state.furniture.length and clears the placement
            // session after a successful ADD_FURNITURE.
            //
            // Therefore:
            //
            // Duplicate
            //    ↓
            // Preview
            //    ↓
            // User clicks
            //    ↓
            // ADD_FURNITURE
            //    ↓
            // Preview disappears
            //--------------------------------------------------

        }


        //==================================================
        // RIGHT CLICK / CANCEL
        //==================================================

        function onContextMenu(
            e: MouseEvent
        ) {

            //==================================================
            // CANCEL EXISTING MOVE
            //==================================================

            if (
                state.movingFurnitureId
            ) {

                e.preventDefault();
                e.stopPropagation();


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


                return;

            }


            //==================================================
            // CANCEL NEW / DUPLICATE PREVIEW
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