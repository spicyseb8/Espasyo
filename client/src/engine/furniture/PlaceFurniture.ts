import type { Asset } from "../../assets/Asset";

import type {
    Furniture
} from "./FurnitureTypes";

import type {
    FurniturePlacement
} from "../../scene/Furniture/FurniturePlacement";

import type {
    AssetBounds
} from "../../scene/Build/AssetBounds";

export function placeFurniture(
    asset: Asset,
    placement: FurniturePlacement,
    bounds: AssetBounds
): Furniture {

    return {

        id:
            crypto.randomUUID(),

        assetId:
            asset.id,

        position:
            placement.position.clone(),

        rotationY:
            placement.rotationY,

        modelOffset:
            placement.modelOffset.clone(),

        //--------------------------------------------------
        // Store the actual scaled furniture dimensions
        //--------------------------------------------------

        width:
            bounds.width,

        depth:
            bounds.depth,

        height:
            bounds.height

    };
}