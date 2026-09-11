import {
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
    furnitureInteraction
} from "./Furniture/FurnitureInteraction";

import {
    buildInteraction
} from "./Build/BuildInteraction";


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
            style={{
                position:
                    "absolute",

                left:
                    "48px",

                top:
                    "0",

                background:
                    "#ffffff",

                border:
                    "1px solid #dddddd",

                borderRadius:
                    "10px",

                padding:
                    "12px",

                minWidth:
                    "190px",

                boxShadow:
                    "0 8px 24px rgba(0,0,0,0.16)",

                fontFamily:
                    "Arial, sans-serif",

                color:
                    "#222",

                zIndex:
                    20
            }}
        >

            <div
                style={{
                    fontSize:
                        "13px",

                    fontWeight:
                        600,

                    marginBottom:
                        "5px"
                }}
            >
                Delete {label}?
            </div>

            <div
                style={{
                    fontSize:
                        "12px",

                    color:
                        "#666",

                    marginBottom:
                        "10px"
                }}
            >
                This action can be undone.
            </div>

            <div
                style={{
                    display:
                        "flex",

                    gap:
                        "6px",

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
                            "none",

                        background:
                            "#eeeeee",

                        borderRadius:
                            "6px",

                        padding:
                            "6px 10px",

                        cursor:
                            "pointer",

                        fontSize:
                            "12px"
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
                            "#d9534f",

                        color:
                            "#ffffff",

                        borderRadius:
                            "6px",

                        padding:
                            "6px 10px",

                        cursor:
                            "pointer",

                        fontSize:
                            "12px"
                    }}
                >
                    Delete
                </button>

            </div>

        </div>
    );
}


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
        selectedType === "furniture"

            ? "Furniture"

            : selectedType === "door"

                ? "Door"

                : "Window";


    //==================================================
    // Rotate furniture ONLY
    //
    // Door and Window cannot rotate.
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
    //
    // IMPORTANT:
    //
    // Do NOT set selectedAsset.
    // Do NOT set BuildTool.Furniture.
    //
    // movingFurnitureId is the move state.
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
        // BuildTool is only being used to wake up the
        // React preview system.
        //
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

            <div
                className="selection-toolbar"
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
                        "4px",

                    marginLeft:
                        "24px",

                    transform:
                        "translateY(-50%)",

                    background:
                        "#ffffff",

                    border:
                        "1px solid #dddddd",

                    borderRadius:
                        "9px",

                    padding:
                        "5px",

                    boxShadow:
                        "0 5px 18px rgba(0,0,0,0.15)",

                    width:
                        "64px",

                    boxSizing:
                        "border-box",

                    zIndex:
                        10
                }}
            >

                {/*==================================================
                    FURNITURE TOOLS
                ==================================================*/}

                {selectedType ===
                    "furniture" && (

                    <>

                        <button
                            type="button"
                            onClick={
                                rotateFurniture
                            }
                            style={{
                                border:
                                    "none",

                                background:
                                    "#f5f5f5",

                                borderRadius:
                                    "6px",

                                padding:
                                    "7px 4px",

                                cursor:
                                    "pointer",

                                fontSize:
                                    "11px",

                                width:
                                    "100%"
                            }}
                        >
                            Rotate
                        </button>


                        <button
                            type="button"
                            onClick={
                                moveFurniture
                            }
                            style={{
                                border:
                                    "none",

                                background:
                                    "#f5f5f5",

                                borderRadius:
                                    "6px",

                                padding:
                                    "7px 4px",

                                cursor:
                                    "pointer",

                                fontSize:
                                    "11px",

                                width:
                                    "100%"
                            }}
                        >
                            Move
                        </button>

                    </>
                )}


                {/*==================================================
                    DOOR TOOLS

                    NO ROTATE
                ==================================================*/}

                {selectedType ===
                    "door" && (

                    <button
                        type="button"
                        onClick={
                            moveDoor
                        }
                        style={{
                            border:
                                "none",

                            background:
                                "#f5f5f5",

                            borderRadius:
                                "6px",

                            padding:
                                "7px 4px",

                            cursor:
                                "pointer",

                            fontSize:
                                "11px",

                            width:
                                "100%"
                        }}
                    >
                        Move
                    </button>
                )}


                {/*==================================================
                    WINDOW TOOLS

                    NO ROTATE
                ==================================================*/}

                {selectedType ===
                    "window" && (

                    <button
                        type="button"
                        onClick={
                            moveWindow
                        }
                        style={{
                            border:
                                "none",

                            background:
                                "#f5f5f5",

                            borderRadius:
                                "6px",

                            padding:
                                "7px 4px",

                            cursor:
                                "pointer",

                            fontSize:
                                "11px",

                            width:
                                "100%"
                        }}
                    >
                        Move
                    </button>
                )}


                {/*==================================================
                    DELETE
                ==================================================*/}

                <button
                    type="button"
                    onClick={() =>
                        setDeleteOpen(
                            value =>
                                !value
                        )
                    }
                    style={{
                        border:
                            "none",

                        background:
                            "#f5f5f5",

                        borderRadius:
                            "6px",

                        padding:
                            "7px 4px",

                        cursor:
                            "pointer",

                        fontSize:
                            "11px",

                        width:
                            "100%"
                    }}
                >
                    Delete
                </button>


                {/*==================================================
                    DELETE DIALOG
                ==================================================*/}

                {deleteOpen && (

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

                )}

            </div>

        </Html>
    );
}