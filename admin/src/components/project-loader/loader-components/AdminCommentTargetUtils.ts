import { Vector3 } from "three";
import type { SavedProjectData } from "../ProjectTypes";
import type { AdminComment } from "../../../services/assets/adminCommentService";
import type { AdminCommentTargetDetail } from "../../../services/assets/adminCommentEvents";
import type { Corner } from "../engine/walls/Corner";
import type { Wall } from "../engine/walls/WallTypes";
import type { Region } from "../engine/regions/Polygon";
import { solveRegions } from "../engine/regions/RegionSolver";

export interface AdminWallFinishSide {
    regionId: string;
    wallId: string;
    materialId: string;
    side: 1 | -1;
}

function toVector3(
    value: {
        x: number;
        y: number;
        z: number;
    }
) {
    return new Vector3(
        value.x,
        value.y,
        value.z
    );
}

function convertCorners(
    projectData: SavedProjectData
): Corner[] {
    return projectData.corners.map(
        corner => ({
            id: corner.id,
            position:
                toVector3(
                    corner.position
                )
        })
    );
}

function convertWalls(
    projectData: SavedProjectData
): Wall[] {
    return projectData.walls.map(
        wall => ({
            id: wall.id,
            start: {
                id: wall.start.id,
                position:
                    toVector3(
                        wall.start.position
                    )
            },
            end: {
                id: wall.end.id,
                position:
                    toVector3(
                        wall.end.position
                    )
            }
        })
    );
}

export function getAdminCommentTargetPoint(
    projectData: SavedProjectData,
    target: {
        targetType: AdminCommentTargetDetail["targetType"];
        targetId: string | null;
        regionId?: string;
    }
): Vector3 | null {
    if (
        !target.targetId &&
        target.targetType !== "project"
    ) {
        return null;
    }

    if (
        target.targetType === "project"
    ) {
        const corners =
            projectData.corners;

        if (corners.length === 0) {
            return new Vector3(
                0,
                projectData.wallHeight * 0.5,
                0
            );
        }

        const center =
            corners.reduce(
                (
                    total,
                    corner
                ) => {
                    total.x +=
                        corner.position.x;
                    total.y +=
                        corner.position.y;
                    total.z +=
                        corner.position.z;

                    return total;
                },
                new Vector3()
            );

        center.divideScalar(
            corners.length
        );

        center.y =
            projectData.wallHeight *
            0.5;

        return center;
    }

    if (
        target.targetType === "wall"
    ) {
        const wall =
            projectData.walls.find(
                item =>
                    item.id ===
                    target.targetId
            );

        if (!wall) {
            return null;
        }

        return new Vector3(
            (
                wall.start.position.x +
                wall.end.position.x
            ) * 0.5,
            projectData.wallHeight *
                0.6,
            (
                wall.start.position.z +
                wall.end.position.z
            ) * 0.5
        );
    }

    if (
        target.targetType === "floor"
    ) {
        const corners =
            convertCorners(
                projectData
            );

        const walls =
            convertWalls(
                projectData
            );

        const regions =
            solveRegions(
                corners,
                walls
            );

        const region =
            regions.find(
                item =>
                    item.id ===
                    target.targetId
            );

        if (!region) {
            return null;
        }

        const regionCorners =
            region.corners ??
            [];

        if (
            regionCorners.length ===
            0
        ) {
            return null;
        }

        const center =
            regionCorners.reduce(
                (
                    total,
                    point
                ) =>
                    total.add(point),
                new Vector3()
            );

        center.divideScalar(
            regionCorners.length
        );

        center.y +=
            0.08;

        return center;
    }

    if (
        target.targetType ===
        "furniture"
    ) {
        const furniture =
            projectData.furniture.find(
                item =>
                    item.id ===
                    target.targetId
            );

        if (!furniture) {
            return null;
        }

        return new Vector3(
            furniture.position.x,
            furniture.position.y +
                furniture.height +
                0.25,
            furniture.position.z
        );
    }

    if (
        target.targetType ===
        "door"
    ) {
        const door =
            projectData.doors.find(
                item =>
                    item.id ===
                    target.targetId
            );

        if (!door) {
            return null;
        }

        return new Vector3(
            door.position.x,
            door.position.y +
                door.height +
                0.15,
            door.position.z
        );
    }

    if (
        target.targetType ===
        "window"
    ) {
        const window =
            projectData.windows.find(
                item =>
                    item.id ===
                    target.targetId
            );

        if (!window) {
            return null;
        }

        return new Vector3(
            window.position.x,
            window.position.y +
                window.height * 0.5,
            window.position.z
        );
    }

    if (
        target.targetType ===
        "opening"
    ) {
        const opening =
            projectData.openings.find(
                item =>
                    item.id ===
                    target.targetId
            );

        if (!opening) {
            return null;
        }

        return new Vector3(
            opening.position.x,
            opening.position.y +
                opening.height +
                0.15,
            opening.position.z
        );
    }

    return null;
}

export function getAdminCommentTargetFromComment(
    comment: AdminComment
): AdminCommentTargetDetail {
    return {
        targetType:
            comment.targetType,
        targetId:
            comment.targetId,
        targetLabel:
            comment.targetLabel,
        regionId:
            comment.regionId
    };
}

export function getRegionWallSide(
    wall: Wall,
    region: Region
): 1 | -1 | null {
    const direction = new Vector3()
        .subVectors(
            wall.end.position,
            wall.start.position
        );

    if (
        direction.lengthSq() <
        0.000001
    ) {
        return null;
    }

    direction.normalize();

    const normal = new Vector3(
        -direction.z,
        0,
        direction.x
    ).normalize();

    const wallCenter =
        wall.start.position
            .clone()
            .add(
                direction
                    .clone()
                    .multiplyScalar(
                        wall.start.position.distanceTo(
                            wall.end.position
                        ) * 0.5
                    )
            );

    const regionCorners = (
        region.corners ??
        []
    ).filter(Boolean);

    if (
        regionCorners.length ===
        0
    ) {
        return null;
    }

    const regionCenter =
        regionCorners.reduce(
            (
                center,
                point
            ) =>
                center.add(point),
            new Vector3()
        );

    regionCenter.divideScalar(
        regionCorners.length
    );

    const toRegion =
        regionCenter.sub(
            wallCenter
        );

    const sideValue =
        toRegion.x *
            normal.x +
        toRegion.z *
            normal.z;

    if (
        Math.abs(
            sideValue
        ) < 0.000001
    ) {
        return null;
    }

    return sideValue > 0
        ? 1
        : -1;
}

export function getWallFinishSides(
    wall: Wall,
    regions: Region[],
    wallFinishes: Record<
        string,
        Record<string, string>
    >
): AdminWallFinishSide[] {
    const finishes:
        AdminWallFinishSide[] = [];

    for (
        const region of regions
    ) {
        const belongsToRegion =
            region.walls.some(
                regionWall =>
                    regionWall.id ===
                    wall.id
            );

        if (
            !belongsToRegion
        ) {
            continue;
        }

        const materialId =
            wallFinishes[
                region.id
            ]?.[
                wall.id
            ];

        if (
            typeof materialId !==
                "string" ||
            materialId.trim() ===
                ""
        ) {
            continue;
        }

        const side =
            getRegionWallSide(
                wall,
                region
            );

        if (
            side === null
        ) {
            continue;
        }

        finishes.push({
            regionId:
                region.id,
            wallId:
                wall.id,
            materialId,
            side
        });
    }

    return finishes;
}