import type { EditorState } from "./types";
import type { EditorAction } from "./editorActions";
import { Vector3 } from "three";
import { initialState } from "./initialState";
import type { Wall } from "../../engine/walls/WallTypes";
import type { Corner } from "../../engine/walls/Corner";
import type { Door } from "../../engine/doors/DoorTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";
import type { Window } from "../../engine/windows/WindowTypes";
import type { Opening } from "../../engine/openings/OpeningTypes";

export function editorReducer(
    state: EditorState,
    action: EditorAction
): EditorState {
    switch (action.type) {
        case "SET_ACTIVE_TAB":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                activeTab: action.payload
            };
        case "SET_ACTIVE_TOOL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                activeTool: action.payload
            };
        case "ADD_WALL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                walls: [
                    ...state.walls,
                    action.payload
                ]
            };
        case "SET_WALLS":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                walls: action.payload
            };
        case "SET_CORNERS":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                corners: action.payload
            };
        case "SET_WALL_HEIGHT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                wallHeight: action.payload
            };
        case "SET_WALL_THICKNESS":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                wallThickness: action.payload
            };
        case "SET_WALL_FINISH": {
            if (state.walkthroughMode) return state;
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
                        ...(state.wallFinishes[regionId] ?? {}),
                        [wallId]:
                            materialId
                    }
                }
            };
        }
        case "REMOVE_WALL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                walls:
                    state.walls.filter(
                        wall =>
                            wall.id !==
                            action.payload
                    )
            };
        case "ADD_CORNER":
            if (state.walkthroughMode) return state;
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
            if (state.walkthroughMode) return state;
            return {
                ...state,
                corners:
                    state.corners.filter(
                        corner =>
                            corner.id !==
                            action.payload
                    )
            };
        case "SELECT_OPENING":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId:
                    action.payload,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: null
            };
        case "SELECT_FURNITURE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId:
                    action.payload,
                selectedDoorId: null,
                selectedWindowId: null
            };
        case "SELECT_DOOR":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId:
                    action.payload,
                selectedWindowId: null
            };
        case "SELECT_WINDOW":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId:
                    action.payload
            };
        case "CLEAR_SELECTION":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: null
            };
        case "SELECT_WALL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId:
                    action.payload,
                selectedWallRegionId: null
            };
        case "SELECT_WALL_SIDE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId:
                    action.payload.wallId,
                selectedWallRegionId:
                    action.payload.regionId,
                selectedRegionId: null,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: null
            };
        case "SELECT_REGION":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId:
                    action.payload,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedDoorId: null,
                selectedWindowId: null
            };
        case "SELECT_CORNER":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedRegionId: null,
                selectedCornerId:
                    action.payload
            };
        case "SET_MOVING_FURNITURE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                movingFurnitureId:
                    action.payload
            };
        case "SET_SELECTED_ASSET":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedAsset:
                    action.payload
            };
        case "SET_GRID_SIZE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                gridSize:
                    action.payload
            };
        case "TOGGLE_SNAP":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                snapEnabled:
                    !state.snapEnabled
            };
        case "SET_ACTIVE_FLOOR_MATERIAL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                activeFloorMaterialId:
                    action.payload
            };
        case "SET_ACTIVE_WALL_MATERIAL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                activeWallMaterialId:
                    action.payload
            };
        case "SET_FLOOR_FINISH":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                floorFinishes: {
                    ...state.floorFinishes,
                    [action.payload.regionId]:
                        action.payload.materialId
                }
            };
        case "SET_FLOOR_FINISH_ALL":
            if (state.walkthroughMode) return state;
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
                            result[regionId] =
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
        case "SET_BUILD_TOOL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                buildTool:
                    action.payload
            };
        case "APPLY_SELECTED_ASSET":
            if (state.walkthroughMode) return state;
            if (!state.selectedAsset) return state;
            return {
                ...state,
                buildTool:
                    state.selectedAsset.type
            };
        case "CONFIRM_LAYOUT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                layoutConfirmed: true,
                activeTab: "build"
            };
        case "ADD_DOOR":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                doors: [
                    ...state.doors,
                    action.payload
                ]
            };
        case "UPDATE_DOOR":
            if (state.walkthroughMode) return state;
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
            if (state.walkthroughMode) return state;
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
        case "ADD_WINDOW":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                windows: [
                    ...state.windows,
                    action.payload
                ]
            };
        case "UPDATE_WINDOW":
            if (state.walkthroughMode) return state;
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
            if (state.walkthroughMode) return state;
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
        case "ADD_FURNITURE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                furniture: [
                    ...state.furniture,
                    action.payload
                ]
            };
        case "UPDATE_FURNITURE":
            if (state.walkthroughMode) return state;
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
            if (state.walkthroughMode) return state;
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
        case "ADD_OPENING":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                openings: [
                    ...state.openings,
                    action.payload
                ]
            };
        case "SET_OPENING_WIDTH":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                openingWidth:
                    action.payload
            };
        case "SET_OPENING_HEIGHT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                openingHeight:
                    action.payload
            };
        case "SET_ARCH_RISE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                archRise:
                    action.payload
            };
        case "SET_DRAFT_WALL_LENGTH":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                draftWallLength:
                    action.payload
            };
        case "SET_SHOW_WALL_MEASUREMENTS":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                showWallMeasurements:
                    action.payload
            };
        case "SET_BLUEPRINT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                blueprint:
                    action.payload
            };
        case "REMOVE_BLUEPRINT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                blueprint: null
            };
        case "HIDE_BLUEPRINT":
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
            return {
                ...state,
                blueprint: {
                    ...state.blueprint,
                    selected: false
                }
            };
        case "SHOW_BLUEPRINT":
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
            return {
                ...state,
                blueprint: {
                    ...state.blueprint,
                    selected: true
                }
            };
        case "UPDATE_BLUEPRINT":
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
            return {
                ...state,
                blueprint: {
                    ...state.blueprint,
                    ...action.payload
                }
            };
        case "SET_BLUEPRINT_LOCKED":
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
            return {
                ...state,
                blueprint: {
                    ...state.blueprint,
                    locked:
                        action.payload
                }
            };
        case "SET_BLUEPRINT_OPACITY":
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
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
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
            return {
                ...state,
                blueprint: {
                    ...state.blueprint,
                    selected:
                        action.payload
                }
            };
        case "SET_BLUEPRINT_CALIBRATION_MODE":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                blueprintCalibrationMode:
                    action.payload
            };
        case "SET_BLUEPRINT_CALIBRATION_START":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                blueprintCalibrationStart:
                    action.payload
            };
        case "SET_BLUEPRINT_CALIBRATION_END":
            if (state.walkthroughMode) return state;
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
        case "APPLY_BLUEPRINT_CALIBRATION": {
            if (state.walkthroughMode) return state;
            if (!state.blueprint) return state;
            const start =
                state.blueprintCalibrationStart;
            const end =
                state.blueprintCalibrationEnd;
            if (!start || !end) return state;
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
        case "TOGGLE_WALKTHROUGH": {
            const walkthroughMode =
                !state.walkthroughMode;
            return {
                ...state,
                walkthroughMode,
                movingFurnitureId:
                    walkthroughMode
                        ? null
                        : state.movingFurnitureId,
                selectedWallId:
                    walkthroughMode
                        ? null
                        : state.selectedWallId,
                selectedWallRegionId:
                    walkthroughMode
                        ? null
                        : state.selectedWallRegionId,
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
                activeFloorMaterialId:
                    walkthroughMode
                        ? null
                        : state.activeFloorMaterialId,
                activeWallMaterialId:
                    walkthroughMode
                        ? null
                        : state.activeWallMaterialId,
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
        case "LOAD_PROJECT": {
            if (state.walkthroughMode) return state;

            const project =
                action.payload;

            const cornersById =
                new Map<
                    string,
                    Corner
                >();

            const restoredCorners:
                Corner[] =
                [];

            for (
                const savedCorner
                of project.corners
            ) {
                const corner:
                    Corner = {
                    id:
                        savedCorner.id,
                    position:
                        new Vector3(
                            savedCorner.position.x,
                            savedCorner.position.y,
                            savedCorner.position.z
                        )
                };

                cornersById.set(
                    corner.id,
                    corner
                );

                restoredCorners.push(
                    corner
                );
            }

            const restoredWalls:
                Wall[] =
                [];

            for (
                const savedWall
                of project.walls
            ) {
                let startCorner =
                    cornersById.get(
                        savedWall.start.id
                    );

                let endCorner =
                    cornersById.get(
                        savedWall.end.id
                    );

                if (
                    !startCorner
                ) {
                    startCorner = {
                        id:
                            savedWall.start.id,
                        position:
                            new Vector3(
                                savedWall.start.position.x,
                                savedWall.start.position.y,
                                savedWall.start.position.z
                            )
                    };

                    cornersById.set(
                        startCorner.id,
                        startCorner
                    );

                    restoredCorners.push(
                        startCorner
                    );
                }

                if (
                    !endCorner
                ) {
                    endCorner = {
                        id:
                            savedWall.end.id,
                        position:
                            new Vector3(
                                savedWall.end.position.x,
                                savedWall.end.position.y,
                                savedWall.end.position.z
                            )
                    };

                    cornersById.set(
                        endCorner.id,
                        endCorner
                    );

                    restoredCorners.push(
                        endCorner
                    );
                }

                restoredWalls.push({
                    id:
                        savedWall.id,
                    start:
                        startCorner,
                    end:
                        endCorner
                });
            }

            const restoredDoors:
                Door[] =
                project.doors.map(
                    savedDoor => ({
                        id:
                            savedDoor.id,
                        assetId:
                            savedDoor.assetId,
                        wallId:
                            savedDoor.wallId,
                        position:
                            new Vector3(
                                savedDoor.position.x,
                                savedDoor.position.y,
                                savedDoor.position.z
                            ),
                        rotationY:
                            savedDoor.rotationY,
                        width:
                            savedDoor.width,
                        height:
                            savedDoor.height,
                        depth:
                            savedDoor.depth
                    })
                );

            const restoredWindows:
                Window[] =
                project.windows.map(
                    savedWindow => ({
                        id:
                            savedWindow.id,
                        assetId:
                            savedWindow.assetId,
                        wallId:
                            savedWindow.wallId,
                        position:
                            new Vector3(
                                savedWindow.position.x,
                                savedWindow.position.y,
                                savedWindow.position.z
                            ),
                        rotationY:
                            savedWindow.rotationY,
                        width:
                            savedWindow.width,
                        height:
                            savedWindow.height,
                        depth:
                            savedWindow.depth
                    })
                );

            const restoredFurniture:
                Furniture[] =
                project.furniture.map(
                    savedFurniture => ({
                        id:
                            savedFurniture.id,
                        assetId:
                            savedFurniture.assetId,
                        position:
                            new Vector3(
                                savedFurniture.position.x,
                                savedFurniture.position.y,
                                savedFurniture.position.z
                            ),
                        rotationY:
                            savedFurniture.rotationY,
                        modelOffset:
                            new Vector3(
                                savedFurniture.modelOffset.x,
                                savedFurniture.modelOffset.y,
                                savedFurniture.modelOffset.z
                            ),
                        width:
                            savedFurniture.width,
                        depth:
                            savedFurniture.depth,
                        height:
                            savedFurniture.height
                    })
                );

            const restoredOpenings:
                Opening[] =
                project.openings.map(
                    savedOpening => ({
                        id:
                            savedOpening.id,
                        wallId:
                            savedOpening.wallId,
                        shape:
                            savedOpening.shape,
                        position:
                            new Vector3(
                                savedOpening.position.x,
                                savedOpening.position.y,
                                savedOpening.position.z
                            ),
                        width:
                            savedOpening.width,
                        height:
                            savedOpening.height,
                        depth:
                            savedOpening.depth,
                        archRise:
                            savedOpening.archRise
                    })
                );

            return {
                ...initialState,
                walls:
                    restoredWalls,
                corners:
                    restoredCorners,
                doors:
                    restoredDoors,
                windows:
                    restoredWindows,
                furniture:
                    restoredFurniture,
                openings:
                    restoredOpenings,
                wallHeight:
                    project.wallHeight,
                wallThickness:
                    project.wallThickness,
                gridSize:
                    project.gridSize,
                snapEnabled:
                    project.snapEnabled,
                layoutConfirmed:
                    project.layoutConfirmed,
                floorFinishes: {
                    ...project.floorFinishes
                },
                wallFinishes:
                    Object.fromEntries(
                        Object.entries(
                            project.wallFinishes
                        ).map(
                            (
                                [
                                    regionId,
                                    walls
                                ]
                            ) => [
                                regionId,
                                {
                                    ...walls
                                }
                            ]
                        )
                    ),
                archRise:
                    project.archRise,
                openingWidth:
                    project.openingWidth,
                openingHeight:
                    project.openingHeight,
                blueprint:
                    project.blueprint
                        ? {
                            ...project.blueprint
                        }
                        : null,
                activeTab:
                    project.layoutConfirmed
                        ? "build"
                        : "floorplan"
            };
        }
        default:
            return state;
    }
}