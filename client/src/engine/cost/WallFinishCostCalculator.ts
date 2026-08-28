import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

import type { Door } from "../doors/DoorTypes";
import type { Window } from "../windows/WindowTypes";
import type { Opening } from "../openings/OpeningTypes";

import {
    solveRegions
} from "../regions/RegionSolver";

import {
    MaterialLibrary
} from "../materials/MaterialLibrary";

import type {
    CostItem
} from "./CostTypes";

//==================================================
// OPTIONS
//==================================================

export interface WallFinishCostOptions {

    corners: Corner[];

    walls: Wall[];

    wallHeight: number;

    doors: Door[];

    windows: Window[];

    openings: Opening[];

    wallFinishes:
        Record<
            string,
            Record<string, string>
        >;
}

//==================================================
// RECTANGLE USED FOR CUTOUT AREA
//==================================================

interface CutoutRect {

    startX: number;

    endX: number;

    bottomY: number;

    topY: number;
}

//==================================================
// WALL CUTOUT
//==================================================

interface WallCutout {

    startX: number;

    endX: number;

    bottomY: number;

    topY: number;

    shape:
        | "rectangle"
        | "arch";
}


function getWallDirection(
    wall: Wall
) {

    const dx =
        wall.end.position.x -
        wall.start.position.x;

    const dz =
        wall.end.position.z -
        wall.start.position.z;

    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (
        length <= 0.000001
    ) {

        return {
            x: 1,
            z: 0,
            length: 0
        };

    }

    return {

        x:
            dx / length,

        z:
            dz / length,

        length

    };
}

//==================================================
// DISTANCE OF POINT ALONG WALL
//==================================================

function distanceAlongWall(
    x: number,
    z: number,
    wall: Wall
): number {

    const direction =
        getWallDirection(
            wall
        );

    return (
        (x - wall.start.position.x) *
            direction.x +

        (z - wall.start.position.z) *
            direction.z
    );
}



function calculateRectangleUnionArea(
    rectangles: CutoutRect[]
): number {

    if (
        rectangles.length === 0
    ) {

        return 0;

    }

    //--------------------------------------------------
    // Unique X coordinates
    //--------------------------------------------------

    const xCoordinates =
        Array.from(
            new Set(
                rectangles.flatMap(
                    rect => [
                        rect.startX,
                        rect.endX
                    ]
                )
            )
        ).sort(
            (a, b) =>
                a - b
        );

    //--------------------------------------------------
    // Vertical sweep
    //--------------------------------------------------

    let area = 0;

    for (
        let i = 0;
        i <
        xCoordinates.length - 1;
        i++
    ) {

        const x0 =
            xCoordinates[i];

        const x1 =
            xCoordinates[i + 1];

        const width =
            x1 - x0;

        if (
            width <= 0
        ) {

            continue;

        }

        //--------------------------------------------------
        // Find rectangles active in this X interval
        //--------------------------------------------------

        const active =
            rectangles
                .filter(
                    rect =>
                        rect.startX < x1 &&
                        rect.endX > x0
                )
                .map(
                    rect => ({
                        bottomY:
                            rect.bottomY,

                        topY:
                            rect.topY
                    })
                )
                .sort(
                    (a, b) =>
                        a.bottomY -
                        b.bottomY
                );

        if (
            active.length === 0
        ) {

            continue;

        }

        //--------------------------------------------------
        // Merge Y intervals
        //--------------------------------------------------

        let coveredHeight = 0;

        let currentStart =
            active[0].bottomY;

        let currentEnd =
            active[0].topY;

        for (
            let j = 1;
            j < active.length;
            j++
        ) {

            const next =
                active[j];

            if (
                next.bottomY <=
                currentEnd
            ) {

                currentEnd =
                    Math.max(
                        currentEnd,
                        next.topY
                    );

            } else {

                coveredHeight +=
                    currentEnd -
                    currentStart;

                currentStart =
                    next.bottomY;

                currentEnd =
                    next.topY;

            }

        }

        coveredHeight +=
            currentEnd -
            currentStart;

        area +=
            width *
            coveredHeight;
    }

    return area;
}

//==================================================
// ARCH CUTOUT AREA
//
// Your current WallMeshBuilder creates a
// semicircular arch based on:
// radius = openingWidth / 2
//
// So:
//
// area = rectangle below spring line
//      + semicircle
//==================================================

function calculateArchArea(
    width: number,
    height: number,
    bottomY: number,
    wallHeight: number
): number {

    const availableHeight =
        Math.min(
            height,
            wallHeight -
            bottomY
        );

    if (
        availableHeight <= 0 ||
        width <= 0
    ) {

        return 0;

    }

    //--------------------------------------------------
    // Current wall builder uses a semicircular top.
    //--------------------------------------------------

    const radius =
        width * 0.5;

    const springHeight =
        Math.max(
            0,
            availableHeight -
            radius
        );

    //--------------------------------------------------
    // Rectangle portion
    //--------------------------------------------------

    const rectangleArea =
        width *
        springHeight;

    //--------------------------------------------------
    // Semicircle portion
    //--------------------------------------------------

    const archArea =
        (
            Math.PI *
            radius *
            radius
        ) * 0.5;

    return (
        rectangleArea +
        archArea
    );
}

//==================================================
// MAIN
//==================================================

export function calculateWallFinishCosts(
    options: WallFinishCostOptions
): CostItem[] {

    const {

        corners,

        walls,

        wallHeight,

        doors,

        windows,

        openings,

        wallFinishes

    } = options;

    //--------------------------------------------------
    // Find rooms
    //--------------------------------------------------

    const regions =
        solveRegions(
            corners,
            walls
        );

    //--------------------------------------------------
    // Group by material
    //--------------------------------------------------

    const grouped =
        new Map<
            string,
            CostItem
        >();

    //--------------------------------------------------
    // Process each room
    //--------------------------------------------------

    for (
        const region
        of regions
    ) {

        //--------------------------------------------------
        // Process every wall on this room side
        //--------------------------------------------------

        for (
            const wall
            of region.walls
        ) {

            //--------------------------------------------------
            // Find material assigned to THIS room side
            // of THIS wall.
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
            // Find material
            //--------------------------------------------------

            const material =
                MaterialLibrary.find(
                    item =>
                        item.id ===
                            materialId &&

                        item.category ===
                            "wallFinish"
                );

            if (
                !material
            ) {

                continue;

            }

            //--------------------------------------------------
            // Wall dimensions
            //--------------------------------------------------

            const direction =
                getWallDirection(
                    wall
                );

            const wallLength =
                direction.length;

            if (
                wallLength <=
                0.001
            ) {

                continue;

            }

            //--------------------------------------------------
            // TOTAL WALL AREA
            //--------------------------------------------------

            const totalWallArea =
                wallLength *
                wallHeight;

            //--------------------------------------------------
            // Collect rectangular cutouts.
            //
            // These are handled with a union calculation
            // so overlapping cutouts don't subtract twice.
            //--------------------------------------------------

            const rectangularCutouts:
                CutoutRect[] = [];

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
                    distanceAlongWall(
                        door.position.x,
                        door.position.z,
                        wall
                    );

                const halfWidth =
                    door.width *
                    0.5;

                const startX =
                    distance -
                    halfWidth;

                const endX =
                    distance +
                    halfWidth;

                const topY =
                    Math.min(
                        door.height,
                        wallHeight
                    );

                const bottomY =
                    0;

                if (
                    endX >
                    0 &&
                    startX <
                    wallLength
                ) {

                    rectangularCutouts.push({

                        startX:
                            Math.max(
                                0,
                                startX
                            ),

                        endX:
                            Math.min(
                                wallLength,
                                endX
                            ),

                        bottomY,

                        topY

                    });

                }

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
                    distanceAlongWall(
                        window.position.x,
                        window.position.z,
                        wall
                    );

                //--------------------------------------------------
                // Window width projected onto the wall.
                //--------------------------------------------------

                const relativeRotation =
                    window.rotationY -
                    Math.atan2(
                        direction.z,
                        direction.x
                    );

                const cos =
                    Math.abs(
                        Math.cos(
                            relativeRotation
                        )
                    );

                const sin =
                    Math.abs(
                        Math.sin(
                            relativeRotation
                        )
                    );

                const widthAlongWall =
                    (
                        window.width *
                        cos
                    ) +
                    (
                        window.depth *
                        sin
                    );

                const halfWidth =
                    widthAlongWall *
                    0.5;

                const startX =
                    distance -
                    halfWidth;

                const endX =
                    distance +
                    halfWidth;

                //--------------------------------------------------
                // Window is vertically centered.
                //--------------------------------------------------

                const bottomY =
                    Math.max(
                        0,
                        window.position.y -
                        window.height *
                        0.5
                    );

                const topY =
                    Math.min(
                        wallHeight,
                        window.position.y +
                        window.height *
                        0.5
                    );

                if (
                    endX >
                    0 &&
                    startX <
                    wallLength &&
                    topY >
                    bottomY
                ) {

                    rectangularCutouts.push({

                        startX:
                            Math.max(
                                0,
                                startX
                            ),

                        endX:
                            Math.min(
                                wallLength,
                                endX
                            ),

                        bottomY,

                        topY

                    });

                }

            }

            //--------------------------------------------------
            // RECTANGULAR OPENINGS
            //--------------------------------------------------

            const archCutouts:
                WallCutout[] = [];

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
                    distanceAlongWall(
                        opening.position.x,
                        opening.position.z,
                        wall
                    );

                const halfWidth =
                    opening.width *
                    0.5;

                const startX =
                    distance -
                    halfWidth;

                const endX =
                    distance +
                    halfWidth;

                const bottomY =
                    0;

                const topY =
                    Math.min(
                        opening.height,
                        wallHeight
                    );

                if (
                    opening.shape ===
                    "arch"
                ) {

                    archCutouts.push({

                        startX:
                            Math.max(
                                0,
                                startX
                            ),

                        endX:
                            Math.min(
                                wallLength,
                                endX
                            ),

                        bottomY,

                        topY,

                        shape:
                            "arch"

                    });

                } else {

                    if (
                        endX >
                        0 &&
                        startX <
                        wallLength &&
                        topY >
                        bottomY
                    ) {

                        rectangularCutouts.push({

                            startX:
                                Math.max(
                                    0,
                                    startX
                                ),

                            endX:
                                Math.min(
                                    wallLength,
                                    endX
                                ),

                            bottomY,

                            topY

                        });

                    }

                }

            }

            //--------------------------------------------------
            // Calculate rectangular cutout union
            //--------------------------------------------------

            const rectangularCutoutArea =
                calculateRectangleUnionArea(
                    rectangularCutouts
                );

            //--------------------------------------------------
            // Calculate arch areas
            //--------------------------------------------------

            let archCutoutArea =
                0;

            for (
                const arch
                of archCutouts
            ) {

                const width =
                    arch.endX -
                    arch.startX;

                if (
                    width <=
                    0
                ) {

                    continue;

                }

                archCutoutArea +=
                    calculateArchArea(
                        width,
                        arch.topY -
                            arch.bottomY,
                        arch.bottomY,
                        wallHeight
                    );

            }

            //--------------------------------------------------
            // Total cutout area
            //--------------------------------------------------

            const cutoutArea =
                rectangularCutoutArea +
                archCutoutArea;

            //--------------------------------------------------
            // Remaining finish area
            //--------------------------------------------------

            const finishArea =
                Math.max(
                    0,
                    totalWallArea -
                    cutoutArea
                );

            if (
                finishArea <=
                0.0001
            ) {

                continue;

            }

            //--------------------------------------------------
            // Group by material
            //--------------------------------------------------

            const existing =
                grouped.get(
                    material.id
                );

            if (
                existing
            ) {

                existing.quantity +=
                    finishArea;

                existing.subtotal =
                    existing.quantity *
                    existing.rate;

            } else {

                grouped.set(
                    material.id,
                    {

                        category:
                            "wallFinish",

                        name:
                            material.name,

                        quantity:
                            finishArea,

                        unit:
                            "m²",

                        rate:
                            material.pricePerSquareMeter,

                        subtotal:
                            finishArea *
                            material.pricePerSquareMeter

                    }
                );

            }

        }

    }

    //--------------------------------------------------
    // Return grouped costs
    //--------------------------------------------------

    return Array.from(
        grouped.values()
    );
}