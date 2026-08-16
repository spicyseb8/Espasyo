import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import useEditor from "../../context/editor/useEditor";

import { buildInteraction } from "./BuildInteraction";

import { placeDoor } from "../../engine/doors/PlaceDoor";

import { BuildTool } from "../../context/BuildTool";

import { placeFurniture } from "../../engine/furniture/PlaceFurniture";
export default function BuildInteractionEvents() {

    const { gl } = useThree();

    const { state, dispatch } = useEditor();

    useEffect(() => {

        const canvas = gl.domElement;

        function onPointerMove(
            e: PointerEvent
        ) {

            buildInteraction.updatePointer(
                e,
                canvas
            );

        }

        function onContextMenu(
            e: MouseEvent
        ) {
            if (!state.selectedAsset)
                return;

            if (
                state.selectedAsset.type !==
                BuildTool.Furniture
            ) {
                return;
            }

            e.preventDefault();

            buildInteraction.currentPlacement = null;
            buildInteraction.currentBounds = null;

            dispatch({
                type: "SET_SELECTED_ASSET",
                payload: null
            });

            dispatch({
                type: "SET_BUILD_TOOL",
                payload: BuildTool.None
            });
        }
        function onPointerDown(
            e: PointerEvent
        ) {

            if (e.button !== 0)
                return;

            buildInteraction.updatePointer(
                e,
                canvas
            );

            if (!state.selectedAsset) {
                return;
            }

            const activeAsset = state.selectedAsset;
            const hasArmedPlacement =
                state.buildTool !== BuildTool.None &&
                state.buildTool === activeAsset.type;

            if (!hasArmedPlacement)
                return;

            const result =
                buildInteraction.pointerDown();

            if (!result)
                return;

            if (
                activeAsset.type === BuildTool.Door
            ) {

                if (result.transform.kind !== "wall")
                    return;

                const door = placeDoor(
                    activeAsset,
                    result.transform,
                    result.bounds
                );

                dispatch({
                    type: "ADD_DOOR",
                    payload: door
                });

                dispatch({
                    type: "SET_BUILD_TOOL",
                    payload: BuildTool.None
                });

                dispatch({
                    type: "SET_SELECTED_ASSET",
                    payload: null
                });

                return;
            }

            if (
                activeAsset.type ===
                BuildTool.Furniture
            ) {

                //--------------------------------------------------
                // Furniture placement requires furniture transform
                //--------------------------------------------------

                if (
                    result.transform.kind !==
                    "furniture"
                ) {
                    return;
                }

                //--------------------------------------------------
                // Furniture must be collision-free
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
                // Create permanent furniture
                //--------------------------------------------------

                const furniture =
                    placeFurniture(
                        activeAsset,
                        result.transform,
                        result.bounds
                    );

                //--------------------------------------------------
                // Store furniture
                //--------------------------------------------------

                dispatch({
                    type: "ADD_FURNITURE",
                    payload: furniture
                });

                dispatch({
                    type: "SET_BUILD_TOOL",
                    payload: BuildTool.None
                });

                dispatch({
                    type: "SET_SELECTED_ASSET",
                    payload: null
                });

                return;
            }
        }

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

        return () => {

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

        };

    }, [

        gl,

        state.selectedAsset,

        dispatch

    ]);

    return null;

}