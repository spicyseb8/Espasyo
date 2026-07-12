import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { hitWall } from "./wallHit";
import { splitWall } from "./wallSplit";
import { findOrCreateCorner } from "./CornerSolver";
import { removeDuplicateWalls } from "./RemoveDuplicateWalls";

export interface PlaceWallResult {

    corners: Corner[];

    walls: Wall[];

}

const CORNER_EPSILON = 0.001;

function resolveCorner(

    point: Vector3,
    walls: Wall[],
    corners: Corner[]

): {

    corner: Corner;

    walls: Wall[];

    corners: Corner[];

} {

    const workingWalls = [...walls];
    const workingCorners = [...corners];

    const hit = hitWall(

        point,

        workingWalls

    );

    if (hit) {

        if (

            point.distanceTo(

                hit.start.position

            ) < CORNER_EPSILON

        ) {

            return {

                corner: hit.start,

                walls: workingWalls,

                corners: workingCorners

            };

        }

        if (

            point.distanceTo(

                hit.end.position

            ) < CORNER_EPSILON

        ) {

            return {

                corner: hit.end,

                walls: workingWalls,

                corners: workingCorners

            };

        }

        const {

            corner,

            isNew

        } = findOrCreateCorner(

            point,

            workingCorners

        );

        if (isNew) {

            workingCorners.push(corner);

        }

        const [

            left,

            right

        ] = splitWall(

            hit,

            corner

        );

        const index = workingWalls.findIndex(

            w => w.id === hit.id

        );

        if (index >= 0) {

            workingWalls.splice(

                index,

                1,

                left,

                right

            );

        }

        return {

            corner,

            walls: workingWalls,

            corners: workingCorners

        };

    }

    const {

        corner,

        isNew

    } = findOrCreateCorner(

        point,

        workingCorners

    );

    if (isNew) {

        workingCorners.push(corner);

    }

    return {

        corner,

        walls: workingWalls,

        corners: workingCorners

    };

}

export function placeWall(

    existingCorners: Corner[],

    existingWalls: Wall[],

    startPosition: Vector3,

    endPosition: Vector3

): PlaceWallResult {

    //----------------------------------
    // Resolve START
    //----------------------------------

    const start = resolveCorner(

        startPosition,

        existingWalls,

        existingCorners

    );

    //----------------------------------
    // Resolve END
    //----------------------------------

    const end = resolveCorner(

        endPosition,

        start.walls,

        start.corners

    );

    //----------------------------------
    // Ignore zero-length wall
    //----------------------------------

    if (

        start.corner.id ===

        end.corner.id

    ) {

        return {

            corners: end.corners,

            walls: end.walls

        };

    }

    //----------------------------------
    // Prevent duplicate wall
    //----------------------------------

    const duplicate = end.walls.find(

        wall =>

            (

                wall.start.id === start.corner.id &&

                wall.end.id === end.corner.id

            )

            ||

            (

                wall.start.id === end.corner.id &&

                wall.end.id === start.corner.id

            )

    );

    if (duplicate) {

        return {

            corners: end.corners,

            walls: end.walls

        };

    }

    //----------------------------------
    // Create wall
    //----------------------------------

    const newWall: Wall = {

        id: crypto.randomUUID(),

        start: start.corner,

        end: end.corner

    };

    return {

        corners: end.corners,

        walls: removeDuplicateWalls([

            ...end.walls,

            newWall

        ])

    };

}