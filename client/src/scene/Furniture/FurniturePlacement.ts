import { Vector3 } from "three";

import type {
    Asset
} from "../../assets/Asset";

import type {
    AssetBounds
} from "../Build/AssetBounds";


export type FurniturePlacementMode =
    | "floor"
    | "wall"
    | "surface";


export interface FurniturePlacement {

    kind:
        "furniture";

    assetId:
        string;

    position:
        Vector3;

    rotationY:
        number;

    modelOffset:
        Vector3;

    width:
        number;

    depth:
        number;

    height:
        number;


    //--------------------------------------------------
    // Placement mode
    //--------------------------------------------------

    placementMode?:
        FurniturePlacementMode;


    //--------------------------------------------------
    // Furniture supporting this object
    //--------------------------------------------------

    parentFurnitureId:
        string | null;


    //--------------------------------------------------
    // Wall supporting this object
    //--------------------------------------------------

    wallId:
        string | null;


    //--------------------------------------------------
    // Surface normal
    //--------------------------------------------------

    surfaceNormal:
        Vector3 | null;

}


//======================================================
// BUILD FURNITURE PLACEMENT
//======================================================

export function buildFurniturePlacement(

    floorPoint:
        Vector3,

    asset:
        Asset,

    bounds:
        AssetBounds,

    rotationY =
        0

): FurniturePlacement {


    const position =
        floorPoint.clone();


    //--------------------------------------------------
    // MODEL OFFSET
    //--------------------------------------------------
    //
    // New native-GLB behavior:
    //
    // X:
    // Center the actual visual bounding box.
    //
    // Y:
    // Move the actual GLB bottom to the placement
    // surface.
    //
    // Z:
    // Center the actual visual bounding box.
    //
    //--------------------------------------------------

    const modelOffset =
        new Vector3(

            bounds.centerX !== undefined
                ? -bounds.centerX
                : 0,

            bounds.minY !== undefined
                ? -bounds.minY
                : bounds.height * 0.5,

            bounds.centerZ !== undefined
                ? -bounds.centerZ
                : 0

        );


    return {

        kind:
            "furniture",

        assetId:
            asset.id,

        position,

        rotationY,

        modelOffset,

        width:
            bounds.width,

        depth:
            bounds.depth,

        height:
            bounds.height,

        placementMode:
            "floor",

        parentFurnitureId:
            null,

        wallId:
            null,

        surfaceNormal:
            null

    };

}