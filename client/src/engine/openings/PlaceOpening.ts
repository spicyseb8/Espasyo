import type { AssetBounds } from "../../scene/Build/AssetBounds";
import type { PlacementTransform } from "../../scene/Build/BuildPlacement";
import type { OpeningShape, Opening } from "./OpeningTypes";

export function placeOpening(
    transform: PlacementTransform,
    bounds: AssetBounds,
    shape: OpeningShape
): Opening {

    return {

        id: crypto.randomUUID(),

        wallId: transform.wall.id,

        shape,

        position: transform.position.clone(),

        width: bounds.width,

        height: bounds.height,

        depth: bounds.depth
    };
}