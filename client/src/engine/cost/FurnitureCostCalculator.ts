import type {
    Furniture
} from "../furniture/FurnitureTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedFurnitureAsset
} from "../../engine/furniture/FirebaseFurnitureLibrary";

import type {
    CostItem
} from "./CostTypes";


//==================================================
// CALCULATE FURNITURE COSTS
//==================================================

export function calculateFurnitureCosts(
    furnitureList: Furniture[]
): CostItem[] {

    const grouped =
        new Map<
            string,
            CostItem
        >();


    for (
        const furniture
        of furnitureList
    ) {

        //--------------------------------------------------
        // Firebase first
        //
        // Older/local furniture remains supported through
        // AssetLibrary as a fallback.
        //--------------------------------------------------

        const asset =
            getCachedFurnitureAsset(
                furniture.assetId
            ) ??
            findAsset(
                furniture.assetId
            );


        //--------------------------------------------------
        // Asset not found
        //--------------------------------------------------

        if (
            !asset
        ) {

            continue;

        }


        //--------------------------------------------------
        // Existing item
        //--------------------------------------------------

        const existing =
            grouped.get(
                asset.id
            );


        if (
            existing
        ) {

            existing.quantity +=
                1;


            existing.subtotal =
                existing.quantity *
                existing.rate;

        }


        //--------------------------------------------------
        // New item
        //--------------------------------------------------

        else {

            grouped.set(

                asset.id,

                {

                    category:
                        "furniture",

                    name:
                        asset.name,

                    quantity:
                        1,

                    unit:
                        "item",

                    rate:
                        asset.price,

                    subtotal:
                        asset.price

                }

            );

        }

    }


    //--------------------------------------------------
    // Return grouped costs
    //--------------------------------------------------

    return Array.from(
        grouped.values()
    );

}