import { Vector3 } from "three";
import type { Wall } from "./WallTypes";
import type { Region } from "../regions/Polygon";

export interface AdminWallFinishSide {
    regionId: string;
    wallId: string;
    materialId: string;
    side: 1 | -1;
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

    if (direction.lengthSq() < 0.000001) {
        return null;
    }

    direction.normalize();

    const normal = new Vector3(
        -direction.z,
        0,
        direction.x
    ).normalize();

    const wallCenter = wall.start.position
        .clone()
        .add(
            direction.clone().multiplyScalar(
                wall.start.position.distanceTo(
                    wall.end.position
                ) * 0.5
            )
        );

    const regionCorners = (
        region.corners ??
        []
    ).filter(Boolean);

    if (regionCorners.length === 0) {
        return null;
    }

    const regionCenter = regionCorners.reduce(
        (
            center,
            point
        ) => center.add(point),
        new Vector3()
    );

    regionCenter.divideScalar(
        regionCorners.length
    );

    const toRegion = regionCenter
        .sub(wallCenter);

    const sideValue =
        toRegion.x * normal.x +
        toRegion.z * normal.z;

    if (Math.abs(sideValue) < 0.000001) {
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
    const finishes: AdminWallFinishSide[] = [];

    for (const region of regions) {
        const belongsToRegion =
            region.walls.some(
                regionWall =>
                    regionWall.id ===
                    wall.id
            );

        if (!belongsToRegion) {
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
            materialId.trim() === ""
        ) {
            continue;
        }

        const side =
            getRegionWallSide(
                wall,
                region
            );

        if (side === null) {
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