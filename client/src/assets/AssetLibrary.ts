import { BuildTool } from "../context/BuildTool";
import type { Asset } from "./Asset";

export const AssetLibrary = {

    doors: [

        {

            id: "single-door",

            name: "Single Door",

            thumbnail: "/uploads/doors/single-door.png",

            model: "/uploads/doors/single-door.glb",

            type: BuildTool.Door

        }

    ] satisfies Asset[],

    windows: [] as Asset[],

    openings: [] as Asset[]

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

        ...AssetLibrary.openings

    ].find(

        asset => asset.id === id

    );

}