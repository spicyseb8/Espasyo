import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

import {
    solveRegions
} from "../regions/RegionSolver";

import {
    polygonArea
} from "../regions/Polygon";

import {
    findCachedFloorMaterial
} from "../materials/floors";

import {
    MaterialLibrary
} from "../materials/MaterialLibrary";

import type {
    CostItem
} from "./CostTypes";

export interface FlooringCostOptions {

    corners: Corner[];

    walls: Wall[];

    floorFinishes:
        Record<string, string>;
}

export function calculateFlooringCosts(
    options: FlooringCostOptions
): CostItem[] {

    const {
        corners,
        walls,
        floorFinishes
    } = options;

    const regions =
        solveRegions(
            corners,
            walls
        );

    const items:
        CostItem[] = [];

    for (
        const region of regions
    ) {

        const materialId =
            floorFinishes[
                region.id
            ];

        // No flooring assigned to this room yet.
        if (!materialId) {
            continue;
        }

        //--------------------------------------------------
        // Firebase floor material
        //--------------------------------------------------

        const firebaseMaterial =
            findCachedFloorMaterial(
                materialId
            );

        //--------------------------------------------------
        // Keep the old hardcoded library as a fallback
        // for existing projects using old material IDs.
        //--------------------------------------------------

        const material =
            firebaseMaterial ??
            MaterialLibrary.find(
                item =>
                    item.id === materialId &&
                    item.category ===
                        "flooring"
            );

        if (!material) {
            continue;
        }

        const area =
            Math.abs(
                polygonArea(
                    region.corners
                )
            );

        if (area <= 0) {
            continue;
        }

        const subtotal =
            area *
            material.pricePerSquareMeter;

        items.push({

            category:
                "flooring",

            name:
                material.name,

            quantity:
                area,

            unit:
                "m²",

            rate:
                material.pricePerSquareMeter,

            subtotal
        });
    }

    return items;
}