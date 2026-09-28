//--------------------------------------------------
// View-only Asset definition
//--------------------------------------------------

export type ViewAssetType =
    | "door"
    | "window"
    | "furniture"
    | "opening"
    | "floor"
    | "wall";


//--------------------------------------------------
// Furniture placement
//--------------------------------------------------

export type FurniturePlacementSurface =
    | "floor"
    | "wall"
    | "furniture";


export type FurnitureSnapTarget =
    | "wall"
    | "furniture";


//--------------------------------------------------
// Opening shape
//--------------------------------------------------

export type OpeningShape =
    | "rectangle"
    | "arch";


//--------------------------------------------------
// Furniture category
//--------------------------------------------------

export type FurnitureCategory =
    | string;


//--------------------------------------------------
// Asset
//--------------------------------------------------

export interface Asset {

    id: string;

    name: string;

    thumbnail: string;

    model: string;

    type: ViewAssetType;

    price: number;


    //--------------------------------------------------
    // Opening
    //--------------------------------------------------

    openingShape?: OpeningShape;


    //--------------------------------------------------
    // Furniture
    //--------------------------------------------------

    furnitureCategory?: FurnitureCategory;


    //--------------------------------------------------
    // Model rotation
    //--------------------------------------------------

    rotationOffsetY?: number;


    //--------------------------------------------------
    // Optional scale
    //--------------------------------------------------

    scale?: number;


    //--------------------------------------------------
    // Placement
    //--------------------------------------------------

    depthOffset?: number;

    placementSurfaces?:
        FurniturePlacementSurface[];

    snapTargets?:
        FurnitureSnapTarget[];
}