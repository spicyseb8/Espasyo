import {
    useEffect,
    useState
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


//======================================================
// Icons
//
// Small inline SVGs so the toolbar has no extra
// dependency and every icon shares the same stroke
// weight / viewBox.
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
// Toolbar chrome shared across every icon button.
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

                    onClick={
                        onCancel
                    }

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

                    onClick={
                        onConfirm
                    }

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
// COMPONENT
//======================================================

export default function SelectionToolbar() {

    const {
        state,
        dispatch
    } = useEditor();


    const [
        deleteOpen,
        setDeleteOpen
    ] = useState(false);


    //==================================================
    // Firebase furniture catalog refresh
    //
    // This makes sure the toolbar knows whether the
    // selected furniture is a wall-placement asset.
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


    //--------------------------------------------------
    // Prevent unused-variable warning while still
    // making catalog loading trigger a render.
    //--------------------------------------------------

    void furnitureCatalogLoaded;


    //==================================================
    // Selected furniture
    //==================================================

    const furniture =
        state.furniture.find(

            item =>
                item.id ===
                state.selectedFurnitureId

        ) ?? null;


    //==================================================
    // Selected door
    //==================================================

    const door =
        state.doors.find(

            item =>
                item.id ===
                state.selectedDoorId

        ) ?? null;


    //==================================================
    // Selected window
    //==================================================

    const window =
        state.windows.find(

            item =>
                item.id ===
                state.selectedWindowId

        ) ?? null;


    //==================================================
    // No selection
    //==================================================

    if (

        !furniture &&

        !door &&

        !window

    ) {

        return null;

    }


    //==================================================
    // Determine selected type
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

    else if (
        window
    ) {

        selectedType =
            "window";

    }


    //==================================================
    // Find selected furniture asset
    //==================================================
    //
    // Firebase cache is preferred.
    // Local AssetLibrary remains a fallback.
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
    //
    // Furniture whose placement surface includes
    // "wall" does NOT get a Rotate button.
    //
    // Floor furniture still gets Rotate.
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
    // Toolbar anchor
    //
    // Keep the anchor around the middle of the object.
    // CSS then moves the toolbar to the RIGHT side.
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
        window
    ) {

        anchor.copy(
            window.position
        );

        anchor.y +=
            window.height *
            0.5;

    }


    //==================================================
    // Label
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
    // Rotate furniture
    //
    // ONLY available for furniture that is NOT
    // wall-mounted.
    //==================================================

    function rotateFurniture() {

        setDeleteOpen(
            false
        );


        if (
            !furniture
        ) {

            return;

        }


        //--------------------------------------------------
        // Safety:
        //
        // Wall furniture is never allowed to rotate.
        //--------------------------------------------------

        if (
            isWallFurniture
        ) {

            return;

        }


        dispatch({

            type:
                "UPDATE_FURNITURE",

            payload: {

                id:
                    furniture.id,

                changes: {

                    rotationY:
                        furniture.rotationY +
                        Math.PI / 2

                }

            }

        });

    }


    //==================================================
    // Move furniture
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
    // Move door
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


        //--------------------------------------------------
        // Existing door becomes the temporary move target.
        //--------------------------------------------------

        buildInteraction.beginDoorMove(
            door.id
        );


        //--------------------------------------------------
        // selectedAsset remains NULL.
        //--------------------------------------------------

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
    // Move window
    //==================================================

    function moveWindow() {

        setDeleteOpen(
            false
        );


        if (
            !window
        ) {

            return;

        }


        //--------------------------------------------------
        // Existing window becomes the temporary move target.
        //--------------------------------------------------

        buildInteraction.beginWindowMove(
            window.id
        );


        //--------------------------------------------------
        // selectedAsset remains NULL.
        //--------------------------------------------------

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
    // Delete
    //==================================================

    function confirmDelete() {

        setDeleteOpen(
            false
        );


        //--------------------------------------------------
        // Furniture
        //--------------------------------------------------

        if (

            selectedType ===
                "furniture" &&

            furniture

        ) {

            dispatch({

                type:
                    "REMOVE_FURNITURE",

                payload:
                    furniture.id

            });

            return;

        }


        //--------------------------------------------------
        // Door
        //--------------------------------------------------

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


        //--------------------------------------------------
        // Window
        //--------------------------------------------------

        if (

            selectedType ===
                "window" &&

            window

        ) {

            dispatch({

                type:
                    "REMOVE_WINDOW",

                payload:
                    window.id

            });

        }

    }


    //==================================================
    // Render
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
                    CONNECTOR STEM
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
                        FURNITURE TOOLS
                    ==================================================*/}

                    {
                        selectedType ===
                            "furniture" && (

                            <>

                                {/*------------------------------------------
                                    ROTATE

                                    Only floor furniture can rotate.

                                    Wall furniture:
                                        placementSurfaces includes "wall"
                                        → Rotate is hidden.
                                ------------------------------------------*/}

                                {
                                    !isWallFurniture && (

                                        <button

                                            type="button"

                                            className="est-btn"

                                            onClick={
                                                rotateFurniture
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


                                {/*------------------------------------------
                                    MOVE
                                ------------------------------------------*/}

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
                        DOOR TOOLS
                    ==================================================*/}

                    {
                        selectedType ===
                            "door" && (

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

                        )
                    }


                    {/*==================================================
                        WINDOW TOOLS
                    ==================================================*/}

                    {
                        selectedType ===
                            "window" && (

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