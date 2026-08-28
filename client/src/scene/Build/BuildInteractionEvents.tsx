import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import useEditor from "../../context/editor/useEditor";

import { placeOpening } from "../../engine/openings/PlaceOpening";
import type { OpeningShape } from "../../engine/openings/OpeningTypes";

import { buildInteraction } from "./BuildInteraction";

import { placeDoor } from "../../engine/doors/PlaceDoor";
import { placeWindow } from "../../engine/windows/PlaceWindow";

import { BuildTool } from "../../context/BuildTool";

import type { AssetBounds } from "./AssetBounds";

export default function BuildInteractionEvents() {

    const { gl } = useThree();

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

            buildInteraction.updatePointer(
                e,
                canvas
            );

        }

        //==================================================
        // POINTER DOWN
        //==================================================

        function onPointerDown(
            e: PointerEvent
        ) {

            if (
                e.button !== 0
            ) {
                return;
            }

            //--------------------------------------------------
            // Only handle wall-based build objects here.
            //--------------------------------------------------

            const buildTool =
                state.buildTool;

            if (
                buildTool !== BuildTool.Door &&
                buildTool !== BuildTool.Window &&
                buildTool !== BuildTool.Opening
            ) {

                return;

            }

            //--------------------------------------------------
            // Must have an asset.
            //--------------------------------------------------

            const asset =
                state.selectedAsset;

            if (
                !asset
            ) {

                return;

            }

            //--------------------------------------------------
            // Make sure asset and active tool agree.
            //--------------------------------------------------

            if (
                asset.type !==
                buildTool
            ) {

                return;

            }

            //--------------------------------------------------
            // IMPORTANT:
            //
            // Stop other interaction systems from treating
            // this click as a wall/room drawing click.
            //--------------------------------------------------

            e.preventDefault();
            e.stopPropagation();

            buildInteraction
                .suppressPointerUp();

            //--------------------------------------------------
            // Refresh pointer position immediately.
            //--------------------------------------------------

            buildInteraction.updatePointer(
                e,
                canvas
            );

            //--------------------------------------------------
            // Get the placement that AssetPreview calculated.
            //--------------------------------------------------

            const result =
                buildInteraction.pointerDown();

            if (
                !result
            ) {

                console.warn(
                    "Build placement unavailable."
                );

                return;

            }

            //--------------------------------------------------
            // Only wall placement is valid here.
            //--------------------------------------------------

            if (
                result.transform.kind !==
                "wall"
            ) {

                return;

            }

            //==================================================
            // DOOR
            //==================================================

            if (
                asset.type ===
                BuildTool.Door
            ) {

                const door =
                    placeDoor(
                        asset,
                        result.transform,
                        result.bounds
                    );

                dispatch({

                    type:
                        "ADD_DOOR",

                    payload:
                        door

                });

            }

            //==================================================
            // WINDOW
            //==================================================

            else if (
                asset.type ===
                BuildTool.Window
            ) {

                const window =
                    placeWindow(
                        asset,
                        result.transform,
                        result.bounds
                    );

                dispatch({

                    type:
                        "ADD_WINDOW",

                    payload:
                        window

                });

            }

            //==================================================
            // OPENING
            //==================================================

            else if (
                asset.type ===
                BuildTool.Opening
            ) {

                const shape:
                    OpeningShape =
                    asset.openingShape ??
                    "rectangle";

                const openingBounds:
                    AssetBounds = {

                    width:
                        state.openingWidth,

                    height:
                        state.openingHeight,

                    depth:
                        state.wallThickness +
                        0.02

                };

                const opening =
                    placeOpening(

                        result.transform,

                        openingBounds,

                        shape,

                        state.archRise

                    );

                dispatch({

                    type:
                        "ADD_OPENING",

                    payload:
                        opening

                });

            }

            //--------------------------------------------------
            // Exit build mode
            //--------------------------------------------------

            dispatch({

                type:
                    "SET_BUILD_TOOL",

                payload:
                    BuildTool.None

            });

            dispatch({

                type:
                    "SET_SELECTED_ASSET",

                payload:
                    null

            });

        }

        //==================================================
        // POINTER UP
        //==================================================

        function onPointerUp(
            e: PointerEvent
        ) {

            if (
                !buildInteraction
                    .consumePointerUpSuppression()
            ) {

                return;

            }

            e.preventDefault();
            e.stopPropagation();

        }

        //==================================================
        // EVENTS
        //==================================================

        canvas.addEventListener(
            "pointermove",
            onPointerMove
        );

        canvas.addEventListener(
            "pointerdown",
            onPointerDown
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

            canvas.removeEventListener(
                "pointermove",
                onPointerMove
            );

            canvas.removeEventListener(
                "pointerdown",
                onPointerDown
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
        state.openingWidth,
        state.openingHeight,
        state.archRise,
        state.wallThickness,
        dispatch
    ]);

    return null;
}