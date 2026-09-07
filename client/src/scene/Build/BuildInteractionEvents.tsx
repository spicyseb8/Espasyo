import {
    useThree
} from "@react-three/fiber";

import {
    useEffect
} from "react";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildInteraction
} from "./BuildInteraction";

import {
    placeDoor
} from "../../engine/doors/PlaceDoor";

import {
    placeWindow
} from "../../engine/windows/PlaceWindow";

import {
    placeOpening
} from "../../engine/openings/PlaceOpening";

import {
    BuildTool
} from "../../context/BuildTool";

export default function BuildInteractionEvents() {

    const {
        gl
    } = useThree();

    const {
        state,
        dispatch
    } = useEditor();

    useEffect(
        () => {

            const canvas =
                gl.domElement;

            //==================================================
            // POINTER MOVE
            //==================================================

            function onPointerMove(
                event: PointerEvent
            ) {

                buildInteraction.updatePointer(
                    event,
                    canvas
                );
            }

            //==================================================
            // POINTER DOWN
            //==================================================

            function onPointerDown(
                event: PointerEvent
            ) {

                //--------------------------------------------------
                // Left click only
                //--------------------------------------------------

                if (
                    event.button !==
                    0
                ) {
                    return;
                }

                //--------------------------------------------------
                // Only Door / Window / Opening.
                //
                // Furniture uses FurnitureInteractionEvents.
                //--------------------------------------------------

                if (
                    state.buildTool !==
                        BuildTool.Door &&

                    state.buildTool !==
                        BuildTool.Window &&

                    state.buildTool !==
                        BuildTool.Opening
                ) {
                    return;
                }

                //--------------------------------------------------
                // Canvas bounds
                //--------------------------------------------------

                const rect =
                    canvas.getBoundingClientRect();

                const insideCanvas =
                    event.clientX >=
                        rect.left &&

                    event.clientX <=
                        rect.right &&

                    event.clientY >=
                        rect.top &&

                    event.clientY <=
                        rect.bottom;

                if (
                    !insideCanvas
                ) {
                    return;
                }

                //--------------------------------------------------
                // Own this click.
                //--------------------------------------------------

                event.preventDefault();
                event.stopPropagation();

                buildInteraction
                    .suppressPointerUp();

                //--------------------------------------------------
                // IMPORTANT:
                //
                // Update the pointer at the exact click
                // position before reading the preview.
                //--------------------------------------------------

                buildInteraction.updatePointer(
                    event,
                    canvas
                );

                //--------------------------------------------------
                // Selected asset
                //--------------------------------------------------

                const activeAsset =
                    state.selectedAsset;

                if (!activeAsset) {
                    return;
                }

                //--------------------------------------------------
                // Tool and selected asset must match.
                //--------------------------------------------------

                if (
                    state.buildTool !==
                    activeAsset.type
                ) {
                    return;
                }

                //--------------------------------------------------
                // Current preview
                //--------------------------------------------------

                const result =
                    buildInteraction
                        .pointerDown();

                if (!result) {
                    return;
                }

                //--------------------------------------------------
                // Must be wall placement.
                //--------------------------------------------------

                if (
                    result.transform.kind !==
                    "wall"
                ) {
                    return;
                }

                //==================================================
                // COLLISION
                //==================================================
                //
                // Do not allow an invalid preview to be placed.
                //==================================================

                if (
                    !result.collision ||
                    !result.collision.valid
                ) {

                    console.log(
                        "Build placement blocked:",
                        result.collision?.reason
                    );

                    return;
                }

                //==================================================
                // DOOR
                //==================================================

                if (
                    activeAsset.type ===
                    BuildTool.Door
                ) {

                    const door =
                        placeDoor(
                            activeAsset,
                            result.transform,
                            result.bounds
                        );

                    dispatch({
                        type:
                            "ADD_DOOR",

                        payload:
                            door
                    });

                    //--------------------------------------------------
                    // Placement finished.
                    //
                    // User must press Apply again for another door.
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

                    buildInteraction.clear();

                    return;
                }

                //==================================================
                // WINDOW
                //==================================================

                if (
                    activeAsset.type ===
                    BuildTool.Window
                ) {

                    const window =
                        placeWindow(
                            activeAsset,
                            result.transform,
                            result.bounds
                        );

                    dispatch({
                        type:
                            "ADD_WINDOW",

                        payload:
                            window
                    });

                    //--------------------------------------------------
                    // Placement finished.
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

                    buildInteraction.clear();

                    return;
                }

                //==================================================
                // OPENING
                //==================================================

                if (
                    activeAsset.type ===
                    BuildTool.Opening
                ) {

                    const shape =
                        activeAsset.openingShape ===
                            "arch"

                            ? "arch"

                            : "rectangle";

                    const opening =
                        placeOpening(
                            result.transform,
                            result.bounds,
                            shape,
                            state.archRise
                        );

                    dispatch({
                        type:
                            "ADD_OPENING",

                        payload:
                            opening
                    });

                    //--------------------------------------------------
                    // Placement finished.
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

                    buildInteraction.clear();

                    return;
                }
            }

            //==================================================
            // POINTER UP
            //==================================================

            function onPointerUp(
                event: PointerEvent
            ) {

                if (
                    !buildInteraction
                        .consumePointerUpSuppression()
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
            }

            //==================================================
            // REGISTER
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

        },
        [
            gl,

            state.buildTool,

            state.selectedAsset,

            state.walls,

            state.doors,

            state.windows,

            state.openings,

            state.archRise,

            dispatch
        ]
    );

    return null;
}