export type MaterialCategory =
    | "flooring"
    | "wallFinish";

export interface Material {

    id: string;

    name: string;

    category: MaterialCategory;

    // Cost per square meter
    pricePerSquareMeter: number;

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