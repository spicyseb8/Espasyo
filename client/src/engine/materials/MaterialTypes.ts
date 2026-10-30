import type { FloorPattern } from "../../../../shared/flooring/patterns";

export type MaterialCategory =
    | "flooring"
    | "wallFinish";

export interface Material {
    id: string;
    name: string;
    category: MaterialCategory;

    // Original category from the source data, if available
    sourceCategory?: string;

    // Cost per square meter
    pricePerSquareMeter: number;

    // Wall paint price per liter.
    pricePerLiter?: number;

    // Flooring price for one individual tile.
    pricePerPiece?: number;

    length?: number;

    width?: number;

    floorMaterialMode?: "single-tile";

    floorPattern?: FloorPattern;

    // Image shown in the material selection UI
    thumbnail?: string;

    // Texture used by Three.js
    texture?: string;

    // Solid color used by paint/materials
    color?: string;

    // Three.js material properties
    roughness?: number;
    metalness?: number;
}