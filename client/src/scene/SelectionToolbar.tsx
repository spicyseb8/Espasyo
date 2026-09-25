import {
    useEffect,
    useRef,
    useState
} from "react";

import type {
    PointerEvent as ReactPointerEvent
} from "react";

import {
    Html
} from "@react-three/drei";

import {
    Vector3
} from "three";

import {
    BuildTool
} from "../context/BuildTool";

import useEditor
    from "../context/editor/useEditor";

import {
    findAsset
} from "../assets/AssetLibrary";

import {
    getCachedFurnitureAsset,
    getFurnitureAssets
} from "../engine/furniture/FirebaseFurnitureLibrary";

import {
    furnitureInteraction
} from "./Furniture/FurnitureInteraction";

import {
    buildInteraction
} from "./Build/BuildInteraction";

import {
    checkFurnitureCollision
} from "../engine/furniture/FurnitureCollision";


//======================================================
// ICONS
//======================================================

function RotateIcon() {

    return (

        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
        >

            <path
                d="M20 11a8 8 0 1 0-2.6 6.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <path
                d="M20 5v6h-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

        </svg>

    );

}


function MoveIcon() {

    return (

        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
        >

            <path
                d="M12 3v18M3 12h18M6 6l-3 3 3 3M18 6l3 3-3 3M6 18l-3-3 3-3M18 18l3-3-3-3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

        </svg>

    );

}


function DuplicateIcon() {

    return (

        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
        >

            <rect
                x="8"
                y="8"
                width="11"
                height="11"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.7"
            />

            <path
                d="M6 16H5.5A2.5 2.5 0 0 1 3 13.5v-8A2.5 2.5 0 0 1 5.5 3h8A2.5 2.5 0 0 1 16 5.5V6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
            />

        </svg>

    );

}


function TrashIcon() {

    return (

        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
        >

            <path
    d="M4 7h16M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7m-9 0 .9 12.1c.05.65.6 1.15 1.25 1.15h6.7c.65 0 1.2-.5 1.25-1.15L18 7"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
/>

        </svg>

    );

}


//======================================================
// TOOLBAR STYLES
//======================================================

const TOOLBAR_STYLES = `

.est-toolbar {
    animation:
        est-pop
        120ms
        ease-out;
}

@keyframes est-pop {

    from {
        opacity: 0;
        transform:
            translateY(-50%)
            scale(0.9);
    }

    to {
        opacity: 1;
        transform:
            translateY(-50%)
            scale(1);
    }

}

.est-btn {

    position: relative;

    display: flex;

    align-items: center;

    justify-content: center;

    width: 34px;

    height: 34px;

    border: none;

    background: transparent;

    color: #52525b;

    border-radius: 9px;

    cursor: pointer;

    transition:
        background 120ms ease,
        color 120ms ease,
        transform 80ms ease;
}

.est-btn:hover {

    background:
        #f4f4f5;

    color:
        #18181b;
}

.est-btn:active {

    transform:
        scale(0.92);
}

.est-btn-delete:hover {

    background:
        #fdecec;

    color:
        #e0483f;
}

.est-tooltip {

    position: absolute;

    right:
        calc(100% + 8px);

    top:
        50%;

    transform:
        translateY(-50%);

    background:
        #18181b;

    color:
        #fafafa;

    font-size:
        11px;

    font-weight:
        500;

    line-height:
        1;

    white-space:
        nowrap;

    padding:
        5px 8px;

    border-radius:
        6px;

    opacity:
        0;

    pointer-events:
        none;

    transition:
        opacity 120ms ease;
}

.est-btn:hover .est-tooltip {

    opacity:
        1;
}

.est-dialog {

    animation:
        est-pop-dialog
        110ms
        ease-out;

    transform-origin:
        left center;
}

@keyframes est-pop-dialog {

    from {

        opacity:
            0;

        transform:
            scale(0.94);
    }

    to {

        opacity:
            1;

        transform:
            scale(1);
    }

}

`;


//======================================================
// DELETE DIALOG
//======================================================

interface DeleteDialogProps {

    label:
        string;

    onConfirm:
        () => void;

    onCancel:
        () => void;

}


function DeleteDialog({

    label,

    onConfirm,

    onCancel

}: DeleteDialogProps) {

    return (

        <div
            className="est-dialog"
            style={{

                position:
                    "absolute",

                left:
                    "calc(100% + 12px)",

                top:
                    "50%",

                transform:
                    "translateY(-50%)",

                background:
                    "#ffffff",

                border:
                    "1px solid #ececee",

                borderRadius:
                    "14px",

                padding:
                    "14px",

                minWidth:
                    "200px",

                boxShadow:
                    "0 12px 32px rgba(15,15,20,0.16), 0 2px 8px rgba(15,15,20,0.06)",

                fontFamily:
                    "'Inter', system-ui, -apple-system, sans-serif",

                color:
                    "#18181b",

                zIndex:
                    20

            }}
        >

            <div
                style={{

                    display:
                        "flex",

                    alignItems:
                        "flex-start",

                    gap:
                        "10px",

                    marginBottom:
                        "12px"

                }}
            >

                <div
                    style={{

                        flexShrink:
                            0,

                        width:
                            "28px",

                        height:
                            "28px",

                        borderRadius:
                            "999px",

                        background:
                            "#fdecec",

                        color:
                            "#e0483f",

                        display:
                            "flex",

                        alignItems:
                            "center",

                        justifyContent:
                            "center"

                    }}
                >

                    <TrashIcon />

                </div>


                <div>

                    <div
                        style={{

                            fontSize:
                                "13px",

                            fontWeight:
                                600,

                            marginBottom:
                                "2px"

                        }}
                    >

                        Delete {label}?

                    </div>


                    <div
                        style={{

                            fontSize:
                                "12px",

                            color:
                                "#8b8b93",

                            lineHeight:
                                1.4

                        }}
                    >

                        This action can be undone.

                    </div>

                </div>

            </div>


            <div
                style={{

                    display:
                        "flex",

                    gap:
                        "8px",

                    justifyContent:
                        "flex-end"

                }}
            >

                <button
                    type="button"
                    onClick={onCancel}
                    style={{

                        border:
                            "1px solid #e4e4e7",

                        background:
                            "#ffffff",

                        color:
                            "#3f3f46",

                        borderRadius:
                            "8px",

                        padding:
                            "6px 12px",

                        cursor:
                            "pointer",

                        fontSize:
                            "12px",

                        fontWeight:
                            500

                    }}
                >

                    Cancel

                </button>


                <button
                    type="button"
                    onClick={onConfirm}
                    style={{

                        border:
                            "none",

                        background:
                            "#e0483f",

                        color:
                            "#ffffff",

                        borderRadius:
                            "8px",

                        padding:
                            "6px 12px",

                        cursor:
                            "pointer",

                        fontSize:
                            "12px",

                        fontWeight:
                            600

                    }}
                >

                    Delete

                </button>

            </div>

        </div>

    );

}


//======================================================
// ANGLE HELPERS
//======================================================

const TWO_PI =
    Math.PI * 2;

const QUARTER_TURN =
    Math.PI / 2;


//------------------------------------------------------
// Normalize angle to 0 ... 2PI
//------------------------------------------------------

function normalizeAngle(
    angle: number
): number {

    let result =
        angle % TWO_PI;

    if (
        result < 0
    ) {

        result +=
            TWO_PI;

    }

    return result;
}


//------------------------------------------------------
// Difference between two angles.
// Result is -PI ... +PI.
//------------------------------------------------------

function shortestAngleDifference(
    angle: number,
    target: number
): number {

    let difference =
        normalizeAngle(angle) -
        normalizeAngle(target);


    while (
        difference > Math.PI
    ) {

        difference -=
            TWO_PI;

    }


    while (
        difference < -Math.PI
    ) {

        difference +=
            TWO_PI;

    }


    return difference;
}


//------------------------------------------------------
// SOFT 90° SNAP
//
// This is intentionally NOT a hard snap.
//
// Example:
//
// 83° -> slightly pulled toward 90°
// 87° -> more strongly pulled toward 90°
// 89° -> very close to 90°
// 90° -> exactly 90°
//
// Outside the snap range, the angle remains free.
//------------------------------------------------------

function softSnapRotation(
    angle: number
): number {

    const normalized =
        normalizeAngle(
            angle
        );

    const nearestQuarter =
        Math.round(
            normalized /
            QUARTER_TURN
        ) *
        QUARTER_TURN;

    const difference =
        shortestAngleDifference(
            normalized,
            nearestQuarter
        );

    const distance =
        Math.abs(
            difference
        );

    //--------------------------------------------------
    // Larger magnetic range.
    //
    // The snap starts being noticeable roughly
    // 15 degrees before a 90-degree angle.
    //--------------------------------------------------

    const snapRange =
        Math.PI / 4.5;
        // 15 degrees

    if (
        distance >=
        snapRange
    ) {

        return normalized;
    }

    //--------------------------------------------------
    // 0 at the outside of the snap range.
    // 1 directly on the 90-degree angle.
    //--------------------------------------------------

    const normalizedDistance =
        1 -
        (
            distance /
            snapRange
        );

    //--------------------------------------------------
    // Smooth magnetic curve.
    //--------------------------------------------------

    const smoothStrength =
        normalizedDistance *
        normalizedDistance *
        (
            3 -
            2 *
            normalizedDistance
        );

    //--------------------------------------------------
    // Stronger pull toward 90°.
    //--------------------------------------------------

    const pullStrength =
        1.0 *
        smoothStrength;

    const snapped =
        normalized -
        difference *
        pullStrength;

    //--------------------------------------------------
    // Exact 90° remains exact.
    //--------------------------------------------------

    if (
        distance <=
        0.0005
    ) {

        return normalizeAngle(
            nearestQuarter
        );
    }

    return normalizeAngle(
        snapped
    );
}


//------------------------------------------------------
// Pointer angle around rotation ring
//------------------------------------------------------

function getPointerAngle(
    clientX: number,
    clientY: number,
    rect: DOMRect
): number {

    const centerX =
        rect.left +
        rect.width * 0.5;

    const centerY =
        rect.top +
        rect.height * 0.5;


    return Math.atan2(

        clientY -
            centerY,

        clientX -
            centerX

    );
}


//------------------------------------------------------
// Unwrap the delta between two pointer angles.
//------------------------------------------------------

function unwrapAngleDelta(
    delta: number
): number {

    while (
        delta > Math.PI
    ) {

        delta -=
            TWO_PI;

    }


    while (
        delta < -Math.PI
    ) {

        delta +=
            TWO_PI;

    }


    return delta;
}


//======================================================
// COMPONENT
//======================================================

export default function SelectionToolbar() {

    const {
        state,
        dispatch
    } = useEditor();


    //==================================================
    // DELETE
    //==================================================

    const [
        deleteOpen,
        setDeleteOpen
    ] = useState(false);


    //==================================================
    // ROTATION
    //==================================================

    const [
        rotationMode,
        setRotationMode
    ] = useState(false);


    const [
        rotationDisplayY,
        setRotationDisplayY
    ] = useState(0);


    const [
        rotationValid,
        setRotationValid
    ] = useState(true);


    const rotationRingRef =
        useRef<HTMLDivElement | null>(
            null
        );


    const rotationDragRef =
        useRef<{

            startPointerAngle:
                number;

            lastPointerAngle:
                number;

            accumulatedDelta:
                number;

            startRotation:
                number;

            currentRotation:
                number;

            currentValid:
                boolean;

            handleMove:
                (event: PointerEvent) => void;

            handleUp:
                () => void;

        } | null>(
            null
        );


    //==================================================
    // FURNITURE CATALOG
    //==================================================

    const [
        furnitureCatalogLoaded,
        setFurnitureCatalogLoaded
    ] = useState(false);


    useEffect(

        () => {

            let cancelled =
                false;


            getFurnitureAssets()

                .then(

                    () => {

                        if (
                            !cancelled
                        ) {

                            setFurnitureCatalogLoaded(
                                true
                            );

                        }

                    }

                )

                .catch(

                    error => {

                        console.error(

                            "Failed to load furniture catalog for selection toolbar:",

                            error

                        );


                        if (
                            !cancelled
                        ) {

                            setFurnitureCatalogLoaded(
                                true
                            );

                        }

                    }

                );


            return () => {

                cancelled =
                    true;

            };

        },

        []

    );


    void furnitureCatalogLoaded;


    //==================================================
    // SELECTED FURNITURE
    //==================================================

    const furniture =
        state.furniture.find(

            item =>
                item.id ===
                state.selectedFurnitureId

        ) ?? null;


    //==================================================
    // SELECTED DOOR
    //==================================================

    const door =
        state.doors.find(

            item =>
                item.id ===
                state.selectedDoorId

        ) ?? null;


    //==================================================
    // SELECTED WINDOW
    //==================================================

    const selectedWindow =
        state.windows.find(

            item =>
                item.id ===
                state.selectedWindowId

        ) ?? null;


    //==================================================
    // CLEAN ROTATION DRAG
    //==================================================

    function cleanupRotationDrag() {

        const drag =
            rotationDragRef.current;


        if (
            !drag
        ) {
            return;
        }


        window.removeEventListener(
            "pointermove",
            drag.handleMove
        );


        window.removeEventListener(
            "pointerup",
            drag.handleUp
        );


        window.removeEventListener(
            "pointercancel",
            drag.handleUp
        );


        rotationDragRef.current =
            null;
    }


    //==================================================
    // COMPONENT CLEANUP
    //==================================================

    useEffect(

        () => {

            return () => {

                cleanupRotationDrag();

                furnitureInteraction
                    .clearRotationPreview();

            };

        },

        []

    );


    //==================================================
    // ESCAPE
    //==================================================

    useEffect(

        () => {

            if (
                !rotationMode
            ) {
                return;
            }


            const onKeyDown =
                (
                    event: KeyboardEvent
                ) => {

                    if (
                        event.key !==
                        "Escape"
                    ) {

                        return;

                    }


                    cleanupRotationDrag();


                    furnitureInteraction
                        .clearRotationPreview();


                    setRotationMode(
                        false
                    );

                };


            window.addEventListener(
                "keydown",
                onKeyDown
            );


            return () => {

                window.removeEventListener(
                    "keydown",
                    onKeyDown
                );

            };

        },

        [
            rotationMode
        ]

    );


    //==================================================
    // NO SELECTION
    //==================================================

    if (

        !furniture &&

        !door &&

        !selectedWindow

    ) {

        return null;

    }


    //==================================================
    // SELECTED TYPE
    //==================================================

    let selectedType:
        | "furniture"
        | "door"
        | "window" =
        "furniture";


    if (
        furniture
    ) {

        selectedType =
            "furniture";

    }

    else if (
        door
    ) {

        selectedType =
            "door";

    }

    else {

        selectedType =
            "window";

    }


    //==================================================
    // SELECTED FURNITURE ASSET
    //==================================================

    const furnitureAsset =
        furniture

            ? (

                getCachedFurnitureAsset(
                    furniture.assetId
                ) ??

                findAsset(
                    furniture.assetId
                ) ??

                null

            )

            : null;


    //==================================================
    // WALL FURNITURE
    //==================================================

    const isWallFurniture =

        selectedType ===
            "furniture" &&

        Boolean(

            furnitureAsset &&

            furnitureAsset
                .placementSurfaces
                ?.includes(
                    "wall"
                )

        );


    //==================================================
    // TOOLBAR ANCHOR
    //==================================================

    const anchor =
        new Vector3();


    if (
        furniture
    ) {

        anchor.copy(
            furniture.position
        );

        anchor.y +=
            furniture.height *
            0.5;

    }

    else if (
        door
    ) {

        anchor.copy(
            door.position
        );

        anchor.y +=
            door.height *
            0.5;

    }

    else if (
        selectedWindow
    ) {

        anchor.copy(
            selectedWindow.position
        );

        anchor.y +=
            selectedWindow.height *
            0.5;

    }


    //==================================================
    // LABEL
    //==================================================

    const label =

        selectedType ===
            "furniture"

            ? "Furniture"

            : selectedType ===
                "door"

                ? "Door"

                : "Window";


    //==================================================
    // START DUPLICATE FURNITURE
    //
    // IMPORTANT:
    //
    // No ADD_FURNITURE happens here.
    //
    // We simply enter normal furniture placement mode.
    // The existing FurnitureInteractionEvents will add
    // the furniture only after the user clicks.
    //==================================================

    function duplicateFurniture() {

        setDeleteOpen(
            false
        );


        if (
            !furniture
        ) {
            return;
        }


        const asset =
            getCachedFurnitureAsset(
                furniture.assetId
            ) ??
            findAsset(
                furniture.assetId
            );


        if (
            !asset
        ) {

            console.error(

                "Unable to duplicate furniture: asset not found.",

                furniture.assetId

            );

            return;

        }


        //--------------------------------------------------
        // Cancel any old rotation session.
        //--------------------------------------------------

        cleanupRotationDrag();

        furnitureInteraction
            .clearRotationPreview();

        furnitureInteraction
            .clearPreview();

        furnitureInteraction
            .resetRotation();


        //--------------------------------------------------
        // Remove the existing object's selection UI.
        //--------------------------------------------------

        dispatch({

            type:
                "CLEAR_SELECTION"

        });


        //--------------------------------------------------
        // Start a NEW furniture placement session.
        //--------------------------------------------------

        dispatch({

            type:
                "SET_SELECTED_ASSET",

            payload:
                asset

        });


        dispatch({

            type:
                "SET_BUILD_TOOL",

            payload:
                BuildTool.Furniture

        });

    }


    //==================================================
    // START DUPLICATE DOOR
    //==================================================

    function duplicateDoor() {

        setDeleteOpen(
            false
        );


        if (
            !door
        ) {
            return;
        }


        const asset =
            findAsset(
                door.assetId
            );


        if (
            !asset
        ) {

            console.error(

                "Unable to duplicate door: asset not found.",

                door.assetId

            );

            return;

        }


        buildInteraction.clear();


        dispatch({

            type:
                "CLEAR_SELECTION"

        });


        dispatch({

            type:
                "SET_SELECTED_ASSET",

            payload:
                asset

        });


        dispatch({

            type:
                "SET_BUILD_TOOL",

            payload:
                BuildTool.Door

        });

    }


    //==================================================
    // START DUPLICATE WINDOW
    //==================================================

    function duplicateWindow() {

        setDeleteOpen(
            false
        );


        if (
            !selectedWindow
        ) {
            return;
        }


        const asset =
            findAsset(
                selectedWindow.assetId
            );


        if (
            !asset
        ) {

            console.error(

                "Unable to duplicate window: asset not found.",

                selectedWindow.assetId

            );

            return;

        }


        buildInteraction.clear();


        dispatch({

            type:
                "CLEAR_SELECTION"

        });


        dispatch({

            type:
                "SET_SELECTED_ASSET",

            payload:
                asset

        });


        dispatch({

            type:
                "SET_BUILD_TOOL",

            payload:
                BuildTool.Window

        });

    }


    //==================================================
    // ENTER ROTATION MODE
    //==================================================

    function enterRotationMode() {

        setDeleteOpen(
            false
        );


        if (
            !furniture
        ) {
            return;
        }


        if (
            isWallFurniture
        ) {
            return;
        }


        setRotationDisplayY(
            furniture.rotationY
        );


        setRotationValid(
            true
        );


        setRotationMode(
            true
        );

    }


    //==================================================
    // BEGIN FREE ROTATION
    //==================================================

    function beginRotationDrag(

        event:
            ReactPointerEvent<HTMLDivElement>

    ) {

        if (
            !furniture
        ) {
            return;
        }


        event.preventDefault();
        event.stopPropagation();


        const ring =
            rotationRingRef.current;


        if (
            !ring
        ) {
            return;
        }


        cleanupRotationDrag();


        const rect =
            ring.getBoundingClientRect();


        const startPointerAngle =
            getPointerAngle(

                event.clientX,
                event.clientY,
                rect

            );


        const startRotation =
            normalizeAngle(
                furniture.rotationY
            );


        furnitureInteraction
            .startRotation(

                furniture.id,
                startRotation

            );


        setRotationDisplayY(
            startRotation
        );


        setRotationValid(
            true
        );


        const drag = {

            startPointerAngle,

            lastPointerAngle:
                startPointerAngle,

            accumulatedDelta:
                0,

            startRotation,

            currentRotation:
                startRotation,

            currentValid:
                true,

            //--------------------------------------------------
            // POINTER MOVE
            //--------------------------------------------------

            handleMove:
    (moveEvent: PointerEvent) => {

        moveEvent.preventDefault();

        const currentRect =
            ring.getBoundingClientRect();

        const currentPointerAngle =
            getPointerAngle(
                moveEvent.clientX,
                moveEvent.clientY,
                currentRect
            );

        //--------------------------------------------------
        // IMPORTANT:
        //
        // Reverse the pointer delta so the furniture
        // follows the SAME direction as the mouse drag.
        //
        // Mouse clockwise
        //     ↓
        // Furniture clockwise
        //
        // Mouse counter-clockwise
        //     ↓
        // Furniture counter-clockwise
        //--------------------------------------------------

        const delta =
            unwrapAngleDelta(
                drag.lastPointerAngle -
                currentPointerAngle
            );

        drag.accumulatedDelta +=
            delta;

        drag.lastPointerAngle =
            currentPointerAngle;

        //--------------------------------------------------
        // Free rotation.
        //--------------------------------------------------

        const rawRotation =
            normalizeAngle(

                drag.startRotation +
                drag.accumulatedDelta

            );

        //--------------------------------------------------
        // Apply noticeable soft 90° snap.
        //--------------------------------------------------

        const candidateRotation =
            softSnapRotation(
                rawRotation
            );

        //--------------------------------------------------
        // Collision test.
        //--------------------------------------------------

        const collision =
            checkFurnitureCollision(

                furniture.position,

                furniture.width,

                furniture.depth,

                candidateRotation,

                state.walls,

                state.furniture,

                state.wallThickness,

                0.01,

                {

                    height:
                        furniture.height,

                    ignoreFurnitureId:
                        furniture.id

                }

            );

        const valid =
            collision.valid;

        //--------------------------------------------------
        // Save current rotation.
        //--------------------------------------------------

        drag.currentRotation =
            candidateRotation;

        drag.currentValid =
            valid;

        //--------------------------------------------------
        // Update 3D furniture preview.
        //--------------------------------------------------

        furnitureInteraction
            .setRotationPreview(

                furniture.id,

                candidateRotation,

                valid

            );

        //--------------------------------------------------
        // Update toolbar UI.
        //--------------------------------------------------

        setRotationDisplayY(
            candidateRotation
        );

        setRotationValid(
            valid
        );
    },


            //--------------------------------------------------
            // POINTER UP
            //--------------------------------------------------

            handleUp:
                () => {

                    //--------------------------------------------------
                    // Only commit a safe rotation.
                    //--------------------------------------------------

                    if (
                        drag.currentValid
                    ) {

                        dispatch({

                            type:
                                "UPDATE_FURNITURE",

                            payload: {

                                id:
                                    furniture.id,

                                changes: {

                                    rotationY:
                                        drag.currentRotation

                                }

                            }

                        });

                    }


                    cleanupRotationDrag();


                    furnitureInteraction
                        .clearRotationPreview();


                    setRotationMode(
                        false
                    );

                }

        };


        rotationDragRef.current =
            drag;


        window.addEventListener(
            "pointermove",
            drag.handleMove
        );


        window.addEventListener(
            "pointerup",
            drag.handleUp
        );


        window.addEventListener(
            "pointercancel",
            drag.handleUp
        );

    }


    //==================================================
    // CANCEL ROTATION
    //==================================================

    function cancelRotation() {

        cleanupRotationDrag();


        furnitureInteraction
            .clearRotationPreview();


        setRotationMode(
            false
        );

    }


    //==================================================
    // MOVE FURNITURE
    //==================================================

    function moveFurniture() {

        setDeleteOpen(
            false
        );


        if (
            !furniture
        ) {
            return;
        }


        cancelRotation();


        furnitureInteraction.startEditing(

            furniture.id,

            furniture.rotationY

        );


        dispatch({

            type:
                "SET_MOVING_FURNITURE",

            payload:
                furniture.id

        });

    }


    //==================================================
    // MOVE DOOR
    //==================================================

    function moveDoor() {

        setDeleteOpen(
            false
        );


        if (
            !door
        ) {
            return;
        }


        buildInteraction.beginDoorMove(
            door.id
        );


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
                BuildTool.Door

        });

    }


    //==================================================
    // MOVE WINDOW
    //==================================================

    function moveWindow() {

        setDeleteOpen(
            false
        );


        if (
            !selectedWindow
        ) {
            return;
        }


        buildInteraction.beginWindowMove(
            selectedWindow.id
        );


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
                BuildTool.Window

        });

    }


    //==================================================
    // DELETE
    //==================================================

    function confirmDelete() {

        setDeleteOpen(
            false
        );


        if (

            selectedType ===
                "furniture" &&

            furniture

        ) {

            cancelRotation();


            dispatch({

                type:
                    "REMOVE_FURNITURE",

                payload:
                    furniture.id

            });

            return;

        }


        if (

            selectedType ===
                "door" &&

            door

        ) {

            dispatch({

                type:
                    "REMOVE_DOOR",

                payload:
                    door.id

            });

            return;

        }


        if (

            selectedType ===
                "window" &&

            selectedWindow

        ) {

            dispatch({

                type:
                    "REMOVE_WINDOW",

                payload:
                    selectedWindow.id

            });

        }

    }


    //==================================================
    // ROTATION DISPLAY
    //==================================================

    const displayDegrees =
        Math.round(

            normalizeAngle(
                rotationDisplayY
            ) *
            180 /
            Math.PI

        ) % 360;


    const handleAngle =
        normalizeAngle(
            -rotationDisplayY
        );


    const handleX =
        50 +
        Math.cos(
            handleAngle -
            Math.PI / 2
        ) *
        42;


    const handleY =
        50 +
        Math.sin(
            handleAngle -
            Math.PI / 2
        ) *
        42;


    //==================================================
    // ROTATION MODE UI
    //==================================================

    if (
        rotationMode &&
        furniture
    ) {

        return (

            <Html
                position={[

                    anchor.x,
                    anchor.y,
                    anchor.z

                ]}
                zIndexRange={[
                    10000,
                    0
                ]}
            >

                <style>
                    {
                        TOOLBAR_STYLES
                    }
                </style>


                <div

                    onPointerDown={
                        event => {

                            event.preventDefault();
                            event.stopPropagation();

                        }
                    }

                    style={{

                        position:
                            "relative",

                        width:
                            "170px",

                        height:
                            "170px",

                        transform:
                            "translate(-50%, -50%)",

                        pointerEvents:
                            "auto"

                    }}
                >

                    <div

                        ref={
                            rotationRingRef
                        }

                        onPointerDown={
                            beginRotationDrag
                        }

                        style={{

                            position:
                                "absolute",

                            left:
                                "50%",

                            top:
                                "50%",

                            width:
                                "130px",

                            height:
                                "130px",

                            transform:
                                "translate(-50%, -50%)",

                            border:
                                `1.5px solid ${
                                    rotationValid
                                        ? "#777777"
                                        : "#D9534F"
                                }`,

                            borderRadius:
                                "50%",

                            boxSizing:
                                "border-box",

                            cursor:
                                "grab",

                            background:
                                "rgba(255,255,255,0.03)",

                            boxShadow:

                                rotationValid

                                    ? "0 2px 8px rgba(0,0,0,0.05)"

                                    : "0 0 0 2px rgba(217,83,79,0.12)"

                        }}
                    >

                        {/*------------------------------------------
                            CENTER ICON
                        ------------------------------------------*/}

                        <div
                            style={{

                                position:
                                    "absolute",

                                left:
                                    "50%",

                                top:
                                    "50%",

                                transform:
                                    "translate(-50%, -50%)",

                                width:
                                    "42px",

                                height:
                                    "42px",

                                borderRadius:
                                    "50%",

                                background:
                                    "#ffffff",

                                border:
                                    "1px solid #e5e5e7",

                                display:
                                    "flex",

                                alignItems:
                                    "center",

                                justifyContent:
                                    "center",

                                boxShadow:
                                    "0 4px 12px rgba(0,0,0,0.10)",

                                color:
                                    rotationValid
                                        ? "#52525b"
                                        : "#D9534F"

                            }}
                        >

                            <RotateIcon />

                        </div>


                        {/*------------------------------------------
                            ROTATION HANDLE
                        ------------------------------------------*/}

                        <div
                            style={{

                                position:
                                    "absolute",

                                left:
                                    `${handleX}%`,

                                top:
                                    `${handleY}%`,

                                transform:
                                    "translate(-50%, -50%)",

                                width:
                                    "24px",

                                height:
                                    "24px",

                                borderRadius:
                                    "50%",

                                background:
                                    rotationValid
                                        ? "#ffffff"
                                        : "#fdecec",

                                border:
                                    `1.5px solid ${
                                        rotationValid
                                            ? "#666666"
                                            : "#D9534F"
                                    }`,

                                boxSizing:
                                    "border-box",

                                pointerEvents:
                                    "none",

                                boxShadow:
                                    "0 2px 7px rgba(0,0,0,0.10)"

                            }}
                        />


                        {/*------------------------------------------
                            ANGLE
                        ------------------------------------------*/}

                        <div
                            style={{

                                position:
                                    "absolute",

                                left:
                                    "50%",

                                bottom:
                                    "-28px",

                                transform:
                                    "translateX(-50%)",

                                background:
                                    rotationValid
                                        ? "#18181b"
                                        : "#D9534F",

                                color:
                                    "#ffffff",

                                borderRadius:
                                    "7px",

                                padding:
                                    "5px 8px",

                                fontSize:
                                    "11px",

                                fontWeight:
                                    600,

                                whiteSpace:
                                    "nowrap",

                                boxShadow:
                                    "0 3px 10px rgba(0,0,0,0.14)"

                            }}
                        >

                            {displayDegrees}°

                            {
                                !rotationValid &&
                                " • Blocked"
                            }

                        </div>


                        {/*------------------------------------------
                            CANCEL
                        ------------------------------------------*/}

                        <button

                            type="button"

                            onPointerDown={
                                event => {

                                    event.preventDefault();
                                    event.stopPropagation();

                                    cancelRotation();

                                }
                            }

                            style={{

                                position:
                                    "absolute",

                                right:
                                    "-12px",

                                top:
                                    "-12px",

                                width:
                                    "24px",

                                height:
                                    "24px",

                                borderRadius:
                                    "50%",

                                border:
                                    "1px solid #e4e4e7",

                                background:
                                    "#ffffff",

                                color:
                                    "#71717a",

                                cursor:
                                    "pointer",

                                fontSize:
                                    "12px",

                                fontWeight:
                                    600,

                                display:
                                    "flex",

                                alignItems:
                                    "center",

                                justifyContent:
                                    "center",

                                boxShadow:
                                    "0 3px 10px rgba(0,0,0,0.10)"

                            }}
                        >

                            ×

                        </button>

                    </div>

                </div>

            </Html>

        );

    }


    //==================================================
    // NORMAL TOOLBAR
    //==================================================

    return (

        <Html
            position={[

                anchor.x,
                anchor.y,
                anchor.z

            ]}
            zIndexRange={[
                10000,
                0
            ]}
        >

            <style>
                {
                    TOOLBAR_STYLES
                }
            </style>


            <div
                style={{

                    position:
                        "relative"

                }}
            >

                {/*==================================================
                    CONNECTOR
                ==================================================*/}

                <div
                    style={{

                        position:
                            "absolute",

                        left:
                            0,

                        top:
                            "50%",

                        width:
                            "18px",

                        height:
                            "1px",

                        background:
                            "#d4d4d8",

                        transform:
                            "translateY(-50%)"

                    }}
                />


                <div

                    className=
                        "selection-toolbar est-toolbar"

                    onPointerDown={
                        event => {

                            event.preventDefault();
                            event.stopPropagation();

                        }
                    }

                    onPointerUp={
                        event => {

                            event.preventDefault();
                            event.stopPropagation();

                        }
                    }

                    onClick={
                        event => {

                            event.stopPropagation();

                        }
                    }

                    style={{

                        position:
                            "relative",

                        display:
                            "flex",

                        flexDirection:
                            "column",

                        alignItems:
                            "stretch",

                        gap:
                            "2px",

                        marginLeft:
                            "18px",

                        transform:
                            "translateY(-50%)",

                        background:
                            "#ffffff",

                        border:
                            "1px solid #ececee",

                        borderRadius:
                            "16px",

                        padding:
                            "5px",

                        boxShadow:
                            "0 10px 28px rgba(15,15,20,0.14), 0 2px 6px rgba(15,15,20,0.05)",

                        fontFamily:
                            "'Inter', system-ui, -apple-system, sans-serif",

                        zIndex:
                            10

                    }}
                >

                    {/*==================================================
                        FURNITURE
                    ==================================================*/}

                    {
                        selectedType ===
                            "furniture" && (

                            <>

                                {
                                    !isWallFurniture && (

                                        <button
                                            type="button"
                                            className="est-btn"
                                            onClick={
                                                enterRotationMode
                                            }
                                        >

                                            <RotateIcon />

                                            <span
                                                className=
                                                    "est-tooltip"
                                            >
                                                Rotate
                                            </span>

                                        </button>

                                    )
                                }


                                <button
                                    type="button"
                                    className="est-btn"
                                    onClick={
                                        duplicateFurniture
                                    }
                                >

                                    <DuplicateIcon />

                                    <span
                                        className=
                                            "est-tooltip"
                                    >
                                        Duplicate
                                    </span>

                                </button>


                                <button
                                    type="button"
                                    className="est-btn"
                                    onClick={
                                        moveFurniture
                                    }
                                >

                                    <MoveIcon />

                                    <span
                                        className=
                                            "est-tooltip"
                                    >
                                        Move
                                    </span>

                                </button>

                            </>

                        )
                    }


                    {/*==================================================
                        DOOR
                    ==================================================*/}

                    {
                        selectedType ===
                            "door" && (

                            <>

                                <button
                                    type="button"
                                    className="est-btn"
                                    onClick={
                                        duplicateDoor
                                    }
                                >

                                    <DuplicateIcon />

                                    <span
                                        className=
                                            "est-tooltip"
                                    >
                                        Duplicate
                                    </span>

                                </button>


                                <button
                                    type="button"
                                    className="est-btn"
                                    onClick={
                                        moveDoor
                                    }
                                >

                                    <MoveIcon />

                                    <span
                                        className=
                                            "est-tooltip"
                                    >
                                        Move
                                    </span>

                                </button>

                            </>

                        )
                    }


                    {/*==================================================
                        WINDOW
                    ==================================================*/}

                    {
                        selectedType ===
                            "window" && (

                            <>

                                <button
                                    type="button"
                                    className="est-btn"
                                    onClick={
                                        duplicateWindow
                                    }
                                >

                                    <DuplicateIcon />

                                    <span
                                        className=
                                            "est-tooltip"
                                    >
                                        Duplicate
                                    </span>

                                </button>


                                <button
                                    type="button"
                                    className="est-btn"
                                    onClick={
                                        moveWindow
                                    }
                                >

                                    <MoveIcon />

                                    <span
                                        className=
                                            "est-tooltip"
                                    >
                                        Move
                                    </span>

                                </button>

                            </>

                        )
                    }


                    {/*==================================================
                        DIVIDER
                    ==================================================*/}

                    <div
                        style={{

                            height:
                                "1px",

                            background:
                                "#f0f0f1",

                            margin:
                                "3px 4px"

                        }}
                    />


                    {/*==================================================
                        DELETE
                    ==================================================*/}

                    <button
                        type="button"
                        className=
                            "est-btn est-btn-delete"
                        onClick={() =>
                            setDeleteOpen(
                                value =>
                                    !value
                            )
                        }
                    >

                        <TrashIcon />

                        <span
                            className=
                                "est-tooltip"
                        >
                            Delete
                        </span>

                    </button>


                    {/*==================================================
                        DELETE DIALOG
                    ==================================================*/}

                    {
                        deleteOpen && (

                            <DeleteDialog

                                label={
                                    label
                                }

                                onConfirm={
                                    confirmDelete
                                }

                                onCancel={() =>
                                    setDeleteOpen(
                                        false
                                    )
                                }

                            />

                        )
                    }

                </div>

            </div>

        </Html>

    );

}