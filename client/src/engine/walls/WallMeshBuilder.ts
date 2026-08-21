import { Vector3 } from "three";

import type { Wall } from "./WallTypes";

import type { Door } from "../doors/DoorTypes";

import type { Opening } from "../openings/OpeningTypes";

import type { WallPiece } from "./WallPiece";


interface WallCutout {

    position: Vector3;

    width: number;

    height: number;

    openingStart: number;

    openingEnd: number;

    type: "door" | "opening";

    shape?: "rectangle" | "arch";

}


export function buildWallMeshes(

    wall: Wall,

    wallHeight: number,

    wallThickness: number,

    doors: Door[] = [],

    openings: Opening[] = []

): WallPiece[] {


    // ==================================================
    // WALL DIRECTION
    // ==================================================

    const direction =
        new Vector3()
            .subVectors(
                wall.end.position,
                wall.start.position
            );


    const wallLength =
        direction.length();


    if (wallLength <= 0.001) {
        return [];
    }


    direction.normalize();


    // ==================================================
    // WALL ROTATION
    // ==================================================

    const rotationY =
        Math.atan2(
            direction.z,
            direction.x
        );


    // ==================================================
    // COLLECT CUTOUTS
    // ==================================================

    const cutouts: WallCutout[] = [];


    // ==================================================
    // DOORS
    // ==================================================

    for (const door of doors) {

        if (door.wallId !== wall.id) {
            continue;
        }


        const distance =
            door.position
                .clone()
                .sub(wall.start.position)
                .dot(direction);


        const openingStart =
            Math.max(
                0,
                distance - door.width * 0.5
            );


        const openingEnd =
            Math.min(
                wallLength,
                distance + door.width * 0.5
            );


        if (openingEnd <= openingStart) {
            continue;
        }


        cutouts.push({

            position:
                door.position.clone(),

            width:
                openingEnd - openingStart,

            height:
                door.height,

            openingStart,

            openingEnd,

            type: "door"

        });

    }


    // ==================================================
    // OPENINGS
    // ==================================================

    for (const opening of openings) {

        if (opening.wallId !== wall.id) {
            continue;
        }


        const distance =
            opening.position
                .clone()
                .sub(wall.start.position)
                .dot(direction);


        const openingStart =
            Math.max(
                0,
                distance - opening.width * 0.5
            );


        const openingEnd =
            Math.min(
                wallLength,
                distance + opening.width * 0.5
            );


        if (openingEnd <= openingStart) {
            continue;
        }


        cutouts.push({

            position:
                opening.position.clone(),

            width:
                openingEnd - openingStart,

            height:
                opening.height,

            openingStart,

            openingEnd,

            type: "opening",

            shape:
                opening.shape

        });

    }


    // ==================================================
    // NO CUTOUTS
    // ==================================================

    if (cutouts.length === 0) {

        const center =
            new Vector3(

                (
                    wall.start.position.x +
                    wall.end.position.x
                ) / 2,

                wallHeight * 0.5,

                (
                    wall.start.position.z +
                    wall.end.position.z
                ) / 2

            );


        return [

            {

                position: center,

                rotationY,

                width: wallLength,

                height: wallHeight,

                thickness: wallThickness,

                kind: "full"

            }

        ];

    }


    // ==================================================
    // SORT CUTOUTS
    // ==================================================

    cutouts.sort(

        (a, b) =>
            a.openingStart -
            b.openingStart

    );


    const pieces: WallPiece[] = [];


    let cursor = 0;


    // ==================================================
    // BUILD WALL AROUND CUTOUTS
    // ==================================================

    for (const cutout of cutouts) {


        // --------------------------------------------------
        // Ignore overlapping cutouts
        // --------------------------------------------------

        if (
            cutout.openingEnd <=
            cursor
        ) {

            continue;

        }


        const cutoutStart =
            Math.max(
                cursor,
                cutout.openingStart
            );


        // --------------------------------------------------
        // WALL BEFORE OPENING
        // --------------------------------------------------

        const segmentWidth =
            cutoutStart -
            cursor;


        if (segmentWidth > 0.001) {

            const segmentCenter =
                wall.start.position
                    .clone()
                    .add(

                        direction.clone()
                            .multiplyScalar(

                                cursor +
                                segmentWidth * 0.5

                            )

                    );


            segmentCenter.y =
                wallHeight * 0.5;


            pieces.push({

                position:
                    segmentCenter,

                rotationY,

                width:
                    segmentWidth,

                height:
                    wallHeight,

                thickness:
                    wallThickness,

                kind: "left"

            });

        }


        // ==================================================
        // ARCH OPENING
        // ==================================================

        if (
            cutout.type === "opening" &&
            cutout.shape === "arch"
        ) {

            /*
             * The arch geometry itself will be rendered
             * by WallPiece.tsx.
             *
             * Here we only tell WallPiece where the
             * arch section belongs and how large it is.
             */


            const archWidth =
                cutout.openingEnd -
                cutoutStart;


            const archCenter =
                wall.start.position
                    .clone()
                    .add(

                        direction.clone()
                            .multiplyScalar(

                                cutoutStart +
                                archWidth * 0.5

                            )

                    );


            /*
             * IMPORTANT:
             *
             * WallPiece's arch geometry is centered
             * vertically around its position.
             *
             * The position therefore represents
             * the center of the wall section.
             */

            archCenter.y =
                wallHeight * 0.5;


            pieces.push({

                position:
                    archCenter,

                rotationY,

                width:
                    archWidth,

                height:
                    wallHeight,

                thickness:
                    wallThickness,

                kind: "arch",

                arch: {

                    openingWidth:
                        archWidth,

                    openingHeight:
                        cutout.height

                }

            });


            // --------------------------------------------------
            // Move past arch
            // --------------------------------------------------

            cursor =
                Math.max(
                    cursor,
                    cutout.openingEnd
                );


            continue;

        }


        // ==================================================
        // NORMAL RECTANGLE / DOOR
        // ==================================================

        const cutoutWidth =
            cutout.openingEnd -
            cutoutStart;


        const headerHeight =
            Math.max(

                0,

                wallHeight -
                cutout.height

            );


        if (headerHeight > 0.001) {

            const headerCenter =
                wall.start.position
                    .clone()
                    .add(

                        direction.clone()
                            .multiplyScalar(

                                cutoutStart +
                                cutoutWidth * 0.5

                            )

                    );


            headerCenter.y =
                cutout.height +
                headerHeight * 0.5;


            pieces.push({

                position:
                    headerCenter,

                rotationY,

                width:
                    cutoutWidth,

                height:
                    headerHeight,

                thickness:
                    wallThickness,

                kind: "header"

            });

        }


        // --------------------------------------------------
        // Move past rectangle
        // --------------------------------------------------

        cursor =
            Math.max(
                cursor,
                cutout.openingEnd
            );

    }


    // ==================================================
    // WALL AFTER FINAL CUTOUT
    // ==================================================

    const finalWidth =
        wallLength -
        cursor;


    if (finalWidth > 0.001) {

        const finalCenter =
            wall.start.position
                .clone()
                .add(

                    direction.clone()
                        .multiplyScalar(

                            cursor +
                            finalWidth * 0.5

                        )

                );


        finalCenter.y =
            wallHeight * 0.5;


        pieces.push({

            position:
                finalCenter,

            rotationY,

            width:
                finalWidth,

            height:
                wallHeight,

            thickness:
                wallThickness,

            kind: "right"

        });

    }


    return pieces;

}