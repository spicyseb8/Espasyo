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
    doors: Door[],
    findDoorAsset?: (
        assetId: string
    ) => { id: string; name: string; price?: number } | undefined
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
            findDoorAsset?.(door.assetId) ??
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

        if (
            typeof asset.price !== "number" ||
            !Number.isFinite(asset.price) ||
            asset.price < 0
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