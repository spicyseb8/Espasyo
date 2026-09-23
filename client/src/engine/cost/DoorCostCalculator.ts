import type {
    Door
} from "../doors/DoorTypes";

import type {
    CostItem
} from "./CostTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedDoorAsset
} from "../../engine/build/FirebaseDoorWindowLibrary";


export function calculateDoorCosts(
    doors: Door[]
): CostItem[] {

    const grouped =
        new Map<
            string,
            CostItem
        >();


    for (
        const door of doors
    ) {

        //--------------------------------------------------
        // Firebase first; old local doors remain supported.
        //--------------------------------------------------

        const asset =
            getCachedDoorAsset(
                door.assetId
            ) ??
            findAsset(
                door.assetId
            );


        if (
            !asset
        ) {

            continue;
        }


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


    return Array.from(
        grouped.values()
    );
}