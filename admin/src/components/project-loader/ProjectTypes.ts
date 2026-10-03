//==================================================
// ADMIN PROJECT JSON TYPES
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
export type CostCategory =
    | "furniture"
    | "flooring"
    | "wallFinish"
    | "doors"
    | "windows";

export interface SavedCostItem {
    category: CostCategory;
    name: string;
    quantity: number;
    unit: string;
    rate: number;
    subtotal: number;
}

export interface SavedCostEstimate {
    items: SavedCostItem[];
    subtotal: number;
    total: number;
}

//==================================================
// PROJECT JSON
//==================================================

export interface SavedProjectData {

    projectId: string;

    projectName: string;

    ownerId: string;

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

    costEstimate?: SavedCostEstimate;
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
        unknown
        | null;

}