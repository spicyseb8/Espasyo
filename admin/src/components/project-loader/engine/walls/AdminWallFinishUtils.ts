
import { Vector3 } from "three";
import type { Wall } from "./WallTypes";
import type { Region } from "../regions/Polygon";

export interface AdminWallFinishSide {
    regionId: string;
    wallId: string;
    materialId: string;
    side: 1 | -1;
}

const WALL_SIDE_FINISH_BUCKET = "__wall_side_finishes__";

export function getRegionWallSide(
    wall: Wall,
    region: Region
): 1 | -1 | null {
    const direction = new Vector3().subVectors(
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
        region.corners ?? []
    ).filter(Boolean);

    if (regionCorners.length === 0) {
        return null;
    }

    const regionCenter = regionCorners.reduce(
        (center, point) => center.add(point),
        new Vector3()
    );

    regionCenter.divideScalar(regionCorners.length);

    const toRegion = regionCenter.sub(wallCenter);

    const sideValue =
        toRegion.x * normal.x +
        toRegion.z * normal.z;

    if (Math.abs(sideValue) < 0.000001) {
        return null;
    }

    return sideValue > 0 ? 1 : -1;
}

export function getWallFinishSides(
    wall: Wall,
    regions: Region[],
    wallFinishes: Record<string, Record<string, string>>
): AdminWallFinishSide[] {
    // First, load the existing finishes assigned to room regions.
    const finishesBySide = new Map<
        1 | -1,
        AdminWallFinishSide
    >();

    for (const region of regions) {
        const belongsToRegion = region.walls.some(
            regionWall => regionWall.id === wall.id
        );

        if (!belongsToRegion) {
            continue;
        }

        const materialId = wallFinishes[region.id]?.[wall.id];

        if (
            typeof materialId !== "string" ||
            materialId.trim() === ""
        ) {
            continue;
        }

        const side = getRegionWallSide(wall, region);

        if (side === null) {
            continue;
        }

        finishesBySide.set(side, {
            regionId: region.id,
            wallId: wall.id,
            materialId,
            side
        });
    }

    // Then, load independently painted wall sides saved by the client.
    const sideFinishBucket =
        wallFinishes[WALL_SIDE_FINISH_BUCKET] ?? {};

    const sideKeyPrefix = `${wall.id}::side:`;

    for (const [key, materialId] of Object.entries(
        sideFinishBucket
    )) {
        if (!key.startsWith(sideKeyPrefix)) {
            continue;
        }

        if (
            typeof materialId !== "string" ||
            materialId.trim() === ""
        ) {
            continue;
        }

        const sideValue = key.slice(sideKeyPrefix.length);

        let side: 1 | -1;

        if (sideValue === "1") {
            side = 1;
        } else if (sideValue === "-1") {
            side = -1;
        } else {
            continue;
        }

        // An explicitly painted side takes priority over its room finish.
        finishesBySide.set(side, {
            regionId: WALL_SIDE_FINISH_BUCKET,
            wallId: wall.id,
            materialId,
            side
        });
    }

    return Array.from(finishesBySide.values());
}
