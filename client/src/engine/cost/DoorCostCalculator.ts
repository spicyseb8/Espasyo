import type { Door } from "../doors/DoorTypes";

import type {
    CostItem
} from "./CostTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

export function calculateDoorCosts(
    doors: Door[]
): CostItem[] {

    //--------------------------------------------------
    // Group doors by asset
    //--------------------------------------------------

    const grouped =
        new Map<
            string,
            CostItem
        >();

    //--------------------------------------------------
    // Process placed doors
    //--------------------------------------------------

    for (
        const door
        of doors
    ) {

        const asset =
            findAsset(
                door.assetId
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
                        "doors",

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