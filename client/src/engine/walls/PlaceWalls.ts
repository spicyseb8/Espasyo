import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { findOrCreateCorner } from "./CornerSolver";
import { removeDuplicateWalls } from "./RemoveDuplicateWalls";

export interface PlaceWallResult {

    corners: Corner[];

    walls: Wall[];

}

export function placeWall(

    existingCorners: Corner[],
    existingWalls: Wall[],

    start: Vector3,
    end: Vector3

): PlaceWallResult {

    const corners = [...existingCorners];

    //----------------------------------------
    // Resolve start corner
    //----------------------------------------

    const startResult = findOrCreateCorner(

        start,
        corners

    );

    if (startResult.isNew) {

        corners.push(startResult.corner);

    }

    //----------------------------------------
    // Resolve end corner
    //----------------------------------------

    const endResult = findOrCreateCorner(

        end,
        corners

    );

    if (endResult.isNew) {

        corners.push(endResult.corner);

    }

    //----------------------------------------
    // Create new wall
    //----------------------------------------

    const newWall: Wall = {

        id: crypto.randomUUID(),

        start: startResult.corner,

        end: endResult.corner

    };

    //----------------------------------------
    // Add wall
    //----------------------------------------

    const walls = removeDuplicateWalls([

        ...existingWalls,

        newWall

    ]);

    return {

        corners,

        walls

    };

}