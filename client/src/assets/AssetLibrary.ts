import { BuildTool } from "../context/BuildTool";
import type { Asset } from "./Asset";

export const AssetLibrary = {

    doors: [
        {
            id: "single-door",
            name: "Single Door",
            thumbnail: "/uploads/doors/single-door.png",
            model: "/uploads/doors/single-door.glb",
            type: BuildTool.Door,
            price: 5000
        }
    ] satisfies Asset[],

    windows: [] as Asset[],

    openings: [] as Asset[],

furniture: [
    {
        id: "test-chair",
        name: "Chair",
        thumbnail: "/uploads/furniture/chair.png",
        model: "/uploads/furniture/chair.glb",
        type: BuildTool.Furniture,
        price: 2500
    }
] satisfies Asset[],

};

//--------------------------------------------------
// Find asset by id
//--------------------------------------------------

export function findAsset(
    id: string
): Asset | undefined {

    return [
        ...AssetLibrary.doors,
        ...AssetLibrary.windows,
        ...AssetLibrary.openings,
        ...AssetLibrary.furniture
    ].find(
        asset => asset.id === id
    );

}