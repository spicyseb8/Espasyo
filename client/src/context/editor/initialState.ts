import type { EditorState } from "./types";
import { Tool } from "./tools";
import { BuildTool } from "../BuildTool";

export const initialState: EditorState = {
    activeTab: "floorplan",
    activeTool: Tool.None,
    walls: [],
    corners: [],
    selectedWallId: null,
    selectedRegionId: null,
    selectedCornerId: null,
    selectedOpeningId: null,
    wallHeight: 3,
    wallThickness: 0.15,
    snapEnabled: true,
    gridSize: 0.25,
    layoutConfirmed: false,
    selectedAsset: null,
    buildTool: BuildTool.None,
    doors: [],
    furniture: [],
    windows: [],
    openings: [],
    floorFinishes: {},
    archRise: 0.5,
    openingWidth: 1,
    openingHeight: 2,
    draftWallLength: null,
    showWallMeasurements: false,
    wallFinishes: {},
    blueprint: null
};