//==================================================
// PROJECT JSON TYPES
//==================================================
//
// These types describe the JSON format created by
// ProjectPanel.tsx.
//
// They intentionally use plain objects instead of
// Three.js Vector3 because JSON cannot store Vector3
// instances directly.
//==================================================

import type { StaircaseFlightParameters } from "../../../../shared/staircaseGeometry.ts";


//==================================================
// VECTOR3 JSON
//==================================================

export interface SavedVector3 {

    x: number;

    y: number;

    z: number;

}


//==================================================
// CORNER
//==================================================

export interface SavedCorner {

    id: string;

    position: SavedVector3;

}


//==================================================
// WALL CORNER REFERENCE
//==================================================

export interface SavedWallCorner {

    id: string;

    position: SavedVector3;

}


//==================================================
// WALL
//==================================================

export interface SavedWall {

    id: string;

    start: SavedWallCorner;

    end: SavedWallCorner;

}


//==================================================
// DOOR
//==================================================

export interface SavedDoor {

    id: string;

    assetId: string;

    wallId: string;

    position: SavedVector3;

    rotationY: number;

    width: number;

    height: number;

    depth: number;

}


//==================================================
// WINDOW
//==================================================

export interface SavedWindow {

    id: string;

    assetId: string;

    wallId: string;

    position: SavedVector3;

    rotationY: number;

    width: number;

    height: number;

    wallWidth?: number;

    depth: number;

}


//==================================================
// FURNITURE
//==================================================

export interface SavedFurniture {

    id: string;

    assetId: string;

    position: SavedVector3;

    rotationY: number;

    modelOffset: SavedVector3;

    width: number;

    depth: number;

    height: number;

}


//==================================================
// OPENING
//==================================================

export interface SavedOpening {

    id: string;

    wallId: string;

    shape:
        "rectangle"
        | "arch";

    position: SavedVector3;

    width: number;

    height: number;

    depth: number;

    archRise?: number;

}

export interface SavedStaircase {
    id: string;
    floorId: string;
    destinationFloorId: string;
    stairConnectionId: string;
    position: SavedVector3;
    rotationY: number;
    width: number;
    totalRise: number;
    riserCount: number;
    treadDepth: number;
    treadThickness?: number;
    railings?: boolean;
    shape: "straight" | "l-shaped" | "u-shaped";
    turnDirection?: "left" | "right";
    flights?: StaircaseFlightParameters[];
}

export interface SavedStaircaseLanding {
    id: string;
    stairId: string;
    stairConnectionId: string;
    floorId: string;
    position: SavedVector3;
    rotationY: number;
    width: number;
    run: number;
}

export interface SavedProjectFloor {
    floorId: string;
    name: string;
    structure: Partial<SavedProjectData>;
    furniture?: SavedFurniture[];
    floorFinishes?: Record<string, string>;
    wallFinishes?: Record<string, Record<string, string>>;
    stairs?: SavedStaircase[];
    stairLandings?: SavedStaircaseLanding[];
}


//==================================================
// PROJECT JSON
//==================================================

export interface SavedProjectData {

    projectId: string;

    projectName: string;

    ownerId: string;

    workflowType?: "legacy" | "admin-managed";
    structuralOwner?: "admin";
    structuralStatus?: "draft" | "published";
    structuralRevision?: number;
    publishedStructuralRevision?: number;
    floors?: SavedProjectFloor[];
    activeFloorId?: string;

    schemaVersion: number;

    savedAt: string;


    //==================================================
    // ROOM / WALL SETTINGS
    //==================================================

    wallHeight: number;

    wallThickness: number;

    gridSize: number;

    snapEnabled: boolean;

    layoutConfirmed: boolean;


    //==================================================
    // FLOOR PLAN
    //==================================================

    walls: SavedWall[];

    corners: SavedCorner[];


    //==================================================
    // ARCHITECTURAL ELEMENTS
    //==================================================

    doors: SavedDoor[];

    windows: SavedWindow[];

    furniture: SavedFurniture[];

    openings: SavedOpening[];

    stairs?: SavedStaircase[];

    stairLandings?: SavedStaircaseLanding[];


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
    // OPENING SETTINGS
    //==================================================

    archRise: number;

    openingWidth: number;

    openingHeight: number;


    //==================================================
    // BLUEPRINT
    //==================================================

    blueprint:
        import(
            "../../engine/blueprint/BlueprintTypes"
        ).BlueprintState
        | null;

}