import { Vector3 } from "three";

import type { Wall } from "./WallTypes";
import type { Door } from "../doors/DoorTypes";
import type { Opening } from "../openings/OpeningTypes";
import type { Window } from "../windows/WindowTypes";
import type { WallPiece } from "./WallPiece";


interface WallCutout {
    position: Vector3;

    width: number;

    height: number;

    openingStart: number;

    openingEnd: number;

    openingBottom: number;

    openingTop: number;

    type:
        | "door"
        | "opening"
        | "window";

    shape?:
        | "rectangle"
        | "arch";
}


export function buildWallMeshes(
    wall: Wall,
    wallHeight: number,
    wallThickness: number,
    doors: Door[] = [],
    openings: Opening[] = [],
    windows: Window[] = []
): WallPiece[] {

    /*
     * ==================================================
     * WALL DIRECTION
     * ==================================================
     */

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


    const rotationY =
        Math.atan2(
            direction.z,
            direction.x
        );


    const cutouts: WallCutout[] = [];


    /*
     * ==================================================
     * DOORS
     * ==================================================
     */

    for (const door of doors) {

        if (door.wallId !== wall.id) {
            continue;
        }


        const distance =
            door.position
                .clone()
                .sub(wall.start.position)
                .dot(direction);


        const halfWidth =
            door.width * 0.5;


        const openingStart =
            Math.max(
                0,
                distance - halfWidth
            );


        const openingEnd =
            Math.min(
                wallLength,
                distance + halfWidth
            );


        if (
            openingEnd <=
            openingStart
        ) {
            continue;
        }


        const height =
            Math.min(
                door.height,
                wallHeight
            );


        cutouts.push({

            position:
                door.position.clone(),

            width:
                openingEnd -
                openingStart,

            height,

            openingStart,

            openingEnd,

            openingBottom: 0,

            openingTop: height,

            type: "door"

        });
    }


    /*
     * ==================================================
     * NORMAL / ARCH OPENINGS
     * ==================================================
     */

    for (const opening of openings) {

        if (opening.wallId !== wall.id) {
            continue;
        }


        const distance =
            opening.position
                .clone()
                .sub(wall.start.position)
                .dot(direction);


        const halfWidth =
            opening.width * 0.5;


        const openingStart =
            Math.max(
                0,
                distance - halfWidth
            );


        const openingEnd =
            Math.min(
                wallLength,
                distance + halfWidth
            );


        if (
            openingEnd <=
            openingStart
        ) {
            continue;
        }


        const height =
            Math.min(
                opening.height,
                wallHeight
            );


        cutouts.push({

            position:
                opening.position.clone(),

            width:
                openingEnd -
                openingStart,

            height,

            openingStart,

            openingEnd,

            openingBottom: 0,

            openingTop: height,

            type: "opening",

            shape:
                opening.shape

        });
    }


    /*
     * ==================================================
     * WINDOWS
     * ==================================================
     *
     * IMPORTANT:
     *
     * The window's width/depth are local GLB dimensions.
     *
     * We determine which dimension runs along the wall
     * based on the FINAL window rotation.
     *
     * This prevents a GLB modeled differently from
     * producing a tiny or oversized wall cut.
     * ==================================================
     */

    for (const window of windows) {

        if (window.wallId !== wall.id) {
            continue;
        }


        /*
         * ----------------------------------------------
         * WINDOW CENTER ALONG WALL
         * ----------------------------------------------
         */

        const distance =
            window.position
                .clone()
                .sub(wall.start.position)
                .dot(direction);


        /*
         * ----------------------------------------------
         * DETERMINE WINDOW WIDTH ALONG WALL
         * ----------------------------------------------
         *
         * The window has two horizontal local axes:
         *
         * X = window.width
         * Z = window.depth
         *
         * After rotation, both can contribute to the
         * window's projected size along the wall.
         *
         * This is more reliable than simply using
         * window.width.
         */

        const cos =
            Math.abs(
                Math.cos(
                    window.rotationY -
                    rotationY
                )
            );

        const sin =
            Math.abs(
                Math.sin(
                    window.rotationY -
                    rotationY
                )
            );


        const widthAlongWall =
            (
                window.width * cos
            ) +
            (
                window.depth * sin
            );


        /*
         * Safety fallback.
         */

        const actualWidth =
            Math.max(
                widthAlongWall,
                0.001
            );


        const halfWidth =
            actualWidth * 0.5;


        /*
         * ----------------------------------------------
         * HORIZONTAL CUT
         * ----------------------------------------------
         */

        const openingStart =
            Math.max(
                0,
                distance - halfWidth
            );


        const openingEnd =
            Math.min(
                wallLength,
                distance + halfWidth
            );


        if (
            openingEnd <=
            openingStart
        ) {
            continue;
        }


        /*
         * ----------------------------------------------
         * VERTICAL CUT
         * ----------------------------------------------
         *
         * Window.position.y is treated as the CENTER
         * of the window.
         */

        const openingBottom =
            Math.max(
                0,
                window.position.y -
                window.height * 0.5
            );


        const openingTop =
            Math.min(
                wallHeight,
                window.position.y +
                window.height * 0.5
            );


        if (
            openingTop <=
            openingBottom
        ) {
            continue;
        }


        cutouts.push({

            position:
                window.position.clone(),

            width:
                openingEnd -
                openingStart,

            height:
                openingTop -
                openingBottom,

            openingStart,

            openingEnd,

            openingBottom,

            openingTop,

            type: "window"

        });
    }


    /*
     * ==================================================
     * NO CUTOUTS
     * ==================================================
     */

    if (
        cutouts.length === 0
    ) {

        const center =
            new Vector3(

                (
                    wall.start.position.x +
                    wall.end.position.x
                ) * 0.5,

                wallHeight * 0.5,

                (
                    wall.start.position.z +
                    wall.end.position.z
                ) * 0.5

            );


        return [{

            position: center,

            rotationY,

            width: wallLength,

            height: wallHeight,

            thickness: wallThickness,

            kind: "full"

        }];
    }


    /*
     * ==================================================
     * SORT CUTOUTS
     * ==================================================
     */

    cutouts.sort(
        (a, b) =>
            a.openingStart -
            b.openingStart
    );


    const pieces: WallPiece[] = [];


    let cursor = 0;


    /*
     * ==================================================
     * ADD WALL PIECE
     * ==================================================
     */

    function addPiece(
        start: number,
        width: number,
        bottom: number,
        height: number,
        kind: WallPiece["kind"]
    ) {

        if (
            width <= 0.001 ||
            height <= 0.001
        ) {
            return;
        }


        const center =
            wall.start.position
                .clone()
                .add(
                    direction
                        .clone()
                        .multiplyScalar(
                            start +
                            width * 0.5
                        )
                );


        center.y =
            bottom +
            height * 0.5;


        pieces.push({

            position: center,

            rotationY,

            width,

            height,

            thickness: wallThickness,

            kind

        });
    }


    /*
     * ==================================================
     * BUILD WALL AROUND CUTOUTS
     * ==================================================
     */

    for (const cutout of cutouts) {

        /*
         * Ignore cutouts that are already behind
         * the current cursor.
         */

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


        const cutoutWidth =
            cutout.openingEnd -
            cutoutStart;


        /*
         * ----------------------------------------------
         * WALL BEFORE CUTOUT
         * ----------------------------------------------
         */

        const leftWidth =
            cutoutStart -
            cursor;


        if (
            leftWidth >
            0.001
        ) {

            addPiece(

                cursor,

                leftWidth,

                0,

                wallHeight,

                "left"

            );
        }


        /*
         * ----------------------------------------------
         * ARCH
         * ----------------------------------------------
         */

        if (
            cutout.type === "opening" &&
            cutout.shape === "arch"
        ) {

            buildArchPieces(

                cutoutStart,

                cutoutWidth,

                cutout.height,

                wallHeight,

                wallThickness,

                direction,

                wall,

                rotationY,

                pieces

            );
        }


        /*
         * ----------------------------------------------
         * WINDOW
         * ----------------------------------------------
         */

        else if (
            cutout.type === "window"
        ) {

            /*
             * WALL BELOW WINDOW
             */

            const bottomHeight =
                cutout.openingBottom;


            if (
                bottomHeight >
                0.001
            ) {

                addPiece(

                    cutoutStart,

                    cutoutWidth,

                    0,

                    bottomHeight,

                    "header"

                );
            }


            /*
             * WALL ABOVE WINDOW
             */

            const topHeight =
                wallHeight -
                cutout.openingTop;


            if (
                topHeight >
                0.001
            ) {

                addPiece(

                    cutoutStart,

                    cutoutWidth,

                    cutout.openingTop,

                    topHeight,

                    "header"

                );
            }
        }


        /*
         * ----------------------------------------------
         * DOOR / RECTANGLE OPENING
         * ----------------------------------------------
         */

        else {

            const headerHeight =
                wallHeight -
                cutout.openingTop;


            if (
                headerHeight >
                0.001
            ) {

                addPiece(

                    cutoutStart,

                    cutoutWidth,

                    cutout.openingTop,

                    headerHeight,

                    "header"

                );
            }
        }


        /*
         * Move cursor past cutout.
         */

        cursor =
            Math.max(
                cursor,
                cutout.openingEnd
            );
    }


    /*
     * ==================================================
     * WALL AFTER FINAL CUTOUT
     * ==================================================
     */

    const finalWidth =
        wallLength -
        cursor;


    if (
        finalWidth >
        0.001
    ) {

        addPiece(

            cursor,

            finalWidth,

            0,

            wallHeight,

            "right"

        );
    }


    return pieces;
}


/*
 * ======================================================
 * ARCH WALL CUT
 * ======================================================
 */

function buildArchPieces(

    openingStart: number,

    openingWidth: number,

    openingHeight: number,

    wallHeight: number,

    wallThickness: number,

    direction: Vector3,

    wall: Wall,

    rotationY: number,

    pieces: WallPiece[]

) {

    const radius =
        openingWidth * 0.5;


    const springHeight =
        openingHeight -
        radius;


    const archHeight =
        Math.max(
            0,
            openingHeight -
            springHeight
        );


    /*
     * No arch curve.
     */

    if (
        archHeight <=
        0.001
    ) {

        const headerHeight =
            wallHeight -
            openingHeight;


        if (
            headerHeight >
            0.001
        ) {

            const center =
                wall.start.position
                    .clone()
                    .add(
                        direction
                            .clone()
                            .multiplyScalar(
                                openingStart +
                                openingWidth * 0.5
                            )
                    );


            center.y =
                openingHeight +
                headerHeight * 0.5;


            pieces.push({

                position: center,

                rotationY,

                width:
                    openingWidth,

                height:
                    headerHeight,

                thickness:
                    wallThickness,

                kind: "header"

            });
        }


        return;
    }


    /*
     * Number of horizontal slices used to
     * approximate the arch.
     */

    const steps = 16;


    const stripHeight =
        archHeight /
        steps;


    for (
        let i = 0;
        i < steps;
        i++
    ) {

        const y0 =
            springHeight +
            i * stripHeight;


        const y1 =
            y0 +
            stripHeight;


        const centerY =
            (
                y0 +
                y1
            ) * 0.5;


        const relativeY =
            centerY -
            springHeight;


        const halfOpeningWidth =
            Math.sqrt(

                Math.max(
                    0,
                    radius * radius -
                    relativeY * relativeY
                )

            );


        const sideWidth =
            Math.max(
                0,
                radius -
                halfOpeningWidth
            );


        if (
            sideWidth <=
            0.001
        ) {
            continue;
        }


        /*
         * LEFT SIDE
         */

        const leftCenter =
            wall.start.position
                .clone()
                .add(
                    direction
                        .clone()
                        .multiplyScalar(
                            openingStart +
                            sideWidth * 0.5
                        )
                );


        leftCenter.y =
            centerY;


        pieces.push({

            position:
                leftCenter,

            rotationY,

            width:
                sideWidth,

            height:
                stripHeight,

            thickness:
                wallThickness,

            kind:
                "header"

        });


        /*
         * RIGHT SIDE
         */

        const rightCenter =
            wall.start.position
                .clone()
                .add(
                    direction
                        .clone()
                        .multiplyScalar(
                            openingStart +
                            openingWidth -
                            sideWidth * 0.5
                        )
                );


        rightCenter.y =
            centerY;


        pieces.push({

            position:
                rightCenter,

            rotationY,

            width:
                sideWidth,

            height:
                stripHeight,

            thickness:
                wallThickness,

            kind:
                "header"

        });
    }


    /*
     * WALL ABOVE ARCH
     */

    const topHeight =
        wallHeight -
        openingHeight;


    if (
        topHeight >
        0.001
    ) {

        const center =
            wall.start.position
                .clone()
                .add(
                    direction
                        .clone()
                        .multiplyScalar(
                            openingStart +
                            openingWidth * 0.5
                        )
                );


        center.y =
            openingHeight +
            topHeight * 0.5;


        pieces.push({

            position:
                center,

            rotationY,

            width:
                openingWidth,

            height:
                topHeight,

            thickness:
                wallThickness,

            kind:
                "header"

        });
    }
}