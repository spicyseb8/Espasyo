import { Vector3 } from "three";
import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";
import { findOrCreateCorner } from "./CornerSolver";
import { removeDuplicateWalls } from "./RemoveDuplicateWalls";
import { mergeCollinearWalls } from "./MergeCollinearWalls";
import { findWallIntersections } from "./WallIntersection";
import {splitWall} from "./wallSplit";
export interface PlaceWallResult {
    corners: Corner[];
    walls: Wall[];
    startCorner: Corner;
    endCorner: Corner;
    shouldFinish: boolean;
    createdWalls: Wall[];
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
    const startResult = findOrCreateCorner(start, corners);
    if (startResult.isNew) {
        corners.push(startResult.corner);
    }

    //----------------------------------------
    // Resolve end corner
    //----------------------------------------
    const endResult = findOrCreateCorner(end, corners);
    if (endResult.isNew) {
        corners.push(endResult.corner);
    }

    if (startResult.corner.id === endResult.corner.id) {

    return {
        corners: existingCorners,
        walls: existingWalls,
        startCorner: startResult.corner,
        endCorner: endResult.corner,
        createdWalls: [],
        shouldFinish: true
    };

}
    //----------------------------------------
    // Determine if we should finish
    //----------------------------------------
    const shouldFinish = !endResult.isNew;
    //detect wall intersection
    const intersections = findWallIntersections(

        start,

        end,

        existingWalls

    );

    if (intersections.length > 0) {

    const hit = intersections[0];

    //----------------------------------------
    // Create split corner
    //----------------------------------------

    const splitCorner: Corner = {

        id: crypto.randomUUID(),

        position: hit.point.clone()

    };

    //----------------------------------------
    // Split wall
    //----------------------------------------

    const [leftWall, rightWall] = splitWall(

        hit.wall,

        splitCorner

    );

    console.log({

        splitCorner,

        leftWall,

        rightWall

    });

}
    //----------------------------------------
    // Create new wall
    //----------------------------------------
    const newWall: Wall = {
        id: crypto.randomUUID(),
        start: startResult.corner,
        end: endResult.corner,
    };

    //----------------------------------------
    // Add wall
    //----------------------------------------
    const walls = removeDuplicateWalls([...existingWalls, newWall]);
    const merged = mergeCollinearWalls(corners, walls);

    return {
        corners: merged.corners,
        walls: merged.walls,
        startCorner: startResult.corner,
        endCorner: endResult.corner,
        createdWalls: [newWall],
        shouldFinish 
    };
}