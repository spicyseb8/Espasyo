import type { Asset } from "../../assets/Asset";
import type { PlacementTransform } from "../../scene/Build/BuildPlacement";
import type { AssetBounds } from "../../scene/Build/AssetBounds";
import { getCurrentPreviewWidth } from "../../scene/Build/BuildElementCollision";

import type { Window } from "./WindowTypes";

function getOccupiedDimensions(
    bounds: AssetBounds,
    rotationOffsetY: number
) {
    const width = bounds.width;
    const depth = bounds.depth;

    const cos = Math.abs(Math.cos(rotationOffsetY));
    const sin = Math.abs(Math.sin(rotationOffsetY));

    return {
        width: width * sin + depth * cos,
        depth: width * cos + depth * sin
    };
}

export function placeWindow(
    asset: Asset,
    transform: PlacementTransform,
    bounds: AssetBounds
): Window {

    const rotationOffsetY = asset.rotationOffsetY ?? 0;

    const occupied = getOccupiedDimensions(bounds, rotationOffsetY);

    return {
        id: crypto.randomUUID(),

        assetId: asset.id,

        wallId: transform.wall.id,

        position: transform.position.clone(),

        rotationY: transform.rotationY,

        width: occupied.width,

        height: bounds.height,

        depth: occupied.depth,

        // Extent along the wall, same math as the preview.
        wallWidth: getCurrentPreviewWidth(asset, transform, bounds)
    };
}