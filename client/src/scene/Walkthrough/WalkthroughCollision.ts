import {
    Vector3
} from "three";

import type {
    WallPiece
} from "../../engine/walls/WallPiece";


//==================================================
// WALKTHROUGH SETTINGS
//==================================================

export const PLAYER_HEIGHT =
    1.70;

export const PLAYER_RADIUS =
    0.25;


//==================================================
// SPAWN SAFETY
//==================================================
//
// Spawn uses a little more clearance than normal walking.
// This prevents the player from spawning directly beside
// a wall or furniture and immediately getting stuck.
//

export const SPAWN_SAFETY_MARGIN =
    0.08;


//==================================================
// 2D OBB
//==================================================

interface OBB2D {

    centerX:
        number;

    centerZ:
        number;

    halfWidth:
        number;

    halfDepth:
        number;

    rotation:
        number;

}


//==================================================
// CREATE OBB
//==================================================

function createOBB(

    x:
        number,

    z:
        number,

    width:
        number,

    depth:
        number,

    rotation:
        number

):
    OBB2D {

    return {

        centerX:
            x,

        centerZ:
            z,

        halfWidth:
            width / 2,

        halfDepth:
            depth / 2,

        rotation

    };

}


//==================================================
// CIRCLE VS OBB
//==================================================

function circleIntersectsOBB(

    position:
        Vector3,

    radius:
        number,

    obb:
        OBB2D

):
    boolean {

    const dx =
        position.x -
        obb.centerX;

    const dz =
        position.z -
        obb.centerZ;


    const cos =
        Math.cos(
            obb.rotation
        );

    const sin =
        Math.sin(
            obb.rotation
        );


    //--------------------------------------------------
    // Convert player position into local OBB space.
    //--------------------------------------------------

    const localX =
        dx * cos +
        dz * sin;

    const localZ =
        -dx * sin +
        dz * cos;


    const closestX =
        Math.max(

            -obb.halfWidth,

            Math.min(
                localX,
                obb.halfWidth
            )

        );


    const closestZ =
        Math.max(

            -obb.halfDepth,

            Math.min(
                localZ,
                obb.halfDepth
            )

        );


    const distanceX =
        localX -
        closestX;

    const distanceZ =
        localZ -
        closestZ;


    const distanceSquared =
        distanceX * distanceX +
        distanceZ * distanceZ;


    return (
        distanceSquared <
        radius * radius
    );
}


//==================================================
// WALL COLLISION
//==================================================

function collidesWithWallPiece(

    position:
        Vector3,

    piece:
        WallPiece,

    radius:
        number = PLAYER_RADIUS

):
    boolean {

    const playerBottom =
        0;

    const playerTop =
        PLAYER_HEIGHT;


    const wallBottom =
        piece.position.y -
        piece.height / 2;

    const wallTop =
        piece.position.y +
        piece.height / 2;


    //--------------------------------------------------
    // Ignore wall pieces that are completely above or
    // below the player.
    //--------------------------------------------------

    if (

        playerTop <=
        wallBottom ||

        playerBottom >=
        wallTop

    ) {

        return false;
    }


    const wallOBB =
        createOBB(

            piece.position.x,

            piece.position.z,

            piece.width,

            piece.thickness,

            piece.rotationY

        );


    return circleIntersectsOBB(

        position,

        radius,

        wallOBB

    );
}


//==================================================
// FURNITURE COLLISION
//==================================================

function collidesWithFurniture(

    position:
        Vector3,

    furniture:
        any,

    radius:
        number = PLAYER_RADIUS

):
    boolean {

    if (
        !furniture
    ) {

        return false;
    }


    const width =
        Number(
            furniture.width
        ) || 0;

    const depth =
        Number(
            furniture.depth
        ) || 0;


    if (

        width <= 0 ||

        depth <= 0

    ) {

        return false;
    }


    const furniturePosition =
        furniture.position;


    if (
        !furniturePosition
    ) {

        return false;
    }


    const positionX =
        Number(
            furniturePosition.x
        ) || 0;

    const positionZ =
        Number(
            furniturePosition.z
        ) || 0;


    const rotationY =
        Number(
            furniture.rotationY
        ) || 0;


    const furnitureOBB =
        createOBB(

            positionX,

            positionZ,

            width,

            depth,

            rotationY

        );


    return circleIntersectsOBB(

        position,

        radius,

        furnitureOBB

    );
}


//==================================================
// WALKING COLLISION TEST
//==================================================

export function canWalkTo(

    position:
        Vector3,

    wallPieces:
        WallPiece[],

    furniture:
        any[] = []

):
    boolean {

    //--------------------------------------------------
    // Check walls.
    //--------------------------------------------------

    for (
        const piece of wallPieces
    ) {

        if (
            collidesWithWallPiece(
                position,
                piece,
                PLAYER_RADIUS
            )
        ) {

            return false;
        }
    }


    //--------------------------------------------------
    // Check furniture.
    //--------------------------------------------------

    for (
        const item of furniture
    ) {

        if (
            collidesWithFurniture(
                position,
                item,
                PLAYER_RADIUS
            )
        ) {

            return false;
        }
    }


    return true;
}


//==================================================
// SAFE SPAWN COLLISION TEST
//==================================================
//
// This is stricter than canWalkTo().
//
// The player needs a little more room around their body
// before being allowed to spawn.
//

export function canSpawnAt(

    position:
        Vector3,

    wallPieces:
        WallPiece[],

    furniture:
        any[] = []

):
    boolean {

    const spawnRadius =
        PLAYER_RADIUS +
        SPAWN_SAFETY_MARGIN;


    //--------------------------------------------------
    // Check walls.
    //--------------------------------------------------

    for (
        const piece of wallPieces
    ) {

        if (
            collidesWithWallPiece(
                position,
                piece,
                spawnRadius
            )
        ) {

            return false;
        }
    }


    //--------------------------------------------------
    // Check furniture.
    //--------------------------------------------------

    for (
        const item of furniture
    ) {

        if (
            collidesWithFurniture(
                position,
                item,
                spawnRadius
            )
        ) {

            return false;
        }
    }


    return true;
}