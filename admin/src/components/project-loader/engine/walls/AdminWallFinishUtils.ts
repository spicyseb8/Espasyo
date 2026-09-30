import {
    Vector3
} from "three";

import type {
    Wall
} from "./WallTypes";

import type {
    Region
} from "../regions/Polygon";

import {
    pointInPolygon
} from "../regions/Polygon";


export interface AdminWallFinishSide {

    regionId:
        string;

    wallId:
        string;

    materialId:
        string;

    side:
        1 | -1;

}


//==================================================
// POINT INSIDE REGION
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
// DETERMINE REGION WALL SIDE
//==================================================

export function getRegionWallSide(
    wall: Wall,
    region: Region
):
    1 | -1 | null {

    const start =
        wall.start.position;


    const end =
        wall.end.position;


    const direction =
        new Vector3()
            .subVectors(
                end,
                start
            );


    const length =
        direction.length();


    if (
        length <=
        0.001
    ) {

        return null;

    }


    direction.normalize();


    const normal =
        new Vector3(
            -direction.z,
            0,
            direction.x
        ).normalize();


    const sampleDistances = [

        length * 0.25,

        length * 0.50,

        length * 0.75

    ];


    let positiveCount =
        0;

    let negativeCount =
        0;


    const testOffset =
        Math.max(

            0.02,

            Math.min(
                0.08,
                length * 0.02
            )

        );


    for (
        const distance
        of sampleDistances
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

            positiveCount++;

        }


        if (
            pointInsideRegion(
                negativePoint,
                region
            )
        ) {

            negativeCount++;

        }

    }


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
// GET WALL FINISH SIDES
//==================================================

export function getWallFinishSides(
    wall: Wall,
    regions: Region[],
    wallFinishes:
        Record<
            string,
            Record<string, string>
        >
):
    AdminWallFinishSide[] {

    const result:
        AdminWallFinishSide[] = [];


    for (
        const region
        of regions
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
            !materialId
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