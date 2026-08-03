import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { findWallIntersections } from "./WallIntersection";
import { splitWall } from "./wallSplit";

export interface ApplyWallIntersectionsResult {

    corners: Corner[];

    walls: Wall[];

    splitCorner?: Corner;

    actualStart: Vector3;

    actualEnd: Vector3;

}

export function applyWallIntersections(

    corners: Corner[],

    walls: Wall[],

    start: Vector3,

    end: Vector3

): ApplyWallIntersectionsResult {

    const intersections = findWallIntersections(

        start,

        end,

        walls

    );

    //----------------------------------------
    // No intersections
    //----------------------------------------

    if (intersections.length === 0) {

        return {

            corners,

            walls,

            actualStart: start,

            actualEnd: end

        };

    }

    //----------------------------------------
    // Nearest intersection
    //----------------------------------------

    const hit = intersections[0];

    //----------------------------------------
    // Create split corner
    //----------------------------------------

    const splitCorner: Corner = {

        id: crypto.randomUUID(),

        position: hit.point.clone()

    };

    //----------------------------------------
    // Split existing wall
    //----------------------------------------

    const [leftWall, rightWall] = splitWall(

        hit.wall,

        splitCorner

    );

    //----------------------------------------
    // Replace existing wall
    //----------------------------------------

    const nextCorners = [

        ...corners,

        splitCorner

    ];

    const nextWalls = walls.filter(

        wall => wall.id !== hit.wall.id

    );

    nextWalls.push(

        leftWall,

        rightWall

    );

    //----------------------------------------
    // Return
    //----------------------------------------

    return {

        corners: nextCorners,

        walls: nextWalls,

        splitCorner,

        actualStart: start,

        actualEnd: hit.point.clone()

    };

}