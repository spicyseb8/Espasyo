import type {
    EditorState
} from "./types";

import type {
    EditorAction
} from "./editorActions";


export function editorReducer(
    state: EditorState,
    action: EditorAction
): EditorState {

    switch (action.type) {

        //==================================================
        // TAB / TOOL
        //==================================================

        case "SET_ACTIVE_TAB":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,
                activeTab:
                    action.payload
            };


        case "SET_ACTIVE_TOOL":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,
                activeTool:
                    action.payload
            };


        //==================================================
        // WALLS
        //==================================================

        case "ADD_WALL":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,

                walls: [
                    ...state.walls,
                    action.payload
                ]
            };


        case "SET_WALLS":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,
                walls:
                    action.payload
            };


        case "SET_CORNERS":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,
                corners:
                    action.payload
            };


        case "SET_WALL_HEIGHT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,
                wallHeight:
                    action.payload
            };


        case "SET_WALL_THICKNESS":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {
                ...state,
                wallThickness:
                    action.payload
            };


        case "SET_WALL_FINISH": {

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            const {
                regionId,
                wallId,
                materialId
            } = action.payload;


            return {

                ...state,

                wallFinishes: {

                    ...state.wallFinishes,

                    [regionId]: {

                        ...(state.wallFinishes[
                            regionId
                        ] ?? {}),

                        [wallId]:
                            materialId

                    }

                }

            };

        }


        case "REMOVE_WALL":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                walls:
                    state.walls.filter(
                        wall =>
                            wall.id !==
                            action.payload
                    )

            };


        //==================================================
        // CORNERS
        //==================================================

        case "ADD_CORNER":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                state.corners.some(
                    corner =>
                        corner.id ===
                        action.payload.id
                )
            ) {

                return state;

            }


            return {

                ...state,

                corners: [
                    ...state.corners,
                    action.payload
                ]

            };


        case "REMOVE_CORNER":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                corners:
                    state.corners.filter(
                        corner =>
                            corner.id !==
                            action.payload
                    )

            };


        //==================================================
        // SELECTION
        //==================================================

        case "SELECT_OPENING":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                selectedWallId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: action.payload,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: null
            };


        case "SELECT_FURNITURE":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                selectedWallId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: action.payload,
                selectedDoorId: null,
                selectedWindowId: null
            };


        case "SELECT_DOOR":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                selectedWallId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: action.payload,
                selectedWindowId: null
            };


        case "SELECT_WINDOW":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                selectedWallId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: action.payload
            };


        case "CLEAR_SELECTION":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                selectedWallId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: null
            };


        case "SELECT_WALL":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                selectedWallId:
                    action.payload

            };


        case "SELECT_REGION":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                selectedRegionId:
                    action.payload

            };


        case "SELECT_CORNER":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                selectedCornerId:
                    action.payload

            };
            case "SET_MOVING_FURNITURE":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        movingFurnitureId:
            action.payload
    };

        case "SET_SELECTED_ASSET":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                selectedAsset:
                    action.payload

            };


        //==================================================
        // GRID / SNAP
        //==================================================

        case "SET_GRID_SIZE":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                gridSize:
                    action.payload

            };


        case "TOGGLE_SNAP":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                snapEnabled:
                    !state.snapEnabled

            };


        //==================================================
        // FLOOR FINISH
        //==================================================

        case "SET_FLOOR_FINISH":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                floorFinishes: {

                    ...state.floorFinishes,

                    [action.payload.regionId]:
                        action.payload.materialId

                }

            };


        case "SET_FLOOR_FINISH_ALL":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                floorFinishes: {

                    ...Object.keys(
                        state.floorFinishes
                    ).reduce(
                        (
                            result,
                            regionId
                        ) => {

                            result[
                                regionId
                            ] =
                                action.payload;

                            return result;

                        },
                        {} as Record<
                            string,
                            string
                        >
                    )

                }

            };


        //==================================================
        // BUILD TOOL
        //==================================================

        case "SET_BUILD_TOOL":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                buildTool:
                    action.payload

            };


        case "APPLY_SELECTED_ASSET":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.selectedAsset
            ) {
                return state;
            }

            return {

                ...state,

                buildTool:
                    state.selectedAsset.type

            };


        //==================================================
        // LAYOUT
        //==================================================

        case "CONFIRM_LAYOUT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                layoutConfirmed:
                    true,

                activeTab:
                    "build"

            };


        //==================================================
        // DOORS
        //==================================================

        case "ADD_DOOR":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                doors: [
                    ...state.doors,
                    action.payload
                ]

            };
            case "UPDATE_DOOR":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        doors:
            state.doors.map(
                door =>
                    door.id ===
                    action.payload.id

                        ? {
                            ...door,
                            ...action.payload.changes
                        }

                        : door
            )
    };


case "REMOVE_DOOR":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        doors:
            state.doors.filter(
                door =>
                    door.id !==
                    action.payload
            ),

        selectedDoorId:
            state.selectedDoorId ===
            action.payload

                ? null

                : state.selectedDoorId
    };

        case "UPDATE_DOOR":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                doors: state.doors.map(door =>
                    door.id === action.payload.id
                        ? { ...door, ...action.payload.changes }
                        : door
                )
            };


        case "REMOVE_DOOR":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                doors: state.doors.filter(door => door.id !== action.payload),
                selectedDoorId:
                    state.selectedDoorId === action.payload
                        ? null
                        : state.selectedDoorId
            };


        //==================================================
        // WINDOWS
        //==================================================

        case "ADD_WINDOW":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                windows: [
                    ...state.windows,
                    action.payload
                ]

            };
            case "UPDATE_WINDOW":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        windows:
            state.windows.map(
                window =>
                    window.id ===
                    action.payload.id

                        ? {
                            ...window,
                            ...action.payload.changes
                        }

                        : window
            )
    };


case "REMOVE_WINDOW":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        windows:
            state.windows.filter(
                window =>
                    window.id !==
                    action.payload
            ),

        selectedWindowId:
            state.selectedWindowId ===
            action.payload

                ? null

                : state.selectedWindowId
    };

        case "UPDATE_WINDOW":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                windows: state.windows.map(window =>
                    window.id === action.payload.id
                        ? { ...window, ...action.payload.changes }
                        : window
                )
            };


        case "REMOVE_WINDOW":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                windows: state.windows.filter(window => window.id !== action.payload),
                selectedWindowId:
                    state.selectedWindowId === action.payload
                        ? null
                        : state.selectedWindowId
            };


        //==================================================
        // FURNITURE
        //==================================================

        case "ADD_FURNITURE":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                furniture: [
                    ...state.furniture,
                    action.payload
                ]

            };
            case "UPDATE_FURNITURE":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        furniture:
            state.furniture.map(
                furniture =>
                    furniture.id ===
                    action.payload.id

                        ? {
                            ...furniture,
                            ...action.payload.changes
                        }

                        : furniture
            )
    };


case "REMOVE_FURNITURE":

    if (
        state.walkthroughMode
    ) {
        return state;
    }

    return {
        ...state,

        furniture:
            state.furniture.filter(
                furniture =>
                    furniture.id !==
                    action.payload
            ),

        selectedFurnitureId:
            state.selectedFurnitureId ===
            action.payload

                ? null

                : state.selectedFurnitureId,

        movingFurnitureId:
            state.movingFurnitureId ===
            action.payload

                ? null

                : state.movingFurnitureId
    };

        case "UPDATE_FURNITURE":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                furniture: state.furniture.map(item =>
                    item.id === action.payload.id
                        ? { ...item, ...action.payload.changes }
                        : item
                )
            };


        case "REMOVE_FURNITURE":

            if (state.walkthroughMode) {
                return state;
            }

            return {
                ...state,
                furniture: state.furniture.filter(item => item.id !== action.payload),
                selectedFurnitureId:
                    state.selectedFurnitureId === action.payload
                        ? null
                        : state.selectedFurnitureId
            };


        //==================================================
        // OPENINGS
        //==================================================

        case "ADD_OPENING":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                openings: [
                    ...state.openings,
                    action.payload
                ]

            };


        case "SET_OPENING_WIDTH":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                openingWidth:
                    action.payload

            };


        case "SET_OPENING_HEIGHT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                openingHeight:
                    action.payload

            };


        case "SET_ARCH_RISE":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                archRise:
                    action.payload

            };


        //==================================================
        // MEASUREMENTS
        //==================================================

        case "SET_DRAFT_WALL_LENGTH":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                draftWallLength:
                    action.payload

            };


        case "SET_SHOW_WALL_MEASUREMENTS":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                showWallMeasurements:
                    action.payload

            };


        //==================================================
        // BLUEPRINT
        //==================================================

        case "SET_BLUEPRINT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                blueprint:
                    action.payload

            };


        case "REMOVE_BLUEPRINT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                blueprint:
                    null

            };


        case "HIDE_BLUEPRINT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.blueprint
            ) {
                return state;
            }

            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    selected:
                        false

                }

            };


        case "SHOW_BLUEPRINT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.blueprint
            ) {
                return state;
            }

            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    selected:
                        true

                }

            };


        case "UPDATE_BLUEPRINT":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.blueprint
            ) {
                return state;
            }

            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    ...action.payload

                }

            };


        case "SET_BLUEPRINT_LOCKED":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.blueprint
            ) {
                return state;
            }

            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    locked:
                        action.payload

                }

            };


        case "SET_BLUEPRINT_OPACITY":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.blueprint
            ) {
                return state;
            }

            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    opacity:
                        Math.max(
                            0,
                            Math.min(
                                1,
                                action.payload
                            )
                        )

                }

            };


        case "SET_BLUEPRINT_SELECTED":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            if (
                !state.blueprint
            ) {
                return state;
            }

            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    selected:
                        action.payload

                }

            };


        //==================================================
        // BLUEPRINT CALIBRATION MODE
        //==================================================

        case "SET_BLUEPRINT_CALIBRATION_MODE":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                blueprintCalibrationMode:
                    action.payload

            };


        case "SET_BLUEPRINT_CALIBRATION_START":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                blueprintCalibrationStart:
                    action.payload

            };


        case "SET_BLUEPRINT_CALIBRATION_END":

            if (
                state.walkthroughMode
            ) {
                return state;
            }

            return {

                ...state,

                blueprintCalibrationEnd:
                    action.payload

            };


        case "CLEAR_BLUEPRINT_CALIBRATION":

            return {

                ...state,

                blueprintCalibrationMode:
                    false,

                blueprintCalibrationStart:
                    null,

                blueprintCalibrationEnd:
                    null

            };


        //==================================================
        // APPLY BLUEPRINT CALIBRATION
        //
        // action.payload = actual real-world distance
        // entered by the user in meters.
        //==================================================

        case "APPLY_BLUEPRINT_CALIBRATION": {

            if (
                state.walkthroughMode
            ) {
                return state;
            }


            if (
                !state.blueprint
            ) {
                return state;
            }


            const start =
                state.blueprintCalibrationStart;


            const end =
                state.blueprintCalibrationEnd;


            if (
                !start ||
                !end
            ) {

                return state;

            }


            const actualLength =
                Number(
                    action.payload
                );


            if (
                !Number.isFinite(
                    actualLength
                ) ||
                actualLength <= 0
            ) {

                return state;

            }


            const dx =
                end.x -
                start.x;


            const dz =
                end.z -
                start.z;


            const measuredLength =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );


            if (
                measuredLength <=
                0.000001
            ) {

                return state;

            }


            //--------------------------------------------------
            // Calculate scale factor.
            //
            // Example:
            //
            // Blueprint ruler = 2.50 world units
            // Actual dimension = 5.00 m
            //
            // scale = 5 / 2.5 = 2
            //--------------------------------------------------

            const scaleFactor =
                actualLength /
                measuredLength;


            const newWidth =
                state.blueprint.width *
                scaleFactor;


            return {

                ...state,

                blueprint: {

                    ...state.blueprint,

                    width:
                        newWidth,

                    calibrated:
                        true,

                    calibrationReferenceLength:
                        actualLength

                },


                blueprintCalibrationMode:
                    false,

                blueprintCalibrationStart:
                    null,

                blueprintCalibrationEnd:
                    null

            };

        }


        //==================================================
        // WALKTHROUGH
        //==================================================

        case "TOGGLE_WALKTHROUGH": {

            const walkthroughMode =
                !state.walkthroughMode;


            return {

                ...state,

                walkthroughMode,


                //--------------------------------------------------
                // Clear editor selections when entering walkthrough.
                //--------------------------------------------------
                movingFurnitureId:
                      walkthroughMode
                      ? null
                    : state.movingFurnitureId,
                selectedWallId:
                    walkthroughMode
                        ? null
                        : state.selectedWallId,


                selectedCornerId:
                    walkthroughMode
                        ? null
                        : state.selectedCornerId,


                selectedRegionId:
                    walkthroughMode
                        ? null
                        : state.selectedRegionId,


                selectedOpeningId:
                    walkthroughMode
                        ? null
                        : state.selectedOpeningId,


                selectedFurnitureId:
                    walkthroughMode
                        ? null
                        : state.selectedFurnitureId,


                selectedDoorId:
                    walkthroughMode
                        ? null
                        : state.selectedDoorId,


                selectedWindowId:
                    walkthroughMode
                        ? null
                        : state.selectedWindowId,


                selectedAsset:
                    walkthroughMode
                        ? null
                        : state.selectedAsset,


                //--------------------------------------------------
                // Cancel blueprint calibration when entering
                // walkthrough.
                //--------------------------------------------------

                blueprintCalibrationMode:
                    walkthroughMode
                        ? false
                        : state.blueprintCalibrationMode,

                blueprintCalibrationStart:
                    walkthroughMode
                        ? null
                        : state.blueprintCalibrationStart,

                blueprintCalibrationEnd:
                    walkthroughMode
                        ? null
                        : state.blueprintCalibrationEnd

            };

        }


        //==================================================
        // DEFAULT
        //==================================================

        default:

            return state;

    }

}