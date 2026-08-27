import {
    Vector3
} from "three";

import type {
    Wall
} from "../../engine/walls/WallTypes";

import type {
    Region
} from "../../engine/regions/Polygon";

import {
    pointInPolygon
} from "../../engine/regions/Polygon";

export interface WallFinishSide {

    regionId: string;

    wallId: string;

    materialId: string;

    side: 1 | -1;
}

//==================================================
// Check whether a point is inside the actual
// usable region surface.
//
// Outer boundary = inside
// Child boundaries / holes = outside
//==================================================

function pointInsideRegion(
    point: Vector3,
    region: Region
): boolean {

    const loops =
        region.boundaryLoops ?? [];

    if (
        loops.length === 0
    ) {

        return pointInPolygon(
            point,
            region.corners
        );

    }

    //--------------------------------------------------
    // Outer boundary
    //--------------------------------------------------

    const outer =
        loops[0]?.corners ?? [];

    if (
        outer.length < 3 ||
        !pointInPolygon(
            point,
            outer
        )
    ) {

        return false;

    }

    //--------------------------------------------------
    // Holes
    //--------------------------------------------------

    for (
        let i = 1;
        i < loops.length;
        i++
    ) {

        const hole =
            loops[i].corners;

        if (
            hole.length >= 3 &&
            pointInPolygon(
                point,
                hole
            )
        ) {

            return false;

        }
    }

    return true;
}

//==================================================
// Determine which side of the physical wall faces
// the selected region.
//
// +1 = wall normal side
// -1 = opposite wall normal side
//==================================================

export function getRegionWallSide(
    wall: Wall,
    region: Region
): 1 | -1 | null {

    const start =
        wall.start.position;

    const end =
        wall.end.position;

    //--------------------------------------------------
    // Wall direction
    //--------------------------------------------------

    const direction =
        new Vector3()
            .subVectors(
                end,
                start
            );

    const length =
        direction.length();

    if (
        length <= 0.001
    ) {

        return null;

    }

    direction.normalize();

    //--------------------------------------------------
    // Wall normal
    //--------------------------------------------------

    const normal =
        new Vector3(
            -direction.z,
            0,
            direction.x
        ).normalize();

    //--------------------------------------------------
    // Use several points along the wall.
    //
    // This is more reliable than testing only the
    // exact midpoint, especially with unusual room shapes.
    //--------------------------------------------------

    const sampleDistances = [
        length * 0.25,
        length * 0.50,
        length * 0.75
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    const testOffset =
        Math.max(
            0.02,
            Math.min(
                0.08,
                length * 0.02
            )
        );

    for (
        const distance of
        sampleDistances
    ) {

        const center =
            start.clone()
                .add(
                    direction
                        .clone()
                        .multiplyScalar(
                            distance
                        )
                );

        const positivePoint =
            center.clone()
                .add(
                    normal
                        .clone()
                        .multiplyScalar(
                            testOffset
                        )
                );

        const negativePoint =
            center.clone()
                .sub(
                    normal
                        .clone()
                        .multiplyScalar(
                            testOffset
                        )
                );

        if (
            pointInsideRegion(
                positivePoint,
                region
            )
        ) {

            positiveCount += 1;

        }

        if (
            pointInsideRegion(
                negativePoint,
                region
            )
        ) {

            negativeCount += 1;

        }

    }

    //--------------------------------------------------
    // Determine dominant side
    //--------------------------------------------------

    if (
        positiveCount >
        negativeCount
    ) {

        return 1;

    }

    if (
        negativeCount >
        positiveCount
    ) {

        return -1;

    }

    return null;
}

//==================================================
// Get all finishes that belong to a wall.
//
// A shared wall can return TWO entries:
//
// Region A → side +1
// Region B → side -1
//==================================================

export function getWallFinishSides(
    wall: Wall,
    regions: Region[],
    wallFinishes:
        Record<
            string,
            Record<string, string>
        >
): WallFinishSide[] {

    const result:
        WallFinishSide[] = [];

    for (
        const region of regions
    ) {

        //--------------------------------------------------
        // Is this wall part of this room?
        //--------------------------------------------------

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

        //--------------------------------------------------
        // Get selected material
        //--------------------------------------------------

        const materialId =
            wallFinishes[
                region.id
            ]?.[
                wall.id
            ];

        if (
            !materialId
        ) {

            continue;

        }

        //--------------------------------------------------
        // Determine which physical wall side faces
        // this room.
        //--------------------------------------------------

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

        result.push({

            regionId:
                region.id,

            wallId:
                wall.id,

            materialId,

            side

        });

    }

    return result;
}