import {
    Vector3
} from "three";

import type {
    WallPiece
} from "../../engine/walls/WallPiece";


//==================================================
// WALKTHROUGH SETTINGS
//==================================================

export const PLAYER_HEIGHT = 1.70;

export const PLAYER_RADIUS = 0.25;


//==================================================
// 2D OBB
//==================================================

interface OBB2D {

    centerX: number;

    centerZ: number;

    halfWidth: number;

    halfDepth: number;

    rotation: number;

}


//==================================================
// CREATE OBB
//==================================================

function createOBB(
    x: number,
    z: number,
    width: number,
    depth: number,
    rotation: number
): OBB2D {

    return {

        centerX: x,

        centerZ: z,

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
    position: Vector3,
    radius: number,
    obb: OBB2D
): boolean {

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


    // Convert player position into
    // the wall/furniture local space.

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
    position: Vector3,
    piece: WallPiece
): boolean {

    const playerBottom = 0;

    const playerTop =
        PLAYER_HEIGHT;


    const wallBottom =
        piece.position.y -
        piece.height / 2;

    const wallTop =
        piece.position.y +
        piece.height / 2;


    //--------------------------------------------------
    // Ignore pieces completely above/below player.
    //--------------------------------------------------

    if (
        playerTop <= wallBottom ||
        playerBottom >= wallTop
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
        PLAYER_RADIUS,
        wallOBB
    );

}


//==================================================
// FURNITURE COLLISION
//==================================================

function collidesWithFurniture(
    position: Vector3,
    furniture: any
): boolean {

    if (!furniture) {

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


    if (!furniturePosition) {

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
        PLAYER_RADIUS,
        furnitureOBB
    );

}


//==================================================
// WALKING COLLISION TEST
//==================================================

export function canWalkTo(
    position: Vector3,
    wallPieces: WallPiece[],
    furniture: any[] = []
): boolean {

    //--------------------------------------------------
    // Check walls
    //--------------------------------------------------

    for (
        const piece of wallPieces
    ) {

        if (
            collidesWithWallPiece(
                position,
                piece
            )
        ) {

            return false;

        }

    }


    //--------------------------------------------------
    // Check furniture
    //--------------------------------------------------

    for (
        const item of furniture
    ) {

        if (
            collidesWithFurniture(
                position,
                item
            )
        ) {

            return false;

        }

    }


    return true;

}