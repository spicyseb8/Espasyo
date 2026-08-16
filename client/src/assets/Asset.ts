import type { BuildTool } from "../context/BuildTool";

export interface Asset {

    id: string;

    name: string;

    thumbnail: string;

    model: string;

    type: BuildTool;
    price: number;

}