import type { EditorState } from "./types";

import type { EditorAction } from "./editorActions";

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

        default:

            return state;

    }

}