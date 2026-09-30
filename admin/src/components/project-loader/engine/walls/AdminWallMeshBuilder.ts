import {
    Vector3
} from "three";

import type {
    Wall
} from "./WallTypes";


//==================================================
// ADMIN WALL PIECE
//==================================================

export type AdminWallPieceKind =
    | "full"
    | "left"
    | "right"
    | "header"
    | "arch";


export interface AdminWallPieceData {

    position:
        Vector3;

    rotationY:
        number;

    width:
        number;

    height:
        number;

    thickness:
        number;

    kind:
        AdminWallPieceKind;

    arch?: {

        openingWidth:
            number;

        openingHeight:
            number;

    };

}


//==================================================
// DOOR
//==================================================

export interface AdminDoorData {

    id:
        string;

    wallId:
        string;

    position:
        Vector3;

    width:
        number;

    height:
        number;

}


//==================================================
// WINDOW
//==================================================

export interface AdminWindowData {

    id:
        string;

    wallId:
        string;

    position:
        Vector3;

    width:
        number;

    height:
        number;

}


//==================================================
// OPENING
//==================================================

export interface AdminOpeningData {

    id:
        string;

    wallId:
        string;

    position:
        Vector3;

    width:
        number;

    height:
        number;

    shape:
        "rectangle"
        | "arch";

}


//==================================================
// BUILD WALL MESHES
//==================================================

export function buildAdminWallMeshes(

    wall:
        Wall,

    wallHeight:
        number,

    wallThickness:
        number,

    doors:
        AdminDoorData[] = [],

    openings:
        AdminOpeningData[] = [],

    windows:
        AdminWindowData[] = []

):
    AdminWallPieceData[] {


    //--------------------------------------------------
    // WALL DIRECTION
    //--------------------------------------------------

    const direction =
        new Vector3()
            .subVectors(
                wall.end.position,
                wall.start.position
            );


    const wallLength =
        direction.length();


    if (
        wallLength <=
        0.001
    ) {

        return [];

    }


    direction.normalize();


    const rotationY =
        Math.atan2(
            direction.z,
            direction.x
        );


    //--------------------------------------------------
    // CUTOUTS
    //--------------------------------------------------

    interface Cutout {

        width:
            number;

        openingStart:
            number;

        openingEnd:
            number;

        openingBottom:
            number;

        openingTop:
            number;

        type:
            "door"
            | "opening"
            | "window";

        shape?:
            "rectangle"
            | "arch";

    }


    const cutouts:
        Cutout[] = [];


    //--------------------------------------------------
    // DOORS
    //--------------------------------------------------

    for (
        const door
        of doors
    ) {

        if (
            door.wallId !==
            wall.id
        ) {

            continue;

        }


        const distance =
            door.position
                .clone()
                .sub(
                    wall.start.position
                )
                .dot(
                    direction
                );


        const halfWidth =
            door.width *
            0.5;


        const openingStart =
            Math.max(

                0,

                distance -
                halfWidth

            );


        const openingEnd =
            Math.min(

                wallLength,

                distance +
                halfWidth

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

            width:
                openingEnd -
                openingStart,

            openingStart,

            openingEnd,

            openingBottom:
                0,

            openingTop:
                height,

            type:
                "door"

        });

    }


    //--------------------------------------------------
    // OPENINGS
    //--------------------------------------------------

    for (
        const opening
        of openings
    ) {

        if (
            opening.wallId !==
            wall.id
        ) {

            continue;

        }


        const distance =
            opening.position
                .clone()
                .sub(
                    wall.start.position
                )
                .dot(
                    direction
                );


        const halfWidth =
            opening.width *
            0.5;


        const openingStart =
            Math.max(

                0,

                distance -
                halfWidth

            );


        const openingEnd =
            Math.min(

                wallLength,

                distance +
                halfWidth

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

            width:
                openingEnd -
                openingStart,

            openingStart,

            openingEnd,

            openingBottom:
                0,

            openingTop:
                height,

            type:
                "opening",

            shape:
                opening.shape

        });

    }


    //--------------------------------------------------
    // WINDOWS
    //--------------------------------------------------

    for (
        const window
        of windows
    ) {

        if (
            window.wallId !==
            wall.id
        ) {

            continue;

        }


        const distance =
            window.position
                .clone()
                .sub(
                    wall.start.position
                )
                .dot(
                    direction
                );


        const actualWidth =
            Math.max(
                window.width,
                0.001
            );


        const halfWidth =
            actualWidth *
            0.5;


        const openingStart =
            Math.max(

                0,

                distance -
                halfWidth

            );


        const openingEnd =
            Math.min(

                wallLength,

                distance +
                halfWidth

            );


        if (
            openingEnd <=
            openingStart
        ) {

            continue;

        }


        const openingBottom =
            Math.max(

                0,

                window.position.y -
                window.height *
                0.5

            );


        const openingTop =
            Math.min(

                wallHeight,

                window.position.y +
                window.height *
                0.5

            );


        if (
            openingTop <=
            openingBottom
        ) {

            continue;

        }


        cutouts.push({

            width:
                openingEnd -
                openingStart,

            openingStart,

            openingEnd,

            openingBottom,

            openingTop,

            type:
                "window"

        });

    }


    //--------------------------------------------------
    // NO CUTOUTS
    //--------------------------------------------------

    if (
        cutouts.length ===
        0
    ) {

        return [

            {

                position:
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

                    ),

                rotationY,

                width:
                    wallLength,

                height:
                    wallHeight,

                thickness:
                    wallThickness,

                kind:
                    "full"

            }

        ];

    }


    //--------------------------------------------------
    // SORT
    //--------------------------------------------------

    cutouts.sort(

        (
            first,
            second
        ) =>
            first.openingStart -
            second.openingStart

    );


    const pieces:
        AdminWallPieceData[] = [];


    let cursor =
        0;


    //--------------------------------------------------
    // ADD PIECE
    //--------------------------------------------------

    function addPiece(

        start:
            number,

        width:
            number,

        bottom:
            number,

        height:
            number,

        kind:
            AdminWallPieceKind

    ) {

        if (
            width <=
            0.001 ||
            height <=
            0.001
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

            position:
                center,

            rotationY,

            width,

            height,

            thickness:
                wallThickness,

            kind

        });

    }


    //--------------------------------------------------
    // BUILD AROUND CUTOUTS
    //--------------------------------------------------

    for (
        const cutout
        of cutouts
    ) {

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


        //--------------------------------------------------
        // LEFT WALL
        //--------------------------------------------------

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


        //--------------------------------------------------
        // ARCH
        //--------------------------------------------------

        if (
            cutout.type ===
                "opening" &&
            cutout.shape ===
                "arch"
        ) {

            buildArchPieces(

                cutoutStart,

                cutout.openingEnd -
                cutoutStart,

                cutout.openingTop,

                wallHeight,

                wallThickness,

                direction,

                wall,

                rotationY,

                pieces

            );

        }


        //--------------------------------------------------
        // WINDOW
        //--------------------------------------------------

        else if (
            cutout.type ===
            "window"
        ) {

            const bottomHeight =
                cutout.openingBottom;


            if (
                bottomHeight >
                0.001
            ) {

                addPiece(

                    cutoutStart,

                    cutout.openingEnd -
                    cutoutStart,

                    0,

                    bottomHeight,

                    "header"

                );

            }


            const topHeight =
                wallHeight -
                cutout.openingTop;


            if (
                topHeight >
                0.001
            ) {

                addPiece(

                    cutoutStart,

                    cutout.openingEnd -
                    cutoutStart,

                    cutout.openingTop,

                    topHeight,

                    "header"

                );

            }

        }


        //--------------------------------------------------
        // DOOR / RECTANGLE
        //--------------------------------------------------

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

                    cutout.openingEnd -
                    cutoutStart,

                    cutout.openingTop,

                    headerHeight,

                    "header"

                );

            }

        }


        cursor =
            Math.max(
                cursor,
                cutout.openingEnd
            );

    }


    //--------------------------------------------------
    // FINAL WALL
    //--------------------------------------------------

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


//==================================================
// BUILD ARCH PIECES
//==================================================

function buildArchPieces(

    openingStart:
        number,

    openingWidth:
        number,

    openingHeight:
        number,

    wallHeight:
        number,

    wallThickness:
        number,

    direction:
        Vector3,

    wall:
        Wall,

    rotationY:
        number,

    pieces:
        AdminWallPieceData[]

) {

    const radius =
        openingWidth *
        0.5;


    const springHeight =
        openingHeight -
        radius;


    const archHeight =
        Math.max(
            0,
            openingHeight -
            springHeight
        );


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

                position:
                    center,

                rotationY,

                width:
                    openingWidth,

                height:
                    headerHeight,

                thickness:
                    wallThickness,

                kind:
                    "header"

            });

        }


        return;

    }


    const steps =
        16;


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
            (y0 + y1) * 0.5;


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