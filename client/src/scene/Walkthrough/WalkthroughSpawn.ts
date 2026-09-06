import {
    Vector3
} from "three";

import type {
    Wall
} from "../../engine/walls/WallTypes";


//==================================================
// SETTINGS
//==================================================

const SPAWN_HEIGHT = 1.70;

const SPAWN_MARGIN = 0.75;


//==================================================
// ROOM COMPONENT
//==================================================

interface WallComponent {

    walls: Wall[];

}


//==================================================
// GET CONNECTED WALL COMPONENTS
//
// Walls that share a Corner belong to the same
// connected structure.
//
// Example:
//
// A ----- B
// |       |
// D ----- C
//
// All four walls belong to one component.
//==================================================

function getWallComponents(
    walls: Wall[]
): WallComponent[] {

    const components:
        WallComponent[] = [];


    const visited =
        new Set<string>();


    for (
        const wall of walls
    ) {

        if (
            visited.has(
                wall.id
            )
        ) {

            continue;

        }


        const componentWalls:
            Wall[] = [];


        const queue:
            Wall[] = [wall];


        visited.add(
            wall.id
        );


        //--------------------------------------------------
        // Breadth-first search through connected walls.
        //--------------------------------------------------

        while (
            queue.length > 0
        ) {

            const current =
                queue.shift()!;


            componentWalls.push(
                current
            );


            for (
                const other of walls
            ) {

                if (
                    visited.has(
                        other.id
                    )
                ) {

                    continue;

                }


                const sharesCorner =

                    other.start.id ===
                        current.start.id ||

                    other.start.id ===
                        current.end.id ||

                    other.end.id ===
                        current.start.id ||

                    other.end.id ===
                        current.end.id;


                if (
                    sharesCorner
                ) {

                    visited.add(
                        other.id
                    );

                    queue.push(
                        other
                    );

                }

            }

        }


        components.push({

            walls:
                componentWalls

        });

    }


    return components;

}


//==================================================
// CHECK IF COMPONENT FORMS A CLOSED ROOM
//
// A simple closed room should have:
//
// - At least 4 walls
// - Connected corners
// - Every corner used by the component has at least
//   two connected wall ends
//
// This prevents an open wall chain from being treated
// as a room.
//==================================================

function isClosedRoom(
    component: WallComponent
): boolean {

    const walls =
        component.walls;


    if (
        walls.length < 4
    ) {

        return false;

    }


    const cornerConnections =
        new Map<string, number>();


    for (
        const wall of walls
    ) {

        cornerConnections.set(

            wall.start.id,

            (
                cornerConnections.get(
                    wall.start.id
                ) || 0
            ) + 1

        );


        cornerConnections.set(

            wall.end.id,

            (
                cornerConnections.get(
                    wall.end.id
                ) || 0
            ) + 1

        );

    }


    //--------------------------------------------------
    // Every corner in a closed boundary should connect
    // to at least two wall endpoints.
    //--------------------------------------------------

    for (
        const count of
        cornerConnections.values()
    ) {

        if (
            count < 2
        ) {

            return false;

        }

    }


    return true;

}


//==================================================
// GET ROOM BOUNDS
//==================================================

function getWallBounds(
    walls: Wall[]
) {

    let minX =
        Infinity;


    let maxX =
        -Infinity;


    let minZ =
        Infinity;


    let maxZ =
        -Infinity;


    for (
        const wall of walls
    ) {

        minX =
            Math.min(

                minX,

                wall.start.position.x,

                wall.end.position.x

            );


        maxX =
            Math.max(

                maxX,

                wall.start.position.x,

                wall.end.position.x

            );


        minZ =
            Math.min(

                minZ,

                wall.start.position.z,

                wall.end.position.z

            );


        maxZ =
            Math.max(

                maxZ,

                wall.start.position.z,

                wall.end.position.z

            );

    }


    if (

        !Number.isFinite(
            minX
        ) ||

        !Number.isFinite(
            maxX
        ) ||

        !Number.isFinite(
            minZ
        ) ||

        !Number.isFinite(
            maxZ
        )

    ) {

        return null;

    }


    return {

        minX,

        maxX,

        minZ,

        maxZ

    };

}


//==================================================
// CHECK POINT INSIDE ROOM BOUNDS
//==================================================

function getRoomCenter(
    walls: Wall[]
): Vector3 | null {

    const bounds =
        getWallBounds(
            walls
        );


    if (!bounds) {

        return null;

    }


    const roomWidth =
        bounds.maxX -
        bounds.minX;


    const roomDepth =
        bounds.maxZ -
        bounds.minZ;


    if (

        roomWidth <= 1 ||

        roomDepth <= 1

    ) {

        return null;

    }


    //--------------------------------------------------
    // Start at center.
    //--------------------------------------------------

    let spawnX =
        (
            bounds.minX +
            bounds.maxX
        ) / 2;


    let spawnZ =
        (
            bounds.minZ +
            bounds.maxZ
        ) / 2;


    //--------------------------------------------------
    // Keep player away from room boundaries.
    //--------------------------------------------------

    spawnX =
        Math.max(

            bounds.minX +
                SPAWN_MARGIN,

            Math.min(

                spawnX,

                bounds.maxX -
                    SPAWN_MARGIN

            )

        );


    spawnZ =
        Math.max(

            bounds.minZ +
                SPAWN_MARGIN,

            Math.min(

                spawnZ,

                bounds.maxZ -
                    SPAWN_MARGIN

            )

        );


    return new Vector3(

        spawnX,

        SPAWN_HEIGHT,

        spawnZ

    );

}


//==================================================
// GET WALKTHROUGH SPAWN
//
// IMPORTANT:
// The FIRST CLOSED ROOM in the wall list is selected.
//
// This means:
//
// Room 1 → spawn here
// Room 2 → ignored
// Room 3 → ignored
//
// until Room 1 is completed.
//==================================================

export function getWalkthroughSpawn(
    walls: Wall[]
): Vector3 | null {

    if (

        !walls ||

        walls.length === 0

    ) {

        return null;

    }


    //--------------------------------------------------
    // Find connected wall groups.
    //--------------------------------------------------

    const components =
        getWallComponents(
            walls
        );


    //--------------------------------------------------
    // Components are returned in the same general
    // order they are first encountered in state.walls.
    //
    // Therefore we inspect them from first to last.
    //--------------------------------------------------

    for (
        const component of components
    ) {

        if (
            !isClosedRoom(
                component
            )
        ) {

            continue;

        }


        const spawn =
            getRoomCenter(
                component.walls
            );


        if (
            spawn
        ) {

            return spawn;

        }

    }


    //--------------------------------------------------
    // No closed room found.
    //--------------------------------------------------

    return null;

}