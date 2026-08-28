import type { Window } from "../windows/WindowTypes";

import type {
    CostItem
} from "./CostTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

export function calculateWindowCosts(
    windows: Window[]
): CostItem[] {

    //--------------------------------------------------
    // Group windows by asset
    //--------------------------------------------------

    const grouped =
        new Map<
            string,
            CostItem
        >();

    //--------------------------------------------------
    // Process placed windows
    //--------------------------------------------------

    for (
        const window
        of windows
    ) {

        const asset =
            findAsset(
                window.assetId
            );

        //--------------------------------------------------
        // Ignore missing assets
        //--------------------------------------------------

        if (
            !asset
        ) {

            continue;

        }

        //--------------------------------------------------
        // Find existing group
        //--------------------------------------------------

        const existing =
            grouped.get(
                asset.id
            );

        if (
            existing
        ) {

            existing.quantity += 1;

            existing.subtotal =
                existing.quantity *
                existing.rate;

        } else {

            grouped.set(
                asset.id,
                {

                    category:
                        "windows",

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
    // Return grouped items
    //--------------------------------------------------

    return Array.from(
        grouped.values()
    );
}