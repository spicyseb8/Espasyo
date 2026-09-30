import {
    Canvas
} from "@react-three/fiber";

import {
    Vector3
} from "three";

import AdminGrid
    from "./loader-components/AdminGrid";

import AdminLights
    from "./loader-components/AdminLights";

import AdminCamera
    from "./loader-components/AdminCamera";

import AdminFloors
    from "./loader-components/AdminFloors";

import AdminWalls
    from "./loader-components/AdminWalls";
import AdminDoors
    from "./loader-components/AdminDoors";
import AdminFurnitures
    from "./loader-components/AdminFurnitures";
import AdminWindows
    from "./loader-components/AdminWindows";
import type {
    Corner
} from "./engine/walls/Corner";

import type {
    Wall
} from "./engine/walls/WallTypes";

import type {
    AdminDoorData,
    AdminWindowData,
    AdminOpeningData
} from "./engine/walls/AdminWallMeshBuilder";

import type {
    SavedProjectData,
    SavedCorner,
    SavedWall,
    SavedDoor,
    SavedWindow,
    SavedOpening
} from "./ProjectTypes";


//==================================================
// PROPS
//==================================================

interface AdminProjectSceneProps {

    projectData:
        SavedProjectData;

}


//==================================================
// ADMIN PROJECT SCENE
//==================================================

export default function AdminProjectScene({
    projectData
}: AdminProjectSceneProps) {

    //==================================================
    // CONVERT SAVED CORNERS
    //==================================================
        console.warn(
        "ADMIN PROJECT SCENE IS RUNNING",
        projectData
    );
    const corners:
        Corner[] =

        projectData.corners.map(
            corner =>
                convertCorner(
                    corner
                )
        );


    //==================================================
    // CONVERT SAVED WALLS
    //==================================================

    const walls:
        Wall[] =

        projectData.walls.map(
            wall =>
                convertWall(
                    wall
                )
        );
        console.log("ADMIN SCENE DATA", {
    cornerCount: corners.length,
    wallCount: walls.length,

    corners: corners.map(
        corner => ({
            id: corner.id,
            x: corner.position.x,
            y: corner.position.y,
            z: corner.position.z
        })
    ),

    walls: walls.map(
        wall => ({
            id: wall.id,
            start: wall.start.position.toArray(),
            end: wall.end.position.toArray()
        })
    ),

    wallHeight: projectData.wallHeight,
    wallThickness: projectData.wallThickness
});

    //==================================================
    // CONVERT SAVED DOORS
    //==================================================

    const doors:
        AdminDoorData[] =

        projectData.doors.map(
            door =>
                convertDoor(
                    door
                )
        );


    //==================================================
    // CONVERT SAVED WINDOWS
    //==================================================

    const windows:
        AdminWindowData[] =

        projectData.windows.map(
            window =>
                convertWindow(
                    window
                )
        );


    //==================================================
    // CONVERT SAVED OPENINGS
    //==================================================

    const openings:
        AdminOpeningData[] =

        projectData.openings.map(
            opening =>
                convertOpening(
                    opening
                )
        );


    //==================================================
    // RENDER
    //==================================================

    return (

        <Canvas

            shadows

            camera={{
                position: [
                    8,
                    8,
                    8
                ],

                fov:
                    50
            }}
            
            style={{
                width:
                    "100%",

                height:
                    "100%"
            }}

        >
            <color
    attach="background"
    args={["#ffffff"]}
/>
            {/*==================================================
                LIGHTING
            ==================================================*/}
            <AdminLights
                corners={
                    corners
                }
            />


            {/*==================================================
                GRID
            ==================================================*/}
            <AdminGrid />


            {/*==================================================
                CAMERA
            ==================================================*/}
            <AdminCamera />


            {/*==================================================
                FLOORS
            ==================================================*/}
            <AdminFloors

                corners={
                    corners
                }

                walls={
                    walls
                }

                floorFinishes={
                    projectData.floorFinishes
                }

            />


            {/*==================================================
                WALLS
            ==================================================*/}
            <AdminWalls

                corners={
                    corners
                }

                walls={
                    walls
                }

                doors={
                    doors
                }

                windows={
                    windows
                }

                openings={
                    openings
                }

                wallHeight={
                    projectData.wallHeight
                }

                wallThickness={
                    projectData.wallThickness
                }

                wallFinishes={
                    projectData.wallFinishes
                }

            />
            {/*==================================================
    DOORS
==================================================*/}
<AdminDoors

    doors={
        projectData.doors
    }

    wallThickness={
        projectData.wallThickness
    }

/>


{/*==================================================
    WINDOWS
==================================================*/}
<AdminWindows

    windows={
        projectData.windows
    }

    wallThickness={
        projectData.wallThickness
    }

/>
{/*==================================================
    FURNITURE
==================================================*/}
<AdminFurnitures

    furniture={
        projectData.furniture
    }

/>
        </Canvas>

    );

}


//==================================================
// VECTOR CONVERSION
//==================================================

function toVector3(
    value: {
        x: number;
        y: number;
        z: number;
    }
): Vector3 {

    return new Vector3(

        value.x,
        value.y,
        value.z

    );

}


//==================================================
// CORNER
//==================================================

function convertCorner(
    corner:
        SavedCorner
): Corner {

    return {

        id:
            corner.id,

        position:
            toVector3(
                corner.position
            )

    };

}


//==================================================
// WALL
//==================================================

function convertWall(
    wall:
        SavedWall
): Wall {

    return {

        id:
            wall.id,

        start: {

            id:
                wall.start.id,

            position:
                toVector3(
                    wall.start.position
                )

        },

        end: {

            id:
                wall.end.id,

            position:
                toVector3(
                    wall.end.position
                )

        }

    };

}


//==================================================
// DOOR
//==================================================

function convertDoor(
    door:
        SavedDoor
): AdminDoorData {

    return {

        id:
            door.id,

        wallId:
            door.wallId,

        position:
            toVector3(
                door.position
            ),

        width:
            door.width,

        height:
            door.height

    };

}


//==================================================
// WINDOW
//==================================================

function convertWindow(
    window:
        SavedWindow
): AdminWindowData {

    return {

        id:
            window.id,

        wallId:
            window.wallId,

        position:
            toVector3(
                window.position
            ),

        width:
            window.width,

        height:
            window.height

    };

}


//==================================================
// OPENING
//==================================================

function convertOpening(
    opening:
        SavedOpening
): AdminOpeningData {

    return {

        id:
            opening.id,

        wallId:
            opening.wallId,

        position:
            toVector3(
                opening.position
            ),

        width:
            opening.width,

        height:
            opening.height,

        shape:
            opening.shape

    };

}