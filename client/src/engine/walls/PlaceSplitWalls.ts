import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { findOrCreateCorner } from "./CornerSolver";
import { splitWall } from "./wallSplit";
import { removeDuplicateWalls } from "./RemoveDuplicateWalls";

export interface PlaceSplitWallResult {

    corners: Corner[];

    walls: Wall[];

}

export function placeSplitWall(

    existingCorners: Corner[],
    existingWalls: Wall[],

    wallToSplit: Wall,

    splitPoint: Vector3,

    endPoint: Vector3

): PlaceSplitWallResult {

    const corners = [...existingCorners];

    //------------------------------------------------
    // Create split corner
    //------------------------------------------------

    const splitCornerResult = findOrCreateCorner(

        splitPoint,

        corners

    );

    if (splitCornerResult.isNew) {

        corners.push(

            splitCornerResult.corner

        );

    }

    //------------------------------------------------
    // Remove original wall
    //------------------------------------------------

    let walls = existingWalls.filter(

        w => w.id !== wallToSplit.id

    );

    //------------------------------------------------
    // Split original wall
    //------------------------------------------------

    const [

        firstHalf,

        secondHalf

    ] = splitWall(

        wallToSplit,

        splitCornerResult.corner

    );

    walls.push(firstHalf);
    walls.push(secondHalf);

    //------------------------------------------------
    // Resolve end corner
    //------------------------------------------------

    const endCornerResult = findOrCreateCorner(

        endPoint,

        corners

    );

    if (endCornerResult.isNew) {

        corners.push(

            endCornerResult.corner

        );

    }

    //------------------------------------------------
    // Create new wall
    //------------------------------------------------

    walls.push({

        id: crypto.randomUUID(),

        start: splitCornerResult.corner,

        end: endCornerResult.corner

    });

    //------------------------------------------------
    // Remove duplicates
    //------------------------------------------------

    walls = removeDuplicateWalls(

        walls

    );

    return {

        corners,

        walls

    };

}