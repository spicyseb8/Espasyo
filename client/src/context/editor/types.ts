import { Tool } from "./tools";

import type {
    Wall
} from "../../engine/walls/WallTypes";

import type {
    Corner
} from "../../engine/walls/Corner";

import type {
    Asset
} from "../../assets/Asset";

import {
    BuildTool
} from "../BuildTool";

import type {
    Door
} from "../../engine/doors/DoorTypes";

import type {
    Furniture
} from "../../engine/furniture/FurnitureTypes";

import type {
    Window
} from "../../engine/windows/WindowTypes";

import type {
    Opening
} from "../../engine/openings/OpeningTypes";

import type {
    BlueprintState
} from "../../engine/blueprint/BlueprintTypes";


//==================================================
// BLUEPRINT CALIBRATION POINT
//==================================================

export interface BlueprintCalibrationPoint {

    x: number;

    z: number;

}


//==================================================
// EDITOR STATE
//==================================================

export interface EditorState {

    activeTab: string;

    activeTool: Tool;

    walkthroughMode: boolean;


    //==================================================
    // BLUEPRINT CALIBRATION
    //==================================================

    blueprintCalibrationMode: boolean;

    blueprintCalibrationStart:
        BlueprintCalibrationPoint | null;

    blueprintCalibrationEnd:
        BlueprintCalibrationPoint | null;


    //==================================================
    // WALLS
    //==================================================

    walls: Wall[];

    corners: Corner[];


    //==================================================
    // SELECTION
    //==================================================

    selectedWallId: string | null;

    selectedRegionId: string | null;

    selectedCornerId: string | null;

    selectedOpeningId: string | null;


    //==================================================
    // FURNITURE / DOOR / WINDOW SELECTION
    //==================================================

    selectedFurnitureId: string | null;

    selectedDoorId: string | null;

    selectedWindowId: string | null;
    movingFurnitureId: string | null;
    movingDoorId: string | null;
    movingWindowId: string | null;
    //==================================================
    // WALL SETTINGS
    //==================================================

    wallHeight: number;

    wallThickness: number;


    //==================================================
    // GRID
    //==================================================

    snapEnabled: boolean;

    gridSize: number;


    //==================================================
    // LAYOUT
    //==================================================

    layoutConfirmed: boolean;


    //==================================================
    // BUILD
    //==================================================

    selectedAsset: Asset | null;

    buildTool: BuildTool;


    //==================================================
    // ARCHITECTURAL ELEMENTS
    //==================================================

    doors: Door[];

    furniture: Furniture[];

    windows: Window[];

    openings: Opening[];


    //==================================================
    // FINISHES
    //==================================================

    floorFinishes:
        Record<string, string>;

    wallFinishes:
        Record<
            string,
            Record<string, string>
        >;


    //==================================================
    // MEASUREMENTS
    //==================================================

    draftWallLength:
        number | null;

    showWallMeasurements:
        boolean;


    //==================================================
    // OPENING SETTINGS
    //==================================================

    archRise: number;

    openingWidth: number;

    openingHeight: number;


    //==================================================
    // BLUEPRINT
    //==================================================

    blueprint:
        BlueprintState | null;

}