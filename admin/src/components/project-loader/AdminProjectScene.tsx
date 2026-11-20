import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Vector3 } from "three";

import AdminLights from "./loader-components/AdminLights";
import AdminCamera from "./loader-components/AdminCamera";
import AdminFloors from "./loader-components/AdminFloors";
import AdminWalls from "./loader-components/AdminWalls";
import AdminDoors from "./loader-components/AdminDoors";
import AdminFurnitures from "./loader-components/AdminFurnitures";
import AdminWindows from "./loader-components/AdminWindows";
import {
    AdminProceduralStaircase,
    AdminStaircaseLandingMarker
} from "../project-editor/AdminProceduralStaircase";

import type { Corner } from "./engine/walls/Corner";
import type { Wall } from "./engine/walls/WallTypes";
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

interface AdminProjectSceneProps {
    projectData: SavedProjectData;
    onAssetError: (assetId: string) => void;
    onReady: () => void;
}

export default function AdminProjectScene({
    projectData,
    onAssetError,
    onReady
}: AdminProjectSceneProps) {
    const corners: Corner[] =
        projectData.corners.map(convertCorner);

    const walls: Wall[] =
        projectData.walls.map(convertWall);

    const doors: AdminDoorData[] =
        projectData.doors.map(convertDoor);

    const windows: AdminWindowData[] =
        projectData.windows.map(convertWindow);

    const openings: AdminOpeningData[] =
        projectData.openings.map(convertOpening);

    return (
        <Canvas
            shadows="percentage"
            camera={{
                position: [8, 8, 8],
                fov: 50
            }}
            style={{
                width: "100%",
                height: "100%"
            }}
        >
            <color
                attach="background"
                args={["#ffffff"]}
            />

            <Suspense fallback={null}>
                <AdminLights
                    corners={corners}
                />

                <AdminCamera />

                <AdminFloors
                    corners={corners}
                    walls={walls}
                    floorFinishes={projectData.floorFinishes}
                    floorPaintSeparators={projectData.floorPaintSeparators ?? {}}
                />

                <AdminWalls
                    corners={corners}
                    walls={walls}
                    doors={doors}
                    windows={windows}
                    openings={openings}
                    wallHeight={projectData.wallHeight}
                    wallThickness={projectData.wallThickness}
                    wallFinishes={projectData.wallFinishes}
                    wallPaintSeparators={projectData.wallPaintSeparators ?? {}}
                />

                <AdminDoors
                    doors={projectData.doors}
                    wallThickness={projectData.wallThickness}
                />

                <AdminWindows
                    windows={projectData.windows}
                    wallThickness={projectData.wallThickness}
                />

                {(projectData.stairs ?? []).map(stair => (
                    <AdminProceduralStaircase key={stair.id} stair={stair} />
                ))}

                {(projectData.stairLandings ?? []).map(landing => (
                    <AdminStaircaseLandingMarker key={landing.id} landing={landing} />
                ))}

                <AdminFurnitures
                    furniture={projectData.furniture}
                    onAssetError={onAssetError}
                />

                <SceneReadySignal onReady={onReady} />
            </Suspense>
        </Canvas>
    );
}

function SceneReadySignal({ onReady }: { onReady: () => void }) {
    useEffect(() => {
        onReady();
    }, [onReady]);

    return null;
}

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

function convertCorner(
    corner: SavedCorner
): Corner {
    return {
        id: corner.id,
        position: toVector3(corner.position)
    };
}

function convertWall(
    wall: SavedWall
): Wall {
    return {
        id: wall.id,
        start: {
            id: wall.start.id,
            position: toVector3(
                wall.start.position
            )
        },
        end: {
            id: wall.end.id,
            position: toVector3(
                wall.end.position
            )
        }
    };
}

function convertDoor(
    door: SavedDoor
): AdminDoorData {
    return {
        id: door.id,
        wallId: door.wallId,
        position: toVector3(door.position),
        width: door.width,
        height: door.height,
        wallWidth: door.wallWidth ?? door.width
    };
}

function convertWindow(
    window: SavedWindow
): AdminWindowData {
    return {
        id: window.id,
        wallId: window.wallId,
        position: toVector3(window.position),
        width: window.width,
        height: window.height,
        wallWidth: window.wallWidth ?? window.width
    };
}

function convertOpening(
    opening: SavedOpening
): AdminOpeningData {
    return {
        id: opening.id,
        wallId: opening.wallId,
        position: toVector3(opening.position),
        width: opening.width,
        height: opening.height,
        shape: opening.shape,
        archRise: opening.archRise
    };
}
