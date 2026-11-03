import type {
    Window
} from "../windows/WindowTypes";

import type {
    CostItem
} from "./CostTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedWindowAsset
} from "../../engine/build/FirebaseDoorWindowLibrary";


export function calculateWindowCosts(
    windows: Window[],
    findWindowAsset?: (
        assetId: string
    ) => { id: string; name: string; price?: number } | undefined
): CostItem[] {

    const grouped =
        new Map<
            string,
            CostItem
        >();


    for (
        const window of windows
    ) {

        //--------------------------------------------------
        // Firebase first; old local windows remain supported.
        //--------------------------------------------------

        const asset =
            findWindowAsset?.(window.assetId) ??
            getCachedWindowAsset(
                window.assetId
            ) ??
            findAsset(
                window.assetId
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


    return Array.from(
        grouped.values()
    );
}