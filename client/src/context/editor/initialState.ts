import type { EditorState } from "./types";
import { Tool } from "./tools";
import { BuildTool } from "../BuildTool";

export const initialState: EditorState = {
    activeTab: "floorplan",
    activeTool: Tool.Wall,
    walls: [],
    corners: [],
    selectedWallId: null,
    selectedCornerId: null,
    wallHeight: 3,
    wallThickness: 0.15,
    snapEnabled: true,
    gridSize: 0.25,
    layoutConfirmed: false,
    selectedAsset: null,
    buildTool: BuildTool.None,
    doors: [],
    showWallMeasurements: false // Added this line
};