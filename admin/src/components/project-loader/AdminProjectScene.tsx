import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Vector3 } from "three";
import AdminGrid from "./loader-components/AdminGrid";
import AdminLights from "./loader-components/AdminLights";
import AdminCamera from "./loader-components/AdminCamera";
import AdminFloors from "./loader-components/AdminFloors";
import AdminWalls from "./loader-components/AdminWalls";
import AdminDoors from "./loader-components/AdminDoors";
import AdminFurnitures from "./loader-components/AdminFurnitures";
import AdminWindows from "./loader-components/AdminWindows";
import AdminCommentMarkers from "./AdminCommentMarkers";
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
import type { AdminComment } from "@/services/assets/adminCommentService";
import type {
    AdminCommentTargetDetail,
    AdminCommentFocusRequest
} from "@/services/assets/adminCommentEvents";
import {
    ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
    ADMIN_COMMENT_FOCUS_REQUEST_EVENT,
    emitAdminCommentFocus
} from "@/services/assets/adminCommentEvents";
import { getAdminCommentTargetPoint } from "./loader-components/AdminCommentTargetUtils";

interface AdminProjectSceneProps {
    projectData: SavedProjectData;
    comments: AdminComment[];
    activeTarget: AdminCommentTargetDetail | null;
    visibleCommentId: string | null;
}

export default function AdminProjectScene({
    projectData,
    comments,
    activeTarget,
    visibleCommentId
}: AdminProjectSceneProps) {
    const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

    const corners: Corner[] =
        projectData.corners.map(
            convertCorner
        );

    const walls: Wall[] =
        projectData.walls.map(
            convertWall
        );

    const doors: AdminDoorData[] =
        projectData.doors.map(
            convertDoor
        );

    const windows: AdminWindowData[] =
        projectData.windows.map(
            convertWindow
        );

    const openings: AdminOpeningData[] =
        projectData.openings.map(
            convertOpening
        );

    useEffect(() => {
        const handleFocusRequest = (event: Event) => {
            const customEvent =
                event as CustomEvent<AdminCommentFocusRequest>;

            const commentId =
                customEvent.detail?.commentId;

            if (!commentId) {
                return;
            }

            const comment =
                comments.find(
                    item =>
                        item.id ===
                        commentId
                );

            if (!comment) {
                return;
            }

            const point =
                getAdminCommentTargetPoint(
                    projectData,
                    {
                        targetType:
                            comment.targetType,
                        targetId:
                            comment.targetId,
                        regionId:
                            comment.regionId
                    }
                );

            if (!point) {
                return;
            }

            setFocusedCommentId(
                commentId
            );

            emitAdminCommentFocus({
                commentId,
                position: {
                    x: point.x,
                    y: point.y,
                    z: point.z
                }
            });
        };

        const handleFocusComplete = (event: Event) => {
            const customEvent =
                event as CustomEvent<string>;

            if (
                customEvent.detail ===
                focusedCommentId
            ) {
                setFocusedCommentId(
                    null
                );
            }
        };

        window.addEventListener(
            ADMIN_COMMENT_FOCUS_REQUEST_EVENT,
            handleFocusRequest
        );

        window.addEventListener(
            ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
            handleFocusComplete
        );

        return () => {
            window.removeEventListener(
                ADMIN_COMMENT_FOCUS_REQUEST_EVENT,
                handleFocusRequest
            );

            window.removeEventListener(
                ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
                handleFocusComplete
            );
        };
    }, [
        comments,
        projectData,
        focusedCommentId
    ]);

    return (
        <Canvas
            shadows
            camera={{
                position: [
                    8,
                    8,
                    8
                ],
                fov: 50
            }}
            style={{
                width: "100%",
                height: "100%"
            }}
        >
            <color
                attach="background"
                args={[
                    "#f5f5f3"
                ]}
            />

            <AdminLights
                corners={
                    corners
                }
            />

            <AdminGrid />

            <AdminCamera />

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

            <AdminDoors
                doors={
                    projectData.doors
                }
                wallThickness={
                    projectData.wallThickness
                }
            />

            <AdminWindows
                windows={
                    projectData.windows
                }
                wallThickness={
                    projectData.wallThickness
                }
            />

            <AdminFurnitures
                furniture={
                    projectData.furniture
                }
            />

            <AdminCommentMarkers
                projectData={
                    projectData
                }
                comments={
                    comments
                }
                focusedCommentId={
                    focusedCommentId
                }
                visibleCommentId={
                    visibleCommentId
                }
                activeTarget={
                    activeTarget
                }
            />
        </Canvas>
    );
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
        position: toVector3(
            corner.position
        )
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
        position: toVector3(
            door.position
        ),
        width: door.width,
        height: door.height
    };
}

function convertWindow(
    window: SavedWindow
): AdminWindowData {
    return {
        id: window.id,
        wallId: window.wallId,
        position: toVector3(
            window.position
        ),
        width: window.width,
        height: window.height
    };
}

function convertOpening(
    opening: SavedOpening
): AdminOpeningData {
    return {
        id: opening.id,
        wallId: opening.wallId,
        position: toVector3(
            opening.position
        ),
        width: opening.width,
        height: opening.height,
        shape: opening.shape
    };
}