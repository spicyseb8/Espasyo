import { Tool } from "./tools";
import type { Wall } from "../../engine/walls";
import type { Corner } from "../../engine/walls";
import type { Asset } from "../../assets/Asset";
import { BuildTool } from "../BuildTool";
import type { Door } from "../../engine/doors/DoorTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";

export interface EditorState {
    activeTab: string;
    activeTool: Tool;
    walls: Wall[];
    corners: Corner[];
    selectedWallId: string | null;
    selectedRegionId: string | null;
    selectedCornerId: string | null;
    wallHeight: number;
    wallThickness: number;
    snapEnabled: boolean;
    gridSize: number;
    layoutConfirmed: boolean;
    selectedAsset: Asset | null;
    buildTool: BuildTool;
    doors: Door[];
    furniture: Furniture[];
    draftWallLength: number | null;
    showWallMeasurements: boolean;
}