import type {
    Corner
} from "../walls/Corner";

import type {
    Wall
} from "../walls/WallTypes";

import type {
    Door
} from "../doors/DoorTypes";

import type {
    Window
} from "../windows/WindowTypes";

import type {
    Opening
} from "../openings/OpeningTypes";

import {
    solveRegions
} from "../regions/RegionSolver";

import {
    findCachedWallMaterial
} from "../materials/walls";

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

//==================================================
// WALL DIRECTION
//==================================================

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

        (x -
            wall.start.position.x) *
        direction.x

        +

        (z -
            wall.start.position.z) *
        direction.z

    );
}

//==================================================
// RECTANGLE UNION AREA
//==================================================

function calculateRectangleUnionArea(
    rectangles: CutoutRect[]
): number {

    if (
        rectangles.length === 0
    ) {

        return 0;
    }

    //==================================================
    // UNIQUE X COORDINATES
    //==================================================

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

    //==================================================
    // VERTICAL SWEEP
    //==================================================

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

        //==================================================
        // ACTIVE RECTANGLES
        //==================================================

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

        //==================================================
        // MERGE Y INTERVALS
        //==================================================

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

    const radius =
        width * 0.5;

    const springHeight =
        Math.max(
            0,
            availableHeight -
            radius
        );

    const rectangleArea =
        width *
        springHeight;

    const archArea =
        (
            Math.PI *
            radius *
            radius
        ) *
        0.5;

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

    //==================================================
    // FIND ROOMS
    //==================================================

    const regions =
        solveRegions(
            corners,
            walls
        );

    //==================================================
    // GROUP COSTS
    //==================================================

    const grouped =
        new Map<
            string,
            CostItem
        >();

    //==================================================
    // PROCESS EACH ROOM
    //==================================================

    for (
        const region
        of regions
    ) {

        //==================================================
        // PROCESS EACH WALL SIDE
        //==================================================

        for (
            const wall
            of region.walls
        ) {

            //==================================================
            // MATERIAL ASSIGNED TO THIS ROOM SIDE
            //==================================================

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

            //==================================================
            // GET FIREBASE WALL MATERIAL
            //==================================================

            const material =
                findCachedWallMaterial(
                    materialId
                );

            if (
                !material
            ) {

                console.warn(
                    "Wall material was not found in the Firebase material cache:",
                    materialId
                );

                continue;
            }

            //==================================================
            // WALL DIMENSIONS
            //==================================================

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

            //==================================================
            // TOTAL WALL AREA
            //==================================================

            const totalWallArea =
                wallLength *
                wallHeight;

            //==================================================
            // RECTANGULAR CUTOUTS
            //==================================================

            const rectangularCutouts:
                CutoutRect[] = [];

            //==================================================
            // DOORS
            //==================================================

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
                    endX > 0 &&
                    startX < wallLength
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

            //==================================================
            // WINDOWS
            //==================================================

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
                    endX > 0 &&
                    startX < wallLength &&
                    topY > bottomY
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

            //==================================================
            // OPENINGS
            //==================================================

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
                        endX > 0 &&
                        startX < wallLength &&
                        topY > bottomY
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

            //==================================================
            // RECTANGULAR CUTOUT AREA
            //==================================================

            const rectangularCutoutArea =
                calculateRectangleUnionArea(
                    rectangularCutouts
                );

            //==================================================
            // ARCH AREA
            //==================================================

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
                    width <= 0
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

            //==================================================
            // TOTAL CUTOUT AREA
            //==================================================

            const cutoutArea =
                rectangularCutoutArea +
                archCutoutArea;

            //==================================================
            // REMAINING WALL FINISH AREA
            //==================================================

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

            //==================================================
            // GROUP BY FIREBASE MATERIAL
            //==================================================

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

    //==================================================
    // RETURN GROUPED COSTS
    //==================================================

    return Array.from(
        grouped.values()
    );
}