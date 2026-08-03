import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { findOrCreateCorner } from "./CornerSolver";
import { splitWall } from "./wallSplit";
import { hitWallAtPoint } from "./wallHit";

export interface PrepareWallStartResult {

    corners: Corner[];

    walls: Wall[];

    startCorner: Corner;

}

export function prepareWallStart(

    existingCorners: Corner[],

    existingWalls: Wall[],

    point: Vector3

): PrepareWallStartResult {

    //----------------------------------------
    // Working copies
    //----------------------------------------

    const corners = [...existingCorners];
    let walls = [...existingWalls];

    //----------------------------------------
    // Did we click directly on a wall?
    //----------------------------------------

    const hit = hitWallAtPoint(

        point,

        existingWalls

    );

    if (hit) {

        //----------------------------------------
        // Existing split corner?
        //----------------------------------------

        const existingCorner = corners.find(

            c =>

                c.position.distanceTo(

                    hit.point

                ) < 0.001

        );

        let splitCorner: Corner;

        if (existingCorner) {

            splitCorner = existingCorner;

        } else {

            splitCorner = {

                id: crypto.randomUUID(),

                position: hit.point.clone()

            };

            corners.push(

                splitCorner

            );

        }

        //----------------------------------------
        // Split wall
        //----------------------------------------

        const [leftWall, rightWall] = splitWall(

            hit.wall,

            splitCorner

        );

        walls = walls.filter(

            wall => wall.id !== hit.wall.id

        );

        walls.push(

            leftWall,

            rightWall

        );

        return {

            corners,

            walls,

            startCorner: splitCorner

        };

    }

    //----------------------------------------
    // Normal corner
    //----------------------------------------

    const result = findOrCreateCorner(

        point,

        corners

    );

    if (result.isNew) {

        corners.push(

            result.corner

        );

    }

    return {

        corners,

        walls,

        startCorner: result.corner

    };

}