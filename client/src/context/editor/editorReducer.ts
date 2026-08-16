import type { EditorState } from "./types";
import type { EditorAction } from "./editorActions";
import { Tool } from "./tools";

export function editorReducer(
    state: EditorState,
    action: EditorAction
): EditorState {
    switch (action.type) {
        case "SET_ACTIVE_TAB":
            return {
                ...state,
                activeTab: action.payload
            };
        case "SET_ACTIVE_TOOL":
            return {
                ...state,
                activeTool: action.payload
            };
        case "ADD_WALL":
            return {
                ...state,
                walls: [...state.walls, action.payload]
            };
        case "SET_WALLS":
            return {
                ...state,
                walls: action.payload
            };
        case "SET_CORNERS":
            return {
                ...state,
                corners: action.payload
            };
        case "SET_WALL_HEIGHT":
            return {
                ...state,
                wallHeight: action.payload
            };
        case "SET_WALL_THICKNESS":
            return {
                ...state,
                wallThickness: action.payload
            };
        case "SET_GRID_SIZE":
            return {
                ...state,
                gridSize: action.payload
            };
        case "TOGGLE_SNAP":
            return {
                ...state,
                snapEnabled: !state.snapEnabled
            };
        case "REMOVE_WALL":
            return {
                ...state,
                walls: state.walls.filter(
                    wall => wall.id !== action.payload
                )
            };
        case "ADD_CORNER": {
            if (
                state.corners.some(
                    c => c.id === action.payload.id
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
        }
        case "REMOVE_CORNER":
            return {
                ...state,
                corners: state.corners.filter(
                    c => c.id !== action.payload
                )
            };
        case "SELECT_WALL":
            return {
                ...state,
                selectedWallId: action.payload
            };
        case "SELECT_REGION":
            return {
                ...state,
                selectedRegionId: action.payload
            };
        case "SELECT_CORNER":
            return {
                ...state,
                selectedCornerId: action.payload
            };
        case "SET_SELECTED_ASSET":
            return {
                ...state,
                selectedAsset: action.payload
            };
        case "SET_BUILD_TOOL":
            return {
                ...state,
                buildTool: action.payload
            };
        case "CONFIRM_LAYOUT":
            return {...state, layoutConfirmed: true, activeTab: "build"};
        case "ADD_DOOR":
            return {...state, doors: [...state.doors, action.payload]};
        
        case "ADD_FURNITURE":
            return {...state, furniture: [...state.furniture, action.payload]};
        case "SET_DRAFT_WALL_LENGTH":
            return {
                ...state,
                draftWallLength: action.payload
            };
        case "SET_SHOW_WALL_MEASUREMENTS":
            return {
                ...state,
                showWallMeasurements: action.payload
            };
        default:
            return state;
    }
}