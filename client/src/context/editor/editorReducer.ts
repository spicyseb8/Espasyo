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
import type { SavedProjectData, SavedProjectFloor } from "./ProjectTypes";
import type { EditorFloorData } from "./types";
import { getStaircaseFloorData } from "./staircaseData.ts";
import { isValidProjectBudget } from "../../engine/cost/ProjectBudget";
import { BuildTool } from "../BuildTool";
import {
    getWallFinishSideKey,
    WALL_SIDE_FINISH_BUCKET
} from "../../engine/walls/WallFinishUtils";
import {
    getWallPaintFaceKey,
    getWallPaintSections
} from "../../../../shared/wallPaintSeparators";
import { Tool } from "./tools";
function reduceEditorAction(
    state: EditorState,
    action: EditorAction
): EditorState {
    const allowedWhileLocked = action.type === "SET_PROJECT_LOCKED" ||
        action.type === "SWITCH_FLOOR" ||
        action.type === "LOAD_PROJECT" ||
        action.type === "SET_ACTIVE_TAB" ||
        action.type === "SET_ACTIVE_TOOL" ||
        action.type === "CLEAR_SELECTION" ||
        action.type === "TOGGLE_WALKTHROUGH" ||
        action.type.startsWith("SELECT_");
    if (state.projectLocked && !allowedWhileLocked) return state;

    switch (action.type) {
        case "SET_PROJECT_LOCKED":
            return {
                ...state,
                projectLocked: action.payload
            };
        case "SWITCH_FLOOR": {
            const floors = state.projectLocked
                ? state.floors
                : captureActiveFloor(state).floors;
            const nextFloor = floors.find(floor => floor.floorId === action.payload);
            if (!nextFloor || nextFloor.floorId === state.activeFloorId) return state;
            return showFloor({ ...state, floors }, nextFloor);
        }
        case "SET_PROJECT_BUDGET":
            if (action.payload !== null && !isValidProjectBudget(action.payload)) {
                return state;
            }
            return {
                ...state,
                projectBudget: action.payload
            };
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
                activeTool: action.payload === Tool.Wall ||
                    action.payload === Tool.Room
                    ? Tool.None
                    : action.payload,
                activeFloorMaterialId: null,
                activeWallMaterialId: null
            };
        case "ADD_WALL":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                walls: [
                    ...state.walls,
                    action.payload
                ]
            };
        case "SET_WALLS":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                walls: action.payload
            };
        case "SET_CORNERS":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                corners: action.payload
            };
        case "SET_WALL_HEIGHT":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                wallHeight: action.payload
            };
        case "SET_WALL_THICKNESS":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                wallThickness: action.payload
            };
        case "SET_WALL_FINISH": {
            if (state.walkthroughMode) return state;

            const {
                regionId,
                wallId,
                materialId,
                side
            } = action.payload;

            if (side !== undefined) {
                const sideKey = getWallFinishSideKey(wallId, side);
                const faceKey = getWallPaintFaceKey(wallId, side);
                const face = state.wallPaintSeparators[faceKey];

                return {
                    ...state,
                    wallFinishes: {
                        ...state.wallFinishes,
                        [WALL_SIDE_FINISH_BUCKET]: {
                            ...(state.wallFinishes[WALL_SIDE_FINISH_BUCKET] ?? {}),
                            [sideKey]: materialId
                        }
                    },
                    wallPaintSeparators: face
                        ? {
                            ...state.wallPaintSeparators,
                            [faceKey]: {
                                ...face,
                                sectionMaterials: Object.fromEntries(
                                    getWallPaintSections(face).map(section => [
                                        section.id,
                                        materialId
                                    ])
                                )
                            }
                        }
                        : state.wallPaintSeparators
                };
            }

            if (!regionId) return state;

            return {
                ...state,
                wallFinishes: {
                    ...state.wallFinishes,
                    [regionId]: {
                        ...(state.wallFinishes[regionId] ?? {}),
                        [wallId]: materialId
                    }
                }
            };
        }
        case "SET_WALL_FINISHES": {
            if (state.walkthroughMode) return state;
            if (action.payload.length === 0) return state;

            const sideFinishes = {
                ...(state.wallFinishes[WALL_SIDE_FINISH_BUCKET] ?? {})
            };
            const wallPaintSeparators = {
                ...state.wallPaintSeparators
            };

            for (const finish of action.payload) {
                sideFinishes[
                    getWallFinishSideKey(finish.wallId, finish.side)
                ] = finish.materialId;
                const faceKey = getWallPaintFaceKey(finish.wallId, finish.side);
                const face = wallPaintSeparators[faceKey];
                if (face) {
                    wallPaintSeparators[faceKey] = {
                        ...face,
                        sectionMaterials: Object.fromEntries(
                            getWallPaintSections(face).map(section => [
                                section.id,
                                finish.materialId
                            ])
                        )
                    };
                }
            }

            return {
                ...state,
                wallFinishes: {
                    ...state.wallFinishes,
                    [WALL_SIDE_FINISH_BUCKET]: sideFinishes
                },
                wallPaintSeparators
            };
        }
        case "SET_WALL_PAINT_FACE": {
            if (state.walkthroughMode) return state;
            const wallPaintSeparators = { ...state.wallPaintSeparators };
            if (action.payload.face === null) {
                delete wallPaintSeparators[action.payload.faceKey];
            } else {
                wallPaintSeparators[action.payload.faceKey] = action.payload.face;
            }
            const selectedFaceKey = state.selectedWallId &&
                state.selectedWallSide !== null
                ? getWallPaintFaceKey(
                    state.selectedWallId,
                    state.selectedWallSide
                )
                : null;
            return {
                ...state,
                wallPaintSeparators,
                ...(selectedFaceKey === action.payload.faceKey
                    ? {
                        selectedWallSectionId: null,
                        selectedWallSeparatorId: null
                    }
                    : {})
            };
        }
        case "SET_WALL_SECTION_MATERIAL": {
            if (state.walkthroughMode) return state;
            const face = state.wallPaintSeparators[action.payload.faceKey];
            if (!face || !getWallPaintSections(face).some(
                section => section.id === action.payload.sectionId
            )) {
                return state;
            }
            return {
                ...state,
                wallPaintSeparators: {
                    ...state.wallPaintSeparators,
                    [action.payload.faceKey]: {
                        ...face,
                        sectionMaterials: {
                            ...face.sectionMaterials,
                            [action.payload.sectionId]: action.payload.materialId
                        }
                    }
                }
            };
        }
        case "REMOVE_WALL":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
                selectedWallSide: null,
                selectedWallSectionId: null,
                selectedWallSeparatorId: null,
                selectedFloorSectionId: null,
                selectedFloorSeparatorId: null,
                wallSeparatorPlacement: null,
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
                selectedWallSide: null,
                selectedWallRegionId: null,
                selectedWallSectionId: null,
                selectedWallSeparatorId: null,
                selectedFloorSectionId: null,
                selectedFloorSeparatorId: null
            };
        case "SELECT_WALL_SECTION": {
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: action.payload.wallId,
                selectedWallSide: action.payload.side,
                selectedWallRegionId: action.payload.regionId ?? null,
                selectedWallSectionId: action.payload.sectionId,
                selectedWallSeparatorId: null,
                selectedFloorSectionId: null,
                selectedFloorSeparatorId: null
            };
        }
        case "SELECT_WALL_SEPARATOR":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedWallId: action.payload.wallId,
                selectedWallSide: action.payload.side,
                selectedWallRegionId: action.payload.regionId ?? null,
                selectedWallSectionId: null,
                selectedWallSeparatorId: action.payload.separatorId,
                selectedFloorSectionId: null,
                selectedFloorSeparatorId: null
            };
        case "SELECT_FLOOR_SECTION": {
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedRegionId: action.payload.regionId,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedWallSide: null,
                selectedWallSectionId: null,
                selectedWallSeparatorId: null,
                selectedFloorSectionId: action.payload.sectionId,
                selectedFloorSeparatorId: null
            };
        }
        case "SELECT_FLOOR_SEPARATOR":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                selectedRegionId: action.payload.regionId,
                selectedWallId: null,
                selectedWallRegionId: null,
                selectedWallSide: null,
                selectedWallSectionId: null,
                selectedWallSeparatorId: null,
                selectedFloorSectionId: null,
                selectedFloorSeparatorId: action.payload.separatorId
            };
        case "SET_WALL_SEPARATOR_PLACEMENT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                wallSeparatorPlacement: action.payload,
                wallSeparatorPlacementVersion: action.payload
                    ? state.wallSeparatorPlacementVersion + 1
                    : state.wallSeparatorPlacementVersion,
                selectedWallSeparatorId: null,
                ...(action.payload
                    ? {
                        activeFloorMaterialId: null,
                        activeWallMaterialId: null
                    }
                    : {})
            };
       case "SELECT_WALL_SIDE":
    if (state.walkthroughMode) return state;

    return {
        ...state,
        selectedWallId: action.payload.wallId,
        selectedWallRegionId: action.payload.regionId,
        selectedWallSide: action.payload.side,
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
                selectedWallSectionId: null,
                selectedWallSeparatorId: null,
                selectedFloorSectionId: null,
                selectedFloorSeparatorId: null,
                wallSeparatorPlacement: null,
                selectedRegionId:
                    action.payload,
                selectedCornerId: null,
                selectedOpeningId: null,
                selectedFurnitureId: null,
                selectedWallSide: null,
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
                selectedAsset: action.payload,
                ...(action.payload
                    ? {
                        activeFloorMaterialId: null,
                        activeWallMaterialId: null
                    }
                    : {})
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
                activeFloorMaterialId: action.payload,
                activeWallMaterialId: null,
                ...(action.payload
                    ? {
                        activeTool: Tool.None,
                        buildTool: BuildTool.None,
                        selectedAsset: null,
                        wallSeparatorPlacement: null,
                        selectedWallSeparatorId: null
                    }
                    : {})
            };
        case "SET_ACTIVE_WALL_MATERIAL":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                activeWallMaterialId: action.payload,
                activeFloorMaterialId: null,
                ...(action.payload
                    ? {
                        activeTool: Tool.None,
                        buildTool: BuildTool.None,
                        selectedAsset: null,
                        wallSeparatorPlacement: null,
                        selectedWallSeparatorId: null
                    }
                    : {})
            };
        case "SET_FLOOR_FINISH":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                floorFinishes: {
                    ...state.floorFinishes,
                    [action.payload.regionId]:
                        action.payload.materialId
                },
                floorPaintSeparators: state.floorPaintSeparators[action.payload.regionId]
                    ? {
                        ...state.floorPaintSeparators,
                        [action.payload.regionId]: {
                            ...state.floorPaintSeparators[action.payload.regionId],
                            sectionMaterials: Object.fromEntries(
                                getWallPaintSections(
                                    state.floorPaintSeparators[action.payload.regionId]
                                ).map(section => [
                                    section.id,
                                    action.payload.materialId
                                ])
                            )
                        }
                    }
                    : state.floorPaintSeparators
            };
        case "SET_FLOOR_PAINT_FACE": {
            if (state.walkthroughMode) return state;
            const floorPaintSeparators = { ...state.floorPaintSeparators };
            if (action.payload.face === null) {
                delete floorPaintSeparators[action.payload.regionId];
            } else {
                floorPaintSeparators[action.payload.regionId] = action.payload.face;
            }
            return {
                ...state,
                floorPaintSeparators,
                ...(state.selectedRegionId === action.payload.regionId
                    ? {
                        selectedFloorSectionId: null,
                        selectedFloorSeparatorId: null
                    }
                    : {})
            };
        }
        case "SET_FLOOR_SECTION_MATERIAL": {
            if (state.walkthroughMode) return state;
            const face = state.floorPaintSeparators[action.payload.regionId];
            if (!face || !getWallPaintSections(face).some(
                section => section.id === action.payload.sectionId
            )) {
                return state;
            }
            return {
                ...state,
                floorPaintSeparators: {
                    ...state.floorPaintSeparators,
                    [action.payload.regionId]: {
                        ...face,
                        sectionMaterials: {
                            ...face.sectionMaterials,
                            [action.payload.sectionId]: action.payload.materialId
                        }
                    }
                }
            };
        }
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
                buildTool: action.payload,
                activeFloorMaterialId: null,
                activeWallMaterialId: null
            };
        case "APPLY_SELECTED_ASSET":
            if (state.walkthroughMode) return state;
            if (!state.selectedAsset) return state;
            return {
                ...state,
                buildTool: state.selectedAsset.type,
                activeFloorMaterialId: null,
                activeWallMaterialId: null
            };
        case "CONFIRM_LAYOUT":
            if (state.walkthroughMode) return state;
            return {
                ...state,
                layoutConfirmed: true,
                activeTab: "furniture"
            };
        case "ADD_DOOR":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                doors: [
                    ...state.doors,
                    action.payload
                ]
            };
        case "UPDATE_DOOR":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                windows: [
                    ...state.windows,
                    action.payload
                ]
            };
        case "UPDATE_WINDOW":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
            return {
                ...state,
                blueprint:
                    action.payload
            };
        case "REMOVE_BLUEPRINT":
            if (state.walkthroughMode) return state;
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
            if (state.workflowType === "admin-managed") return state;
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
                        wallWidth:
                            savedWindow.wallWidth ?? savedWindow.width,
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
                workflowType:
                    project.workflowType === "admin-managed"
                        ? "admin-managed"
                        : "legacy",
                structuralOwner:
                    project.structuralOwner,
                structuralStatus:
                    project.structuralStatus,
                structuralRevision:
                    project.structuralRevision,
                publishedStructuralRevision:
                    project.publishedStructuralRevision,
                projectBudget:
                    isValidProjectBudget(project.maximumBudget)
                        ? project.maximumBudget
                        : null,
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
                stairs:
                    project.stairs ?? [],
                stairLandings:
                    project.stairLandings ?? [],
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
                wallPaintSeparators: project.wallPaintSeparators ?? {},
                floorPaintSeparators: project.floorPaintSeparators ?? {},
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
                activeTab: "furniture"
            };
        }
        default:
            return state;
    }
}

function getFloorName(index: number): string {
    const number = index + 1;
    const suffix = number % 100 >= 11 && number % 100 <= 13
        ? "th"
        : number % 10 === 1
            ? "st"
            : number % 10 === 2
                ? "nd"
                : number % 10 === 3
                    ? "rd"
                    : "th";
    return `${number}${suffix} Floor`;
}

function captureFloor(
    state: EditorState,
    floor: Pick<EditorFloorData, "floorId" | "name">
): EditorFloorData {
    return {
        ...floor,
        walls: state.walls,
        corners: state.corners,
        doors: state.doors,
        furniture: state.furniture,
        windows: state.windows,
        openings: state.openings,
        stairs: state.stairs,
        stairLandings: state.stairLandings,
        floorFinishes: state.floorFinishes,
        wallFinishes: state.wallFinishes,
        wallPaintSeparators: state.wallPaintSeparators,
        floorPaintSeparators: state.floorPaintSeparators,
        wallHeight: state.wallHeight,
        wallThickness: state.wallThickness,
        snapEnabled: state.snapEnabled,
        gridSize: state.gridSize,
        layoutConfirmed: state.layoutConfirmed,
        archRise: state.archRise,
        openingWidth: state.openingWidth,
        openingHeight: state.openingHeight,
        blueprint: state.blueprint
    };
}

function captureActiveFloor(state: EditorState): EditorState {
    const currentFloor = state.floors.find(floor => floor.floorId === state.activeFloorId);
    if (!currentFloor) return state;
    const updatedFloor = captureFloor(state, currentFloor);
    return {
        ...state,
        floors: state.floors.map(floor =>
            floor.floorId === updatedFloor.floorId ? updatedFloor : floor
        )
    };
}

function showFloor(state: EditorState, floor: EditorFloorData): EditorState {
    return {
        ...state,
        ...floor,
        activeFloorId: floor.floorId,
        selectedWallSide: null,
        selectedWallId: null,
        selectedWallRegionId: null,
        selectedWallSectionId: null,
        selectedWallSeparatorId: null,
        selectedFloorSectionId: null,
        selectedFloorSeparatorId: null,
        wallSeparatorPlacement: null,
        selectedRegionId: null,
        selectedCornerId: null,
        selectedOpeningId: null,
        selectedFurnitureId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedAsset: null,
        movingFurnitureId: null,
        movingDoorId: null,
        movingWindowId: null,
        activeFloorMaterialId: null,
        activeWallMaterialId: null,
        blueprintCalibrationMode: false,
        blueprintCalibrationStart: null,
        blueprintCalibrationEnd: null,
        draftWallLength: null
    };
}

export function syncEditorFloor(state: EditorState): EditorState {
    return captureActiveFloor(state);
}

export function editorReducer(
    state: EditorState,
    action: EditorAction
): EditorState {
    if (action.type === "LOAD_PROJECT") {
        const loaded = reduceEditorAction(state, action);
        if (loaded === state) return state;

        const project = action.payload as SavedProjectData;
        const savedFloors: SavedProjectFloor[] = Array.isArray(project.floors) && project.floors.length > 0
            ? project.floors
            : [{
                floorId: "first-floor",
                name: getFloorName(0),
                structure: project
            }];
        const floors = savedFloors.map((floor, index) => {
            const staircaseData = getStaircaseFloorData({
                ...floor.structure,
                stairs: floor.stairs ?? floor.structure.stairs,
                stairLandings: floor.stairLandings ?? floor.structure.stairLandings
            }, project, index);
            const structure = {
                ...project,
                ...floor.structure,
                furniture: floor.furniture ?? floor.structure.furniture ??
                    (index === 0 ? project.furniture : []),
                floorFinishes: floor.floorFinishes ?? floor.structure.floorFinishes ??
                    (index === 0 ? project.floorFinishes : {}),
                wallFinishes: floor.wallFinishes ?? floor.structure.wallFinishes ??
                    (index === 0 ? project.wallFinishes : {}),
                wallPaintSeparators: floor.wallPaintSeparators ??
                    floor.structure.wallPaintSeparators ??
                    (index === 0 ? project.wallPaintSeparators : {}) ?? {},
                floorPaintSeparators: floor.floorPaintSeparators ??
                    floor.structure.floorPaintSeparators ??
                    (index === 0 ? project.floorPaintSeparators : {}) ?? {},
                stairs: staircaseData.stairs,
                stairLandings: staircaseData.stairLandings,
                floors: undefined,
                activeFloorId: undefined
            } as SavedProjectData;
            const hydrated = reduceEditorAction(loaded, {
                type: "LOAD_PROJECT",
                payload: structure
            });
            return captureFloor(hydrated, {
                floorId: floor.floorId || "first-floor",
                name: floor.name || getFloorName(index)
            });
        });
        const activeFloor = floors.find(floor => floor.floorId === project.activeFloorId) ?? floors[0];
        return showFloor({ ...loaded, floors }, activeFloor);
    }

    const nextState = reduceEditorAction(state, action);
    if (nextState === state) return state;
    return captureActiveFloor(nextState);
}