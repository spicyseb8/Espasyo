import { Tool } from "./tools";
import type { Wall } from "../../engine/walls";
import type { Corner } from "../../engine/walls";
import type { Asset } from "../../assets/Asset";
import { BuildTool } from "../BuildTool";
import type { Door } from "../../engine/doors/DoorTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";
import type { Window } from "../../engine/windows/WindowTypes";
import type { Opening } from "../../engine/openings/OpeningTypes";
import type {
    BlueprintState
} from "../../engine/blueprint/BlueprintTypes";

export interface EditorState {
    activeTab: string;
    activeTool: Tool;
    walls: Wall[];
    corners: Corner[];
    selectedWallId: string | null;
    selectedRegionId: string | null;
    selectedCornerId: string | null;
    selectedOpeningId: string | null;
    wallHeight: number;
    wallThickness: number;
    snapEnabled: boolean;
    gridSize: number;
    layoutConfirmed: boolean;
    selectedAsset: Asset | null;
    buildTool: BuildTool;
    doors: Door[];
    furniture: Furniture[];
    windows: Window[];
    openings: Opening[];
    floorFinishes: Record<string, string>;
    draftWallLength: number | null;
    showWallMeasurements: boolean;
    wallFinishes: Record< string, Record<string, string>>;
    archRise: number;
    openingWidth: number;
    openingHeight: number;
    blueprint: BlueprintState | null;
}