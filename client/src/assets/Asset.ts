import type { BuildTool } from "../context/BuildTool";

import type {
    OpeningShape
} from "../engine/openings/OpeningTypes";

import type {
    FurnitureCategory
} from "../engine/furniture/FurnitureCategory";


export type FurniturePlacementSurface =
    | "floor"
    | "wall"
    | "furniture";


export type FurnitureSnapTarget =
    | "wall"
    | "furniture";


export interface Asset {

    id: string;

    name: string;

    thumbnail: string;

    model: string;

    type: BuildTool;

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