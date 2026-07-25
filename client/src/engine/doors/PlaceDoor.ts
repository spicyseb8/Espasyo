import type { Asset } from "../../assets/Asset";
import type { PlacementTransform } from "../../scene/Build/BuildPlacement";
import type { AssetBounds } from "../../scene/Build/AssetBounds";

import type { Door } from "./DoorTypes";

export function placeDoor(

    asset: Asset,

    transform: PlacementTransform,

    bounds: AssetBounds

): Door {

    return {


        id: crypto.randomUUID(),

        assetId: asset.id,


        wallId: transform.wall.id,


        position: transform.position.clone(),

        rotationY: transform.rotationY,


        width: bounds.width,

        height: bounds.height,

        depth: bounds.depth

    };

}