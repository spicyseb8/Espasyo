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


                //==================================================
                // EXISTING DOOR / WINDOW MOVE
                //==================================================

                if (
                    buildInteraction.isMoving()
                ) {

                    event.preventDefault();
                    event.stopPropagation();


                    buildInteraction
                        .suppressPointerUp();


                    //--------------------------------------------------
                    // Update pointer at exact click location.
                    //--------------------------------------------------

                    buildInteraction
                        .updatePointer(
                            event,
                            canvas
                        );


                    //--------------------------------------------------
                    // Current preview
                    //--------------------------------------------------

                    const result =
                        buildInteraction
                            .pointerDown();


                    if (
                        !result
                    ) {

                        return;
                    }


                    //--------------------------------------------------
                    // Invalid preview
                    //--------------------------------------------------

                    if (
                        !result.collision ||
                        !result.collision.valid
                    ) {

                        console.log(
                            "Build move blocked:",
                            result.collision?.reason
                        );

                        return;
                    }


                    //--------------------------------------------------
                    // EXACT target wall
                    //
                    // This was populated by AssetPreview from
                    // the actual raycast hit.
                    //--------------------------------------------------

                    const targetWallId =
                        result.wallId;


                    if (
                        !targetWallId
                    ) {

                        console.log(
                            "Build move blocked: no target wall"
                        );

                        return;
                    }


                    //--------------------------------------------------
                    // Move target
                    //--------------------------------------------------

                    const moveTarget =
                        buildInteraction
                            .moveTarget;


                    if (
                        !moveTarget
                    ) {

                        return;
                    }


                    //==================================================
                    // MOVE DOOR
                    //==================================================

                    if (
                        moveTarget.type ===
                        "door"
                    ) {

                        dispatch({

                            type:
                                "UPDATE_DOOR",

                            payload: {

                                id:
                                    moveTarget.id,

                                changes: {

                                    position:
                                        result.transform
                                            .position
                                            .clone(),

                                    wallId:
                                        targetWallId,

                                    rotationY:
                                        result.transform
                                            .rotationY

                                }

                            }

                        });


                        //--------------------------------------------------
                        // Finish move
                        //--------------------------------------------------

                        buildInteraction
                            .endMove();


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


                        return;
                    }


                    //==================================================
                    // MOVE WINDOW
                    //==================================================

                    if (
                        moveTarget.type ===
                        "window"
                    ) {

                        dispatch({

                            type:
                                "UPDATE_WINDOW",

                            payload: {

                                id:
                                    moveTarget.id,

                                changes: {

                                    position:
                                        result.transform
                                            .position
                                            .clone(),

                                    wallId:
                                        targetWallId,

                                    rotationY:
                                        result.transform
                                            .rotationY

                                }

                            }

                        });


                        //--------------------------------------------------
                        // Finish move
                        //--------------------------------------------------

                        buildInteraction
                            .endMove();


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


                        return;
                    }
                }


                //==================================================
                // NORMAL NEW BUILD PLACEMENT
                //==================================================

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
                // Own click
                //--------------------------------------------------

                event.preventDefault();
                event.stopPropagation();


                buildInteraction
                    .suppressPointerUp();


                //--------------------------------------------------
                // Update pointer
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


                if (
                    !activeAsset
                ) {

                    return;
                }


                //--------------------------------------------------
                // Tool and asset match
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


                if (
                    !result
                ) {

                    return;
                }


                //--------------------------------------------------
                // Must be wall placement
                //--------------------------------------------------

                if (
                    result.transform.kind !==
                    "wall"
                ) {

                    return;
                }


                //--------------------------------------------------
                // Collision
                //--------------------------------------------------

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
            // RIGHT CLICK / CANCEL
            //==================================================

            function onContextMenu(
                event: MouseEvent
            ) {

                //--------------------------------------------------
                // Existing Door / Window Move
                //--------------------------------------------------

                if (
                    buildInteraction.isMoving()
                ) {

                    event.preventDefault();
                    event.stopPropagation();


                    buildInteraction
                        .cancelMove();


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


                    return;
                }


                //--------------------------------------------------
                // Normal placement
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


                event.preventDefault();
                event.stopPropagation();


                buildInteraction.clear();


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

            state.wallThickness,

            dispatch
        ]
    );


    return null;
}