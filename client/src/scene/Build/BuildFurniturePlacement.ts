import { Vector3 } from "three";
import type { Asset } from "../../assets/Asset";
import type { AssetBounds } from "./AssetBounds";

export interface FurniturePlacement {
    kind: "furniture";

    assetId: string;

    position: Vector3;
    rotationY: number;
    modelOffset: Vector3;
}

export function buildFurniturePlacement(
    floorPoint: Vector3,
    asset: Asset,
    bounds: AssetBounds
): FurniturePlacement {

    const position = floorPoint.clone();

    const modelOffset = new Vector3(
        0,
        bounds.height * 0.5,
        0
    );

    return {
        kind: "furniture",

        assetId: asset.id,

        position,

        rotationY: 0,

        modelOffset
    };
}