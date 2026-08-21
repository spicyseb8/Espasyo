import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

import { solveRegions } from "../regions/RegionSolver";
import { polygonArea } from "../regions/Polygon";

export interface QuantityResult {
    floorArea: number;
    wallArea: number;
    wallLength: number;
    roomCount: number;
}

export function calculateDesignQuantities(
    corners: Corner[],
    walls: Wall[],
    wallHeight: number
): QuantityResult {

    //--------------------------------------------------
    // Rooms / floor area
    //--------------------------------------------------

    const regions = solveRegions(
        corners,
        walls
    );

    let floorArea = 0;

    for (const region of regions) {

        floorArea += Math.abs(
            polygonArea(region.corners)
        );

    }

    //--------------------------------------------------
    // Wall length
    //--------------------------------------------------

    let wallLength = 0;

    for (const wall of walls) {

        wallLength +=
            wall.start.position.distanceTo(
                wall.end.position
            );

    }

    //--------------------------------------------------
    // Wall surface area
    //--------------------------------------------------
    // For now we calculate both sides of every wall:
    //
    // wall length × wall height × 2
    //
    //--------------------------------------------------

    const wallArea =
        wallLength *
        wallHeight *
        2;

    return {
        floorArea,
        wallArea,
        wallLength,
        roomCount: regions.length
    };
}