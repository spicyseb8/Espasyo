import "./FloorPlanPanel.css";

import {
    MousePointer2,
    PenLine,
    Square,
    ChevronDown,
    Upload,
    Trash2,
    Lock,
    Unlock
} from "lucide-react";

import {
    useState
} from "react";

import type {
    ChangeEvent
} from "react";

import useEditor
    from "../../../context/editor/useEditor";

import {
    Tool
} from "../../../context/editor/tools";

import {
    solveRegions
} from "../../../engine/regions/RegionSolver";

//==========================================================
// TOOLS
//==========================================================

const TOOLS = [
    {
        tool: Tool.Select,
        label: "Select",
        icon: MousePointer2
    },

    {
        tool: Tool.Wall,
        label: "Walls",
        icon: PenLine
    },

    {
        tool: Tool.Room,
        label: "Rooms",
        icon: Square
    }

] as const;

//==========================================================
// COMPONENT
//==========================================================

export default function FloorPlanPanel() {

    const {
        state,
        dispatch
    } = useEditor();

    //------------------------------------------------------
    // Layout state
    //
    // IMPORTANT:
    //
    // layoutConfirmed only locks the actual floor-plan
    // editing controls.
    //
    // The Blueprint section remains accessible.
    //------------------------------------------------------

    const layoutConfirmed =
        state.layoutConfirmed;

    //------------------------------------------------------
    // Blueprint section open / closed
    //------------------------------------------------------

    const [
        blueprintOpen,
        setBlueprintOpen
    ] = useState(true);

    //------------------------------------------------------
    // Blueprint
    //------------------------------------------------------

    const blueprint =
        state.blueprint;

    //======================================================
    // MEASUREMENT
    //======================================================

    const draftWallLength =
        state.draftWallLength ??
        null;

    const selectedWallId =
        state.selectedWallId ??
        null;

    const selectedRegionId =
        state.selectedRegionId ??
        null;

    const selectedWall =
        selectedWallId
            ? state.walls.find(
                wall =>
                    wall.id ===
                    selectedWallId
            ) ?? null
            : null;

    const selectedWallLength =
        selectedWall
            ? selectedWall.start.position.distanceTo(
                selectedWall.end.position
            )
            : null;

    const selectedRegionArea =
        selectedRegionId
            ? solveRegions(
                state.corners,
                state.walls
            ).find(
                region =>
                    region.id ===
                    selectedRegionId
            )?.area ?? null
            : null;

    let measurementCaption:
        string | null =
        null;

    let measurementValue:
        string | null =
        null;

    let isLive =
        false;

    if (
        draftWallLength !== null
    ) {

        measurementCaption =
            "Drawing Wall";

        measurementValue =
            `${draftWallLength.toFixed(2)} m`;

        isLive =
            true;

    } else if (
        selectedWallLength !== null
    ) {

        measurementCaption =
            "Selected Wall";

        measurementValue =
            `${selectedWallLength.toFixed(2)} m`;

    } else if (
        selectedRegionArea !== null
    ) {

        measurementCaption =
            "Selected Floor";

        measurementValue =
            `${selectedRegionArea.toFixed(2)} m²`;

    }

    //======================================================
    // BLUEPRINT UPLOAD
    //======================================================

    const handleBlueprintUpload = (
        event: ChangeEvent<HTMLInputElement>
    ) => {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        //--------------------------------------------------
        // Only one blueprint is allowed
        //--------------------------------------------------

        if (blueprint) {

            event.target.value =
                "";

            return;
        }

        //--------------------------------------------------
        // Allowed formats
        //--------------------------------------------------

        const validTypes = [
            "image/png",
            "image/jpeg"
        ];

        if (
            !validTypes.includes(
                file.type
            )
        ) {

            window.alert(
                "Please upload a JPG, JPEG, or PNG image."
            );

            event.target.value =
                "";

            return;
        }

        //--------------------------------------------------
        // Temporary browser object URL
        //--------------------------------------------------

        const url =
            URL.createObjectURL(
                file
            );

        //--------------------------------------------------
        // Read image dimensions
        //--------------------------------------------------

        const image =
            new Image();

        image.onload = () => {

            if (
                image.width <= 0 ||
                image.height <= 0
            ) {

                URL.revokeObjectURL(
                    url
                );

                return;
            }

            const aspectRatio =
                image.width /
                image.height;

            dispatch({

                type:
                    "SET_BLUEPRINT",

                payload: {

                    id:
                        "blueprint",

                    name:
                        file.name,

                    url,

                    aspectRatio,

                    //--------------------------------------------------
                    // Initial physical width
                    //--------------------------------------------------

                    width:
                        10,

                    //--------------------------------------------------
                    // Initial position
                    //--------------------------------------------------

                    x:
                        0,

                    z:
                        0,

                    //--------------------------------------------------
                    // Initial rotation
                    //--------------------------------------------------

                    rotationY:
                        0,

                    //--------------------------------------------------
                    // Initial opacity
                    //--------------------------------------------------

                    opacity:
                        0.65,

                    //--------------------------------------------------
                    // Starts unlocked
                    //--------------------------------------------------

                    locked:
                        false,

                    //--------------------------------------------------
                    // Grid snapping
                    //--------------------------------------------------

                    snapEnabled:
                        true,

                    //--------------------------------------------------
                    // Uploading does NOT automatically show it
                    //--------------------------------------------------

                    selected:
                        false

                }

            });
        };

        image.onerror = () => {

            URL.revokeObjectURL(
                url
            );

            window.alert(
                "Unable to read the selected image."
            );
        };

        image.src =
            url;

        //--------------------------------------------------
        // Allow selecting the same file again later
        //--------------------------------------------------

        event.target.value =
            "";
    };

    //======================================================
    // SHOW BLUEPRINT
    //======================================================

    const handleSelectBlueprint = () => {

        if (!blueprint) {
            return;
        }

        dispatch({

            type:
                "SHOW_BLUEPRINT"

        });
    };

    //======================================================
    // HIDE BLUEPRINT FROM SCENE
    //
    // This keeps the uploaded file.
    //======================================================

    const handleHideBlueprint = () => {

        if (!blueprint) {
            return;
        }

        dispatch({

            type:
                "HIDE_BLUEPRINT"

        });
    };

    //======================================================
    // REMOVE UPLOAD
    //
    // This completely deletes the temporary image.
    //======================================================

    const handleRemoveBlueprint = () => {

        if (!blueprint) {
            return;
        }

        const url =
            blueprint.url;

        dispatch({

            type:
                "REMOVE_BLUEPRINT"

        });

        //--------------------------------------------------
        // Release browser memory
        //--------------------------------------------------

        URL.revokeObjectURL(
            url
        );
    };

    //======================================================
    // BLUEPRINT SIZE
    //======================================================

    const handleBlueprintSizeChange = (
        event: ChangeEvent<HTMLInputElement>
    ) => {

        if (!blueprint) {
            return;
        }

        dispatch({

            type:
                "UPDATE_BLUEPRINT",

            payload: {

                width:
                    Number(
                        event.target.value
                    )

            }

        });
    };

    //======================================================
    // BLUEPRINT OPACITY
    //======================================================

    const handleBlueprintOpacityChange = (
        event: ChangeEvent<HTMLInputElement>
    ) => {

        dispatch({

            type:
                "SET_BLUEPRINT_OPACITY",

            payload:
                Number(
                    event.target.value
                )

        });
    };

    //======================================================
    // BLUEPRINT LOCK
    //======================================================

    const handleBlueprintLock = () => {

        if (!blueprint) {
            return;
        }

        dispatch({

            type:
                "SET_BLUEPRINT_LOCKED",

            payload:
                !blueprint.locked

        });
    };

    //======================================================
    // BLUEPRINT SNAP
    //======================================================

    const handleBlueprintSnapToggle = () => {

        if (!blueprint) {
            return;
        }

        dispatch({

            type:
                "UPDATE_BLUEPRINT",

            payload: {

                snapEnabled:
                    !blueprint.snapEnabled

            }

        });
    };

    //======================================================
    // CONFIRM LAYOUT
    //======================================================

    const handleConfirmLayout = () => {

        const confirmed =
            window.confirm(
                "Once you confirm the layout, walls and rooms can no longer be edited.\n\nContinue?"
            );

        if (!confirmed) {
            return;
        }

        dispatch({

            type:
                "CONFIRM_LAYOUT"

        });

        dispatch({

            type:
                "SET_ACTIVE_TOOL",

            payload:
                Tool.None

        });
    };

    //======================================================
    // RENDER
    //======================================================

    return (

        <div className="panel">

            {/* ==================================================
                TOOLS
               ================================================== */}

            <div
                className={
                    `panel-group ${
                        layoutConfirmed
                            ? "panel-group-locked"
                            : ""
                    }`
                }
            >

                <h3>
                    Tools
                </h3>

                <div
                    className="tool-switcher"
                    role="group"
                    aria-label="Drawing tools"
                >

                    {
                        TOOLS.map(
                            ({
                                tool,
                                label,
                                icon: Icon
                            }) => (

                                <button

                                    key={
                                        label
                                    }

                                    type="button"

                                    disabled={
                                        layoutConfirmed
                                    }

                                    className={
                                        `tool-switch-button ${
                                            state.activeTool ===
                                            tool
                                                ? "active"
                                                : ""
                                        }`
                                    }

                                    aria-pressed={
                                        state.activeTool ===
                                        tool
                                    }

                                    onClick={() =>
                                        dispatch({

                                            type:
                                                "SET_ACTIVE_TOOL",

                                            payload:
                                                tool

                                        })
                                    }

                                >

                                    <Icon
                                        size={18}
                                    />

                                    {
                                        label
                                    }

                                </button>

                            )
                        )
                    }

                </div>

            </div>


            {/* ==================================================
                BLUEPRINT
               ================================================== */}

            <div
                className=
                    "panel-group blueprint-panel-group"
            >

                <button

                    type="button"

                    className=
                        "blueprint-section-header"

                    onClick={() =>
                        setBlueprintOpen(
                            value =>
                                !value
                        )
                    }

                    aria-expanded={
                        blueprintOpen
                    }

                >

                    <span>
                        Blueprint
                    </span>

                    <ChevronDown
                        size={16}
                        className={
                            blueprintOpen
                                ? "blueprint-chevron open"
                                : "blueprint-chevron"
                        }
                    />

                </button>


                {
                    blueprintOpen && (

                        <div
                            className=
                                "blueprint-section-content"
                        >

                            {/* ==================================================
                                UPLOAD
                               ================================================== */}

                            {
                                !blueprint && (

                                    <label
                                        className=
                                            "blueprint-upload-button"
                                    >

                                        <Upload
                                            size={15}
                                        />

                                        <span>
                                            Upload Blueprint
                                        </span>

                                        <input

                                            type="file"

                                            accept="
                                                .jpg,
                                                .jpeg,
                                                .png,
                                                image/jpeg,
                                                image/png
                                            "

                                            onChange={
                                                handleBlueprintUpload
                                            }

                                            hidden

                                        />

                                    </label>

                                )
                            }


                            {
                                blueprint && (

                                    <>

                                        {/* ==================================================
                                            FILE
                                           ================================================== */}

                                        <div
                                            className={
                                                blueprint.selected
                                                    ? "blueprint-file selected"
                                                    : "blueprint-file"
                                            }
                                        >

                                            <button

                                                type="button"

                                                className=
                                                    "blueprint-file-main"

                                                onClick={
                                                    handleSelectBlueprint
                                                }

                                                title={
                                                    blueprint.selected
                                                        ? "Blueprint is active"
                                                        : "Show blueprint"
                                                }

                                            >

                                                <div
                                                    className=
                                                        "blueprint-file-thumbnail"
                                                >

                                                    <img

                                                        src={
                                                            blueprint.url
                                                        }

                                                        alt={
                                                            blueprint.name
                                                        }

                                                    />

                                                </div>


                                                <div
                                                    className=
                                                        "blueprint-file-info"
                                                >

                                                    <strong>
                                                        {
                                                            blueprint.name
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            blueprint.selected
                                                                ? "Blueprint active"
                                                                : "Click to show"
                                                        }
                                                    </span>

                                                </div>

                                            </button>


                                            {/* ------------------------------------------
                                                Permanently delete upload
                                               ------------------------------------------ */}

                                            <button

                                                type="button"

                                                className=
                                                    "blueprint-remove-icon"

                                                onClick={
                                                    handleRemoveBlueprint
                                                }

                                                aria-label="Remove uploaded blueprint"

                                                title="Delete uploaded blueprint"

                                            >

                                                <Trash2
                                                    size={15}
                                                />

                                            </button>

                                        </div>


                                        {/* ==================================================
                                            SIZE
                                           ================================================== */}

                                        <div
                                            className=
                                                "blueprint-control"
                                        >

                                            <div
                                                className=
                                                    "blueprint-control-row"
                                            >

                                                <span>
                                                    Size
                                                </span>

                                                <strong>
                                                    {
                                                        blueprint.width.toFixed(
                                                            2
                                                        )
                                                    }
                                                    {" "}
                                                    m
                                                </strong>

                                            </div>


                                            <input

                                                type="range"

                                                min="1"

                                                max="50"

                                                step="0.25"

                                                value={
                                                    blueprint.width
                                                }

                                                onChange={
                                                    handleBlueprintSizeChange
                                                }

                                                disabled={
                                                    blueprint.locked
                                                }

                                            />

                                        </div>


                                        {/* ==================================================
                                            OPACITY + LOCK
                                           ================================================== */}

                                        <div
                                            className=
                                                "blueprint-opacity-control"
                                        >

                                            <div
                                                className=
                                                    "blueprint-opacity-header"
                                            >

                                                <span>
                                                    Opacity
                                                </span>


                                                <div
                                                    className=
                                                        "blueprint-opacity-right"
                                                >

                                                    <strong>
                                                        {
                                                            Math.round(
                                                                blueprint.opacity *
                                                                100
                                                            )
                                                        }%
                                                    </strong>


                                                    <button

                                                        type="button"

                                                        className={
                                                            blueprint.locked
                                                                ? "blueprint-lock-toggle locked"
                                                                : "blueprint-lock-toggle"
                                                        }

                                                        onClick={
                                                            handleBlueprintLock
                                                        }

                                                        aria-label={
                                                            blueprint.locked
                                                                ? "Unlock blueprint"
                                                                : "Lock blueprint"
                                                        }

                                                        title={
                                                            blueprint.locked
                                                                ? "Unlock blueprint"
                                                                : "Lock blueprint"
                                                        }

                                                    >

                                                        {
                                                            blueprint.locked
                                                                ? (
                                                                    <Lock
                                                                        size={13}
                                                                    />
                                                                )
                                                                : (
                                                                    <Unlock
                                                                        size={13}
                                                                    />
                                                                )
                                                        }

                                                    </button>

                                                </div>

                                            </div>


                                            <input

                                                type="range"

                                                min="0.1"

                                                max="1"

                                                step="0.05"

                                                value={
                                                    blueprint.opacity
                                                }

                                                onChange={
                                                    handleBlueprintOpacityChange
                                                }

                                            />

                                        </div>


                                        {/* ==================================================
                                            SNAP
                                           ================================================== */}

                                        <button

                                            type="button"

                                            className={
                                                blueprint.snapEnabled
                                                    ? "blueprint-option active"
                                                    : "blueprint-option"
                                            }

                                            onClick={
                                                handleBlueprintSnapToggle
                                            }

                                            disabled={
                                                blueprint.locked
                                            }

                                        >

                                            {
                                                blueprint.snapEnabled
                                                    ? "Snap: On"
                                                    : "Snap: Off"
                                            }

                                        </button>


                                        {/* ==================================================
                                            REMOVE FROM SCENE
                                           ================================================== */}

                                        <button

                                            type="button"

                                            className=
                                                "blueprint-scene-button"

                                            onClick={
                                                handleHideBlueprint
                                            }

                                            disabled={
                                                !blueprint.selected
                                            }

                                        >

                                            Remove from Scene

                                        </button>

                                    </>

                                )
                            }

                        </div>

                    )
                }

            </div>


            {/* ==================================================
                WALL SETTINGS
               ================================================== */}

            <div
                className={
                    `panel-group ${
                        layoutConfirmed
                            ? "panel-group-locked"
                            : ""
                    }`
                }
            >

                <h3>
                    Wall Settings
                </h3>

                <div className="field-grid">

                    <div className="field">

                        <label
                            htmlFor="wall-height"
                        >
                            Height
                        </label>

                        <div
                            className="field-input"
                        >

                            <input

                                id="wall-height"

                                disabled={
                                    layoutConfirmed
                                }

                                type="number"

                                value={
                                    state.wallHeight
                                }

                                step="0.1"

                                onChange={
                                    e =>
                                        dispatch({

                                            type:
                                                "SET_WALL_HEIGHT",

                                            payload:
                                                Number(
                                                    e.target.value
                                                )

                                        })
                                }

                            />

                            <span
                                className=
                                    "field-unit"
                            >
                                m
                            </span>

                        </div>

                    </div>


                    <div className="field">

                        <label
                            htmlFor="wall-thickness"
                        >
                            Thickness
                        </label>

                        <div
                            className="field-input"
                        >

                            <input

                                id="wall-thickness"

                                disabled={
                                    layoutConfirmed
                                }

                                type="number"

                                value={
                                    state.wallThickness
                                }

                                step="0.05"

                                onChange={
                                    e =>
                                        dispatch({

                                            type:
                                                "SET_WALL_THICKNESS",

                                            payload:
                                                Number(
                                                    e.target.value
                                                )

                                        })
                                }

                            />

                            <span
                                className=
                                    "field-unit"
                            >
                                m
                            </span>

                        </div>

                    </div>

                </div>


                {/* ----------------------------------------------
                    Wall measurements
                   ---------------------------------------------- */}

                <div className="toggle-row">

                    <span
                        className=
                            "toggle-row-label"

                        id=
                            "show-wall-measurements-label"
                    >
                        Show Wall Measurements
                    </span>


                    <button

                        type="button"

                        role="switch"

                        aria-checked={
                            state.showWallMeasurements
                        }

                        aria-labelledby=
                            "show-wall-measurements-label"

                        className={
                            `toggle-switch ${
                                state.showWallMeasurements
                                    ? "on"
                                    : ""
                            }`
                        }

                        onClick={() =>
                            dispatch({

                                type:
                                    "SET_SHOW_WALL_MEASUREMENTS",

                                payload:
                                    !state.showWallMeasurements

                            })
                        }

                        disabled={
                            layoutConfirmed
                        }

                    />

                </div>

            </div>


            {/* ==================================================
                MEASUREMENT
               ================================================== */}

            <div
                className={
                    `panel-group ${
                        layoutConfirmed
                            ? "panel-group-locked"
                            : ""
                    }`
                }
            >

                <h3>
                    Measurement
                </h3>

                {
                    measurementCaption &&
                    measurementValue

                        ? (

                            <div
                                className=
                                    "measurement-row"
                            >

                                <span
                                    className=
                                        "measurement-caption"
                                >

                                    {
                                        isLive && (
                                            <span
                                                className=
                                                    "live-dot"
                                            />
                                        )
                                    }

                                    {
                                        measurementCaption
                                    }

                                </span>

                                <span
                                    className=
                                        "measurement-value"
                                >

                                    {
                                        measurementValue
                                    }

                                </span>

                            </div>

                        )

                        : (

                            <div
                                className=
                                    "measurement-empty"
                            >

                                {
                                    layoutConfirmed
                                        ? "Layout confirmed"
                                        : "Draw a wall or select a wall/floor"
                                }

                            </div>

                        )
                }

            </div>


            {/* ==================================================
                CONFIRM LAYOUT
               ================================================== */}

            {
                !layoutConfirmed && (

                    <button

                        type="button"

                        className=
                            "start-button"

                        onClick={
                            handleConfirmLayout
                        }

                    >

                        Confirm Layout

                    </button>

                )
            }

        </div>
    );
}