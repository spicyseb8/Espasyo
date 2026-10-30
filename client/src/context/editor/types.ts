import { Tool } from "./tools";
import type { Wall } from "../../engine/walls/WallTypes";
import type { Corner } from "../../engine/walls/Corner";
import type { Asset } from "../../assets/Asset";
import { BuildTool } from "../BuildTool";
import type { Door } from "../../engine/doors/DoorTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";
import type { Window } from "../../engine/windows/WindowTypes";
import type { Opening } from "../../engine/openings/OpeningTypes";
import type { BlueprintState } from "../../engine/blueprint/BlueprintTypes";
import type { SavedStaircase, SavedStaircaseLanding } from "./ProjectTypes";

export interface EditorFloorData {
    floorId: string;
    name: string;
    walls: Wall[];
    corners: Corner[];
    doors: Door[];
    furniture: Furniture[];
    windows: Window[];
    openings: Opening[];
    stairs: SavedStaircase[];
    stairLandings: SavedStaircaseLanding[];
    floorFinishes: Record<string, string>;
    wallFinishes: Record<string, Record<string, string>>;
    wallHeight: number;
    wallThickness: number;
    snapEnabled: boolean;
    gridSize: number;
    layoutConfirmed: boolean;
    archRise: number;
    openingWidth: number;
    openingHeight: number;
    blueprint: BlueprintState | null;
}

export interface BlueprintCalibrationPoint {
    x: number;
    z: number;
}

export interface EditorState {
    workflowType?: "legacy" | "admin-managed";
    structuralOwner?: "admin";
    structuralStatus?: "draft" | "published";
    structuralRevision?: number;
    publishedStructuralRevision?: number;
    floors: EditorFloorData[];
    activeFloorId: string;
    activeTab: string;
    activeTool: Tool;
    walkthroughMode: boolean;
    blueprintCalibrationMode: boolean;
    blueprintCalibrationStart: BlueprintCalibrationPoint | null;
    blueprintCalibrationEnd: BlueprintCalibrationPoint | null;
    walls: Wall[];
    corners: Corner[];
    selectedWallSide: 1 | -1 | null;
    selectedWallId: string | null;
    selectedWallRegionId: string | null;
    selectedRegionId: string | null;
    selectedCornerId: string | null;
    selectedOpeningId: string | null;
    selectedFurnitureId: string | null;
    selectedDoorId: string | null;
    selectedWindowId: string | null;
    movingFurnitureId: string | null;
    movingDoorId: string | null;
    movingWindowId: string | null;
    activeFloorMaterialId: string | null;
    activeWallMaterialId: string | null;
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
    stairs: SavedStaircase[];
    stairLandings: SavedStaircaseLanding[];
    floorFinishes: Record<string, string>;
    wallFinishes: Record<string, Record<string, string>>;
    draftWallLength: number | null;
    showWallMeasurements: boolean;
    archRise: number;
    openingWidth: number;
    openingHeight: number;
    blueprint: BlueprintState | null;
}