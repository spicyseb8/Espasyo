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

    const { state, dispatch } = useEditor();


    useEffect(() => {

        const canvas = gl.domElement;


        // ==================================================
        // POINTER MOVE
        // ==================================================

        function onPointerMove(e: PointerEvent) {

            buildInteraction.updatePointer(
                e,
                canvas
            );

        }


        // ==================================================
        // POINTER DOWN
        // ==================================================

        function onPointerDown(e: PointerEvent) {

            if (e.button !== 0) return;

            if (
                state.buildTool ===
                BuildTool.Furniture
            ) {
                return;
            }

            if (
                state.buildTool ===
                BuildTool.None
            ) {
                return;
            }


            e.preventDefault();
            e.stopPropagation();

            buildInteraction.suppressPointerUp();

            buildInteraction.updatePointer(
                e,
                canvas
            );


            // --------------------------------------------------
            // Must have selected asset
            // --------------------------------------------------

            if (!state.selectedAsset) {
                return;
            }


            // --------------------------------------------------
            // Only wall-based assets
            // --------------------------------------------------

            if (
                state.selectedAsset.type !==
                    BuildTool.Door &&

                state.selectedAsset.type !==
                    BuildTool.Window &&

                state.selectedAsset.type !==
                    BuildTool.Opening
            ) {
                return;
            }


            // --------------------------------------------------
            // Get placement
            // --------------------------------------------------

            const result =
                buildInteraction.pointerDown();

            if (!result) {
                return;
            }


            if (
                result.transform.kind !==
                "wall"
            ) {
                return;
            }


            // ==================================================
            // DOOR
            // ==================================================

            if (
                state.selectedAsset.type ===
                BuildTool.Door
            ) {

                const door =
                    placeDoor(
                        state.selectedAsset,
                        result.transform,
                        result.bounds
                    );

                dispatch({
                    type: "ADD_DOOR",
                    payload: door
                });

            }


            // ==================================================
            // WINDOW
            // ==================================================

            if (
                state.selectedAsset.type ===
                BuildTool.Window
            ) {

                const window =
                    placeWindow(
                        state.selectedAsset,
                        result.transform,
                        result.bounds
                    );

                dispatch({
                    type: "ADD_WINDOW",
                    payload: window
                });

            }


            // ==================================================
            // OPENING
            // ==================================================

            if (
                state.selectedAsset.type ===
                BuildTool.Opening
            ) {

                const shape: OpeningShape =
                    state.selectedAsset.openingShape ??
                    "rectangle";


                // --------------------------------------------------
                // Use the dimensions from the Opening settings
                // --------------------------------------------------

                const openingBounds: AssetBounds = {

                    width:
                        state.openingWidth,

                    height:
                        state.openingHeight,

                    depth:
                        state.wallThickness + 0.02

                };


                // --------------------------------------------------
                // Save opening
                // --------------------------------------------------

                const opening = placeOpening(
                  result.transform,
                  openingBounds,
                  shape,
                  state.archRise
              );


                dispatch({
                    type: "ADD_OPENING",
                    payload: opening
                });

            }


            // ==================================================
            // EXIT BUILD MODE
            // ==================================================

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


        // ==================================================
        // POINTER UP
        // ==================================================

        function onPointerUp(e: PointerEvent) {

            if (
                !buildInteraction
                    .consumePointerUpSuppression()
            ) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

        }


        // ==================================================
        // EVENTS
        // ==================================================

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


        // ==================================================
        // CLEANUP
        // ==================================================

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