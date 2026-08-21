export type MaterialCategory =
    | "flooring"
    | "wallFinish";

export interface Material {

    id: string;

    name: string;

    category: MaterialCategory;

    // Cost per square meter
    pricePerSquareMeter: number;

    // Small preview image used by the UI
    thumbnail?: string;

    // Actual texture used by Three.js
    texture?: string;
}