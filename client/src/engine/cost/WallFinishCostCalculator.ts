import type {
    Corner
} from "../walls/Corner";

import type {
    Wall
} from "../walls/WallTypes";

import {
    solveRegions
} from "../regions/RegionSolver";

import {
    MaterialLibrary
} from "../materials/MaterialLibrary";

import type {
    CostItem
} from "./CostTypes";

export interface WallFinishCostOptions {

    corners: Corner[];

    walls: Wall[];

    wallHeight: number;

    wallFinishes:
        Record<
            string,
            Record<string, string>
        >;
}

export function calculateWallFinishCosts(
    options: WallFinishCostOptions
): CostItem[] {

    const {
        corners,
        walls,
        wallHeight,
        wallFinishes
    } = options;

    //--------------------------------------------------
    // Generate rooms
    //--------------------------------------------------

    const regions =
        solveRegions(
            corners,
            walls
        );

    //--------------------------------------------------
    // Group wall finish quantities by material
    //
    // Example:
    //
    // White Paint
    // 35.50 m²
    //
    // Gray Paint
    // 18.20 m²
    //--------------------------------------------------

    const grouped =
        new Map<
            string,
            CostItem
        >();

    //--------------------------------------------------
    // Process every room
    //--------------------------------------------------

    for (
        const region
        of regions
    ) {

        //--------------------------------------------------
        // Every wall of this room represents one
        // interior wall surface for this room.
        //--------------------------------------------------

        for (
            const wall
            of region.walls
        ) {

            //--------------------------------------------------
            // Find the material assigned to this
            // room + wall combination.
            //--------------------------------------------------

            const materialId =
                wallFinishes[
                    region.id
                ]?.[
                    wall.id
                ];

            if (
                !materialId
            ) {

                continue;

            }

            //--------------------------------------------------
            // Find material
            //--------------------------------------------------

            const material =
                MaterialLibrary.find(
                    item =>
                        item.id ===
                            materialId &&

                        item.category ===
                            "wallFinish"
                );

            if (
                !material
            ) {

                continue;

            }

            //--------------------------------------------------
            // Wall length
            //--------------------------------------------------

            const wallLength =
                wall.start.position.distanceTo(
                    wall.end.position
                );

            //--------------------------------------------------
            // Surface area of THIS room's side
            // of the wall.
            //--------------------------------------------------

            const area =
                wallLength *
                wallHeight;

            if (
                area <= 0
            ) {

                continue;

            }

            //--------------------------------------------------
            // Group by material
            //--------------------------------------------------

            const existing =
                grouped.get(
                    material.id
                );

            if (
                existing
            ) {

                existing.quantity +=
                    area;

                existing.subtotal =
                    existing.quantity *
                    existing.rate;

            } else {

                grouped.set(
                    material.id,
                    {
                        category:
                            "wallFinish",

                        name:
                            material.name,

                        quantity:
                            area,

                        unit:
                            "m²",

                        rate:
                            material.pricePerSquareMeter,

                        subtotal:
                            area *
                            material.pricePerSquareMeter
                    }
                );
            }

        }

    }

    return Array.from(
        grouped.values()
    );
}