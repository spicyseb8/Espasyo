import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

import { findOrCreateCorner } from "./CornerSolver";
import { hitWallAtPoint } from "./wallHit";
import { splitWall } from "./wallSplit";

import { removeDuplicateWalls } from "./RemoveDuplicateWalls";
import { mergeCollinearWalls } from "./MergeCollinearWalls";

import { findWallIntersections } from "./WallIntersection";

export interface PlaceWallResult {
    corners: Corner[];
    walls: Wall[];
    startCorner: Corner;
    endCorner: Corner;
    createdWalls: Wall[];
    shouldFinish: boolean;
}

interface ResolvedCorner {
    corner: Corner;
    existed: boolean;
}

export function placeWall(
    existingCorners: Corner[],
    existingWalls: Wall[],
    start: Vector3,
    end: Vector3
): PlaceWallResult {
    //----------------------------------------
    // Working copies
    //----------------------------------------

    const corners = [...existingCorners];
    let walls = [...existingWalls];

    //----------------------------------------
    // Resolve Corner Helper
    //----------------------------------------

    function resolveCorner(point: Vector3): ResolvedCorner {
        //------------------------------------
        // Existing corner
        //------------------------------------

        const existing = findOrCreateCorner(
            point,
            corners
        );

        if (!existing.isNew) {
            return {
                corner: existing.corner,
                existed: true
            };
        }

        //------------------------------------
        // Hit existing wall
        //------------------------------------

        const hit = hitWallAtPoint(
            point,
            walls
        );

        if (hit) {
            //--------------------------------
            // Reuse split corner
            //--------------------------------

            const reused = corners.find(
                c =>
                    c.position.distanceTo(
                        hit.point
                    ) < 0.001
            );

            if (reused) {
                return {
                    corner: reused,
                    existed: true
                };
            }

            //--------------------------------
            // Create split corner
            //--------------------------------

            const splitCorner: Corner = {
                id: crypto.randomUUID(),
                position: hit.point.clone()
            };

            corners.push(splitCorner);

            //--------------------------------
            // Split wall
            //--------------------------------

            const [left, right] = splitWall(
                hit.wall,
                splitCorner
            );

            walls = walls.filter(
                w => w.id !== hit.wall.id
            );

            walls.push(
                left,
                right
            );

            return {
                corner: splitCorner,
                existed: false
            };
        }

        //------------------------------------
        // Brand new corner
        //------------------------------------

        corners.push(
            existing.corner
        );

        return {
            corner: existing.corner,
            existed: false
        };
    }

    //----------------------------------------
    // Resolve Start
    //----------------------------------------

    const startResult = resolveCorner(start);
    const startCorner = startResult.corner;

    //----------------------------------------
    // Resolve End
    //----------------------------------------

    const endResult = resolveCorner(end);
    const endCorner = endResult.corner;

    //----------------------------------------
    // Same Corner
    //----------------------------------------

    if (
        startCorner.id === endCorner.id
    ) {
        return {
            corners: existingCorners,
            walls: existingWalls,
            startCorner,
            endCorner,
            createdWalls: [],
            shouldFinish: true
        };
    }

    //----------------------------------------
    // Find intersections along new wall
    //----------------------------------------

    const hits = findWallIntersections(
        startCorner.position,
        endCorner.position,
        walls
    );

    const orderedCorners: Corner[] = [
        startCorner
    ];

    //----------------------------------------
    // Process every hit
    //----------------------------------------

    for (const hit of hits) {
        //------------------------------------
        // Existing corner
        //------------------------------------

        if (hit.isEndpoint && hit.corner) {
            if (
                !orderedCorners.some(
                    c => c.id === hit.corner!.id
                )
            ) {
                orderedCorners.push(
                    hit.corner
                );
            }
            continue;
        }

        //------------------------------------
        // Split existing wall
        //------------------------------------

        let splitCorner = corners.find(
            c =>
                c.position.distanceTo(
                    hit.point
                ) < 0.001
        );

        if (!splitCorner) {
            splitCorner = {
                id: crypto.randomUUID(),
                position: hit.point.clone()
            };
            corners.push(
                splitCorner
            );
        }

        //------------------------------------
        // Already split?
        //------------------------------------

        const alreadySplit = walls.some(
            w =>
                (
                    w.start.id === splitCorner!.id ||
                    w.end.id === splitCorner!.id
                )
        );

        if (!alreadySplit) {
            const [
                left,
                right
            ] = splitWall(
                hit.wall,
                splitCorner
            );

            walls = walls.filter(
                w =>
                    w.id !== hit.wall.id
            );

            walls.push(
                left,
                right
            );
        }

        orderedCorners.push(
            splitCorner
        );
    }

    //----------------------------------------
    // Finish chain
    //----------------------------------------

    orderedCorners.push(
        endCorner
    );

    //----------------------------------------
    // Remove duplicates
    //----------------------------------------

    const chain = orderedCorners.filter(
        (corner, index, array) =>
            array.findIndex(
                c => c.id === corner.id
            ) === index
    );

    //----------------------------------------
    // Sort along drawing direction
    //----------------------------------------

    chain.sort(
        (a, b) =>
            a.position.distanceTo(
                startCorner.position
            ) -
            b.position.distanceTo(
                startCorner.position
            )
    );

    //----------------------------------------
    // Create wall pieces
    //----------------------------------------

    const createdWalls: Wall[] = [];

    for (
        let i = 0;
        i < chain.length - 1;
        i++
    ) {
        if (
            chain[i].id ===
            chain[i + 1].id
        )
            continue;

        createdWalls.push({
            id: crypto.randomUUID(),
            start: chain[i],
            end: chain[i + 1]
        });
    }

    walls.push(
        ...createdWalls
    );

    //----------------------------------------
    // Cleanup
    //----------------------------------------

    walls = removeDuplicateWalls(
        walls
    );

    const merged = mergeCollinearWalls(
        corners,
        walls
    );

    //----------------------------------------
    // Return
    //----------------------------------------

    return {
        corners: merged.corners,
        walls: merged.walls,
        startCorner,
        endCorner,
        createdWalls,
        shouldFinish: endResult.existed
    };
}