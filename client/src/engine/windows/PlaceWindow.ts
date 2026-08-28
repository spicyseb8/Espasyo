import type { Asset } from "../../assets/Asset";
import type { PlacementTransform } from "../../scene/Build/BuildPlacement";
import type { AssetBounds } from "../../scene/Build/AssetBounds";

import type { Window } from "./WindowTypes";

function getOccupiedDimensions(
    bounds: AssetBounds,
    rotationOffsetY: number
) {
    const width = bounds.width;
    const depth = bounds.depth;

    const cos = Math.abs(Math.cos(rotationOffsetY));
    const sin = Math.abs(Math.sin(rotationOffsetY));

    const occupiedWidth =
        width * cos +
        depth * sin;

    const occupiedDepth =
        width * sin +
        depth * cos;

    return {
        width: occupiedWidth,
        depth: occupiedDepth
    };
}

export function placeWindow(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds
): Window {

    const rotationOffsetY =
        asset.rotationOffsetY ?? 0;

    const occupiedDimensions =
        getOccupiedDimensions(
            bounds,
            rotationOffsetY
        );

    return {
        id: crypto.randomUUID(),

        assetId: asset.id,

        wallId: transform.wall.id,

        position: transform.position.clone(),

        rotationY: transform.rotationY,

        width: occupiedDimensions.width,

        height: bounds.height,

        depth: occupiedDimensions.depth
    };
}