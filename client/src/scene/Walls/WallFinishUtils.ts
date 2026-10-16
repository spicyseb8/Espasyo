
import { Vector3 } from "three";

import type { Wall } from "../../engine/walls/WallTypes";
import type { Region } from "../../engine/regions/Polygon";

import { pointInPolygon } from "../../engine/regions/Polygon";

const WALL_SIDE_FINISH_BUCKET = "__wall_side_finishes__";

export interface WallFinishSide {
    regionId: string;
    wallId: string;
    materialId: string;
    side: 1 | -1;
}

export type WallSide = 1 | -1;

/**
 * Separate storage keys allow the two faces of one wall to
 * have different finishes.
 *
 * The existing wallId key remains supported for older finishes.
 */
export function getWallFinishSideKey(
    wallId: string,
    side: WallSide
): string {
    return `${wallId}::side:${side}`;
}

/**
 * Determines which side of a wall was clicked.
 *
 * +1 = normal side
 * -1 = opposite side
 */
export function getClickedWallSide(
    wall: Wall,
    clickPoint: Vector3
): WallSide {
    const start = wall.start.position;
    const end = wall.end.position;

    const direction = new Vector3().subVectors(end, start);
    const length = direction.length();

    if (length <= 0.001) {
        return 1;
    }

    direction.normalize();

    const normal = new Vector3(
        -direction.z,
        0,
        direction.x
    ).normalize();

    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const fromWall = clickPoint.clone().sub(midpoint);

    const signedDistance = fromWall.dot(normal);

    return signedDistance >= 0 ? 1 : -1;
}

function pointInsideRegion(
    point: Vector3,
    region: Region
): boolean {
    const loops = region.boundaryLoops ?? [];

    if (loops.length === 0) {
        return pointInPolygon(point, region.corners);
    }

    const outer = loops[0]?.corners ?? [];

    if (
        outer.length < 3 ||
        !pointInPolygon(point, outer)
    ) {
        return false;
    }

    for (let i = 1; i < loops.length; i++) {
        const hole = loops[i].corners;

        if (
            hole.length >= 3 &&
            pointInPolygon(point, hole)
        ) {
            return false;
        }
    }

    return true;
}

/**
 * Determines which side of a wall faces a room region.
 *
 * +1 = wall normal side
 * -1 = opposite wall normal side
 */
export function getRegionWallSide(
    wall: Wall,
    region: Region
): WallSide | null {
    const start = wall.start.position;
    const end = wall.end.position;

    const direction = new Vector3().subVectors(end, start);
    const length = direction.length();

    if (length <= 0.001) {
        return null;
    }

    direction.normalize();

    const normal = new Vector3(
        -direction.z,
        0,
        direction.x
    ).normalize();

    const sampleDistances = [
        length * 0.25,
        length * 0.5,
        length * 0.75
    ];

    const testOffset = Math.max(
        0.02,
        Math.min(0.08, length * 0.02)
    );

    let positiveCount = 0;
    let negativeCount = 0;

    for (const distance of sampleDistances) {
        const center = start.clone().add(
            direction.clone().multiplyScalar(distance)
        );

        const positivePoint = center.clone().add(
            normal.clone().multiplyScalar(testOffset)
        );

        const negativePoint = center.clone().sub(
            normal.clone().multiplyScalar(testOffset)
        );

        if (pointInsideRegion(positivePoint, region)) {
            positiveCount++;
        }

        if (pointInsideRegion(negativePoint, region)) {
            negativeCount++;
        }
    }

    if (positiveCount > negativeCount) {
        return 1;
    }

    if (negativeCount > positiveCount) {
        return -1;
    }

    return null;
}

/**
 * Returns finishes for both physical faces of the wall.
 *
 * New format:
 * wallFinishes[regionId][`${wallId}::side:1`]
 * wallFinishes[regionId][`${wallId}::side:-1`]
 *
 * Legacy format:
 * wallFinishes[regionId][wallId]
 *
 * Legacy finishes continue to be assigned to the side facing
 * their existing room region.
 */
export function getWallFinishSides(
    wall: Wall,
    regions: Region[],
    wallFinishes: Record<string, Record<string, string>>
): WallFinishSide[] {
    const explicitFinishes = new Map<WallSide, WallFinishSide>();
    const legacyFinishes = new Map<WallSide, WallFinishSide>();

    for (const region of regions) {
        const belongsToRegion = region.walls.some(
            regionWall => regionWall.id === wall.id
        );

        if (!belongsToRegion) {
            continue;
        }

        const regionFinishes = wallFinishes[region.id];

        if (!regionFinishes) {
            continue;
        }

        // Read older room-based finishes.
        const legacyMaterialId = regionFinishes[wall.id];
        const regionSide = getRegionWallSide(wall, region);

        if (legacyMaterialId && regionSide !== null) {
            legacyFinishes.set(regionSide, {
                regionId: region.id,
                wallId: wall.id,
                materialId: legacyMaterialId,
                side: regionSide
            });
        }

        // Read independently saved finishes for each face.
        for (const side of [1, -1] as const) {
            const sideKey = getWallFinishSideKey(wall.id, side);
            const materialId = regionFinishes[sideKey];

            if (!materialId) {
                continue;
            }

            explicitFinishes.set(side, {
                regionId: region.id,
                wallId: wall.id,
                materialId,
                side
            });
        }
    }

    const globalSideFinishes =
        wallFinishes[WALL_SIDE_FINISH_BUCKET];

    if (globalSideFinishes) {
        for (const side of [1, -1] as const) {
            const materialId = globalSideFinishes[
                getWallFinishSideKey(wall.id, side)
            ];

            if (materialId) {
                explicitFinishes.set(side, {
                    regionId: WALL_SIDE_FINISH_BUCKET,
                    wallId: wall.id,
                    materialId,
                    side
                });
            }
        }
    }

    // Explicit side-specific finishes take priority over legacy data.
    const result = new Map<WallSide, WallFinishSide>(legacyFinishes);

    for (const [side, finish] of explicitFinishes) {
        result.set(side, finish);
    }

    return Array.from(result.values());
}
