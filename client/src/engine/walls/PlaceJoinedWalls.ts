import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { hitWall } from "./wallHit";
import { getNearestWallEndpoint } from "./WallModeHelper";

import { findOrCreateCorner } from "./CornerSolver";
import { removeDuplicateWalls } from "./RemoveDuplicateWalls";

export interface PlaceWallResult {
    corners: Corner[];
    walls: Wall[];
}

export function placeJoinedWall(
    existingCorners: Corner[],
    existingWalls: Wall[],
    start: Vector3,
    end: Vector3
): PlaceWallResult {

    const corners = [...existingCorners];

    //--------------------------------------------------
    // START
    //--------------------------------------------------

    let startCorner: Corner;

    const startHit = hitWall(start, existingWalls, 0.6);

    if (startHit) {

        startCorner = getNearestWallEndpoint(
            start,
            startHit
        );

    } else {

        const result = findOrCreateCorner(
            start,
            corners
        );

        startCorner = result.corner;

        if (result.isNew)
            corners.push(startCorner);
    }

    //--------------------------------------------------
    // END
    //--------------------------------------------------

    let endCorner: Corner;

    const endHit = hitWall(end, existingWalls, 0.6);

    if (endHit) {

        endCorner = getNearestWallEndpoint(
            end,
            endHit
        );

    } else {

        const result = findOrCreateCorner(
            end,
            corners
        );

        endCorner = result.corner;

        if (result.isNew)
            corners.push(endCorner);
    }

    //--------------------------------------------------
    // CREATE WALL
    //--------------------------------------------------

    let walls = [

        ...existingWalls,

        {

            id: crypto.randomUUID(),

            start: startCorner,

            end: endCorner

        }

    ];

    walls = removeDuplicateWalls(walls);

    return {

        corners,

        walls

    };

}