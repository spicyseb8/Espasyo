import type { EditorState } from "./types";

import { Tool } from "./tools";

export const initialState: EditorState = {

    activeTab: "floorplan",

    activeTool: Tool.Select,

    walls: [],

    corners: [],

    selectedWallId: null,

    selectedCornerId: null,

    wallHeight: 2.7,

    wallThickness: 0.15,

    snapEnabled: true,

    gridSize: 0.25

};