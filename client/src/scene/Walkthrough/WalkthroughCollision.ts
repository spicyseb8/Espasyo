import {
    Vector3
} from "three";

import {
    calculateStaircaseGeometry,
    validateStaircaseDimensions,
    type StaircaseGeometryBox
} from "../../../../shared/staircaseGeometry.ts";

import type {
    SavedStaircase
} from "../../context/editor/ProjectTypes";

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

export interface WalkthroughStairCollider {
    position: Vector3;
    width: number;
    depth: number;
    height: number;
    rotationY: number;
}

const STAIR_RAIL_THICKNESS = 0.05;
const STAIR_POST_WIDTH = 0.05;
const STAIR_POST_HEIGHT = 0.9;

function transformStairPosition(
    stair: SavedStaircase,
    localX: number,
    localY: number,
    localZ: number
): Vector3 {
    const cos = Math.cos(stair.rotationY);
    const sin = Math.sin(stair.rotationY);
    return new Vector3(
        stair.position.x + localX * cos + localZ * sin,
        stair.position.y + localY,
        stair.position.z - localX * sin + localZ * cos
    );
}

function boxCollider(
    stair: SavedStaircase,
    box: StaircaseGeometryBox
): WalkthroughStairCollider {
    return {
        position: transformStairPosition(
            stair,
            box.position.x,
            box.position.y,
            box.position.z
        ),
        width: box.size.x,
        depth: box.size.z,
        height: box.size.y,
        rotationY: stair.rotationY
    };
}

export function buildWalkthroughStairColliders(
    stairs: SavedStaircase[],
    activeFloorId: string
): WalkthroughStairCollider[] {
    const colliders: WalkthroughStairCollider[] = [];

    for (const stair of stairs) {
        if (stair.floorId !== activeFloorId) continue;

        if (
            !stair.position ||
            ![
                stair.position.x,
                stair.position.y,
                stair.position.z,
                stair.rotationY
            ].every(Number.isFinite) ||
            validateStaircaseDimensions(stair)
        ) {
            continue;
        }

        const geometry = calculateStaircaseGeometry(stair);
        const boxes = [
            ...geometry.flights.flatMap(flight => [
                ...flight.treads,
                ...flight.risers
            ]),
            ...geometry.landings.map(landing => ({
                position: landing.center,
                size: landing.size
            }))
        ];

        colliders.push(...boxes.map(box => boxCollider(stair, box)));

        if (stair.railings === false) continue;

        for (const railing of geometry.railings) {
            const dx = railing.end.x - railing.start.x;
            const dy = railing.end.y - railing.start.y;
            const dz = railing.end.z - railing.start.z;
            const centerX = (railing.start.x + railing.end.x) / 2;
            const centerY = (railing.start.y + railing.end.y) / 2;
            const centerZ = (railing.start.z + railing.end.z) / 2;

            colliders.push({
                position: transformStairPosition(
                    stair,
                    centerX,
                    centerY,
                    centerZ
                ),
                width: Math.hypot(dx, dz),
                depth: STAIR_RAIL_THICKNESS,
                height: Math.abs(dy) + STAIR_RAIL_THICKNESS,
                rotationY: stair.rotationY + Math.atan2(dz, dx)
            });

            for (const post of railing.posts) {
                colliders.push({
                    position: transformStairPosition(
                        stair,
                        post.position.x,
                        post.position.y,
                        post.position.z
                    ),
                    width: STAIR_POST_WIDTH,
                    depth: STAIR_POST_WIDTH,
                    height: STAIR_POST_HEIGHT,
                    rotationY: stair.rotationY
                });
            }
        }
    }

    return colliders;
}


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

function collidesWithStair(
    position: Vector3,
    stair: WalkthroughStairCollider,
    radius: number
): boolean {
    const playerBottom = position.y - PLAYER_HEIGHT;
    const playerTop = position.y;
    const stairBottom = stair.position.y - stair.height / 2;
    const stairTop = stair.position.y + stair.height / 2;

    if (playerTop <= stairBottom || playerBottom >= stairTop) {
        return false;
    }

    return circleIntersectsOBB(
        position,
        radius,
        createOBB(
            stair.position.x,
            stair.position.z,
            stair.width,
            stair.depth,
            stair.rotationY
        )
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
        any[] = [],

    stairColliders:
        WalkthroughStairCollider[] = []

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

    for (const stair of stairColliders) {
        if (collidesWithStair(position, stair, PLAYER_RADIUS)) {
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
        any[] = [],

    stairColliders:
        WalkthroughStairCollider[] = []

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

    for (const stair of stairColliders) {
        if (collidesWithStair(position, stair, spawnRadius)) {
            return false;
        }
    }


    return true;
}