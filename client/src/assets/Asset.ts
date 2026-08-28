import type { BuildTool } from "../context/BuildTool";
import type { OpeningShape } from "../engine/openings/OpeningTypes";
import type { FurnitureCategory } from "../engine/furniture/FurnitureCategory";

export interface FurnitureDimensions {

    width: number;

    depth: number;

    height: number;
}
export interface Asset {

    id: string;

    name: string;

    thumbnail: string;

    model: string;

    type: BuildTool;

    price: number;

    openingShape?: OpeningShape;
    
    furnitureCategory?: FurnitureCategory;

    furnitureDimensions?: FurnitureDimensions;

   rotationOffsetY?: number;

    scale?: number;

    depthOffset?: number;
}