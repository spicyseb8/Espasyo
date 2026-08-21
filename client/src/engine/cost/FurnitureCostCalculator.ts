import type { Furniture } from "../furniture/FurnitureTypes";
import { findAsset } from "../../assets/AssetLibrary";

import type { CostItem } from "./CostTypes";

export function calculateFurnitureCosts(
    furnitureList: Furniture[]
): CostItem[] {

    const grouped =
        new Map<string, CostItem>();

    for (const furniture of furnitureList) {

        const asset =
            findAsset(
                furniture.assetId
            );

        if (!asset) {
            continue;
        }

        const existing =
            grouped.get(asset.id);

        if (existing) {

            existing.quantity += 1;

            existing.subtotal =
                existing.quantity *
                existing.rate;

        } else {

            grouped.set(
                asset.id,
                {
                    category: "furniture",

                    name: asset.name,

                    quantity: 1,

                    unit: "item",

                    rate: asset.price,

                    subtotal: asset.price
                }
            );
        }
    }

    return Array.from(
        grouped.values()
    );
}