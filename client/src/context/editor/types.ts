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

export interface BlueprintCalibrationPoint {
    x: number;
    z: number;
}

export interface EditorState {
    activeTab: string;
    activeTool: Tool;
    walkthroughMode: boolean;
    blueprintCalibrationMode: boolean;
    blueprintCalibrationStart: BlueprintCalibrationPoint | null;
    blueprintCalibrationEnd: BlueprintCalibrationPoint | null;
    walls: Wall[];
    corners: Corner[];
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
    floorFinishes: Record<string, string>;
    wallFinishes: Record<string, Record<string, string>>;
    draftWallLength: number | null;
    showWallMeasurements: boolean;
    archRise: number;
    openingWidth: number;
    openingHeight: number;
    blueprint: BlueprintState | null;
}