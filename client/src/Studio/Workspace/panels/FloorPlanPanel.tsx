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
    useEffect,
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
// BLUEPRINT EVENTS
//==========================================================

const START_CALIBRATION_EVENT =
    "espasyo-start-blueprint-calibration";

const CANCEL_CALIBRATION_EVENT =
    "espasyo-cancel-blueprint-calibration";

const CALIBRATION_POINT_EVENT =
    "espasyo-blueprint-calibration-point";

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

    //------------------------------------------------------
    // Blueprint calibration state
    //
    // The calibration interface lives ONLY in this panel.
    //------------------------------------------------------

    const [
        calibrationStep,
        setCalibrationStep
    ] = useState<
        "idle" |
        "first-point" |
        "second-point" |
        "enter-measurement"
    >("idle");

    const [
        measuredBlueprintLength,
        setMeasuredBlueprintLength
    ] = useState<number | null>(
        null
    );

    const [
        actualBlueprintLength,
        setActualBlueprintLength
    ] = useState("");

    const [
        calibrationReference,
        setCalibrationReference
    ] = useState<number | null>(
        null
    );

    //------------------------------------------------------
    // Listen for calibration clicks from BlueprintScene.
    //------------------------------------------------------

    useEffect(() => {

        function handleCalibrationPoint(
            event: Event
        ) {

            const customEvent =
                event as CustomEvent<{
                    type:
                        | "started"
                        | "first-point"
                        | "second-point";

                    measuredLength?:
                        number;
                }>;

            const detail =
                customEvent.detail;

            if (!detail) {
                return;
            }

            if (
                detail.type ===
                "started"
            ) {

                setCalibrationStep(
                    "first-point"
                );

                setMeasuredBlueprintLength(
                    null
                );

                setActualBlueprintLength(
                    ""
                );

                return;
            }

            if (
                detail.type ===
                "first-point"
            ) {

                setCalibrationStep(
                    "second-point"
                );

                return;
            }

            if (
                detail.type ===
                "second-point"
            ) {

                const measured =
                    detail.measuredLength ??
                    0;

                setMeasuredBlueprintLength(
                    measured
                );

                setCalibrationStep(
                    "enter-measurement"
                );
            }
        }

        window.addEventListener(
            CALIBRATION_POINT_EVENT,
            handleCalibrationPoint
        );

        return () => {

            window.removeEventListener(
                CALIBRATION_POINT_EVENT,
                handleCalibrationPoint
            );
        };

    }, []);

    //------------------------------------------------------
    // Reset calibration whenever blueprint is removed.
    //------------------------------------------------------

    useEffect(() => {

        if (!blueprint) {

            setCalibrationStep(
                "idle"
            );

            setMeasuredBlueprintLength(
                null
            );

            setActualBlueprintLength(
                ""
            );
        }

    }, [
        blueprint
    ]);

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
                    calibrated: false,

                    calibrationReferenceLength: null,
                    
                    selected:
                        false
                }
            });

            setCalibrationStep(
                "idle"
            );

            setMeasuredBlueprintLength(
                null
            );

            setActualBlueprintLength(
                ""
            );

            setCalibrationReference(
                null
            );
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

        //--------------------------------------------------
        // Cancel calibration before hiding.
        //--------------------------------------------------

        window.dispatchEvent(
            new Event(
                CANCEL_CALIBRATION_EVENT
            )
        );

        setCalibrationStep(
            "idle"
        );

        setMeasuredBlueprintLength(
            null
        );

        setActualBlueprintLength(
            ""
        );

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

        window.dispatchEvent(
            new Event(
                CANCEL_CALIBRATION_EVENT
            )
        );

        setCalibrationStep(
            "idle"
        );

        setMeasuredBlueprintLength(
            null
        );

        setActualBlueprintLength(
            ""
        );

        setCalibrationReference(
            null
        );

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
    // START BLUEPRINT CALIBRATION
    //======================================================

    const handleStartCalibration = () => {

        if (!blueprint) {
            return;
        }

        if (blueprint.locked) {
            return;
        }

        //--------------------------------------------------
        // Make the blueprint visible first.
        //--------------------------------------------------

        if (!blueprint.selected) {

            dispatch({
                type:
                    "SHOW_BLUEPRINT"
            });
        }

        setCalibrationStep(
            "first-point"
        );

        setMeasuredBlueprintLength(
            null
        );

        setActualBlueprintLength(
            ""
        );

        //--------------------------------------------------
        // Tell BlueprintScene to enter calibration mode.
        //--------------------------------------------------

        window.dispatchEvent(
            new Event(
                START_CALIBRATION_EVENT
            )
        );
    };

    //======================================================
    // CANCEL BLUEPRINT CALIBRATION
    //======================================================

    const handleCancelCalibration = () => {

        window.dispatchEvent(
            new Event(
                CANCEL_CALIBRATION_EVENT
            )
        );

        setCalibrationStep(
            "idle"
        );

        setMeasuredBlueprintLength(
            null
        );

        setActualBlueprintLength(
            ""
        );
    };

    //======================================================
    // APPLY BLUEPRINT CALIBRATION
    //======================================================

    const handleApplyCalibration = () => {

        if (!blueprint) {
            return;
        }

        if (
            measuredBlueprintLength === null ||
            measuredBlueprintLength <= 0
        ) {

            window.alert(
                "Please select two different points on the blueprint first."
            );

            return;
        }

        const actualLength =
            Number(
                actualBlueprintLength
            );

        if (
            !Number.isFinite(
                actualLength
            ) ||
            actualLength <= 0
        ) {

            window.alert(
                "Please enter a valid actual measurement greater than 0."
            );

            return;
        }

        //--------------------------------------------------
        // Uniform scaling
        //
        // newWidth =
        // currentWidth *
        // actualLength /
        // measuredLength
        //--------------------------------------------------

        const scaleFactor =
            actualLength /
            measuredBlueprintLength;

        const newWidth =
            blueprint.width *
            scaleFactor;

        if (
            !Number.isFinite(
                newWidth
            ) ||
            newWidth <= 0
        ) {

            window.alert(
                "Unable to calculate the blueprint size."
            );

            return;
        }

        dispatch({
            type:
                "UPDATE_BLUEPRINT",

            payload: {
                width:
                    newWidth
            }
        });

        setCalibrationReference(
            actualLength
        );

        setCalibrationStep(
            "idle"
        );

        setMeasuredBlueprintLength(
            null
        );

        setActualBlueprintLength(
            ""
        );

        window.dispatchEvent(
            new Event(
                CANCEL_CALIBRATION_EVENT
            )
        );
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

        //--------------------------------------------------
        // Do not leave calibration active while locking.
        //--------------------------------------------------

        if (!blueprint.locked) {

            handleCancelCalibration();
        }

        dispatch({
            type:
                "SET_BLUEPRINT_LOCKED",

            payload:
                !blueprint.locked
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
    // CALIBRATION TEXT
    //======================================================

    const getCalibrationInstruction = () => {

        if (
            calibrationStep ===
            "first-point"
        ) {

            return (
                "Click the first point of a known dimension on the blueprint."
            );
        }

        if (
            calibrationStep ===
            "second-point"
        ) {

            return (
                "First point selected. Click the second point of the same dimension."
            );
        }

        if (
            calibrationStep ===
            "enter-measurement"
        ) {

            return (
                "Enter the real-world measurement of the selected distance."
            );
        }

        return "";
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
                                            CALIBRATION
                                           ================================================== */}

                                        <div
                                            className="blueprint-calibration-control"
                                            style={{
                                                marginTop:
                                                    "10px",
                                                padding:
                                                    "10px",
                                                border:
                                                    "1px solid rgba(0,0,0,0.10)",
                                                borderRadius:
                                                    "8px"
                                            }}
                                        >

                                            <div
                                                className="blueprint-control-row"
                                            >

                                                <span>
                                                    Calibration
                                                </span>

                                                {
                                                    calibrationReference !== null
                                                        ? (
                                                            <strong>
                                                                Calibrated
                                                            </strong>
                                                        )
                                                        : (
                                                            <strong>
                                                                Not calibrated
                                                            </strong>
                                                        )
                                                }

                                            </div>

                                            {
                                                calibrationReference !== null && (

                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "12px",
                                                            marginTop:
                                                                "4px",
                                                            opacity:
                                                                0.7
                                                        }}
                                                    >
                                                        Reference:{" "}
                                                        {
                                                            calibrationReference.toFixed(
                                                                2
                                                            )
                                                        }{" "}
                                                        m
                                                    </div>
                                                )
                                            }

                                            {
                                                calibrationStep ===
                                                "idle"
                                                    ? (

                                                        <button
                                                            type="button"

                                                            className="blueprint-scene-button"

                                                            onClick={
                                                                handleStartCalibration
                                                            }

                                                            disabled={
                                                                blueprint.locked
                                                            }

                                                            style={{
                                                                width:
                                                                    "100%",
                                                                marginTop:
                                                                    "8px"
                                                            }}
                                                        >
                                                            {
                                                                calibrationReference !==
                                                                null
                                                                    ? "Recalibrate Blueprint"
                                                                    : "Calibrate Blueprint"
                                                            }
                                                        </button>

                                                    )
                                                    : (

                                                        <>

                                                            <div
                                                                style={{
                                                                    fontSize:
                                                                        "12px",
                                                                    lineHeight:
                                                                        1.45,
                                                                    marginTop:
                                                                        "8px"
                                                                }}
                                                            >
                                                                {
                                                                    getCalibrationInstruction()
                                                                }
                                                            </div>

                                                            {
                                                                calibrationStep ===
                                                                "enter-measurement" &&
                                                                measuredBlueprintLength !==
                                                                null && (

                                                                    <div
                                                                        style={{
                                                                            marginTop:
                                                                                "10px"
                                                                        }}
                                                                    >

                                                                        <div
                                                                            style={{
                                                                                fontSize:
                                                                                    "12px",
                                                                                marginBottom:
                                                                                    "5px"
                                                                            }}
                                                                        >
                                                                            Measured distance:{" "}
                                                                            <strong>
                                                                                {
                                                                                    measuredBlueprintLength.toFixed(
                                                                                        2
                                                                                    )
                                                                                }{" "}
                                                                                m
                                                                            </strong>
                                                                        </div>

                                                                        <div
                                                                            className="field-input"
                                                                        >

                                                                            <input
                                                                                type="number"

                                                                                min="0.01"

                                                                                step="0.01"

                                                                                placeholder="e.g. 5.00"

                                                                                value={
                                                                                    actualBlueprintLength
                                                                                }

                                                                                onChange={
                                                                                    e =>
                                                                                        setActualBlueprintLength(
                                                                                            e.target.value
                                                                                        )
                                                                                }

                                                                                autoFocus
                                                                            />

                                                                            <span
                                                                                className="field-unit"
                                                                            >
                                                                                m
                                                                            </span>

                                                                        </div>

                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                gap:
                                                                                    "6px",
                                                                                marginTop:
                                                                                    "8px"
                                                                            }}
                                                                        >

                                                                            <button
                                                                                type="button"

                                                                                className="blueprint-scene-button"

                                                                                onClick={
                                                                                    handleApplyCalibration
                                                                                }

                                                                                style={{
                                                                                    flex:
                                                                                        1
                                                                                }}
                                                                            >
                                                                                Apply Calibration
                                                                            </button>

                                                                            <button
                                                                                type="button"

                                                                                className="blueprint-scene-button"

                                                                                onClick={
                                                                                    handleCancelCalibration
                                                                                }

                                                                                style={{
                                                                                    flex:
                                                                                        1
                                                                                }}
                                                                            >
                                                                                Cancel
                                                                            </button>

                                                                        </div>

                                                                    </div>
                                                                )
                                                            }

                                                            {
                                                                calibrationStep !==
                                                                "enter-measurement" && (

                                                                    <button
                                                                        type="button"

                                                                        className="blueprint-scene-button"

                                                                        onClick={
                                                                            handleCancelCalibration
                                                                        }

                                                                        style={{
                                                                            width:
                                                                                "100%",
                                                                            marginTop:
                                                                                "8px"
                                                                        }}
                                                                    >
                                                                        Cancel Calibration
                                                                    </button>

                                                                )
                                                            }

                                                        </>
                                                    )
                                            }

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
                                            SHOW / HIDE
                                           ================================================== */}

                                        <button
                                            type="button"

                                            className="blueprint-scene-button"

                                            onClick={
                                                blueprint.selected
                                                    ? handleHideBlueprint
                                                    : handleSelectBlueprint
                                            }
                                        >
                                            {
                                                blueprint.selected
                                                    ? "Hide Blueprint"
                                                    : "Show Blueprint"
                                            }
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
