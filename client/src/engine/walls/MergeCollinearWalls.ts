import { Vector3 } from "three";

import type { Corner } from "./Corner";
import type { Wall } from "./WallTypes";

const EPSILON = 0.0001;

function areCollinear(
    a: Vector3,
    b: Vector3,
    c: Vector3
) {
    const ab = b.clone().sub(a).normalize();
    const bc = c.clone().sub(b).normalize();

    return Math.abs(ab.cross(bc).length()) < EPSILON;
}

export function mergeCollinearWalls(
    corners: Corner[],
    walls: Wall[]
) {
    let mergedWalls = [...walls];
    let mergedCorners = [...corners];

    let changed = true;

    while (changed) {

        changed = false;

        for (const corner of [...mergedCorners]) {

            //----------------------------------
            // Find connected walls
            //----------------------------------

            const connected = mergedWalls.filter(

                w =>
                    w.start.id === corner.id ||
                    w.end.id === corner.id

            );

            //----------------------------------
            // Only degree-2 corners merge
            //----------------------------------

            if (connected.length !== 2)
                continue;

            const wallA = connected[0];
            const wallB = connected[1];

            const otherA =
                wallA.start.id === corner.id
                    ? wallA.end
                    : wallA.start;

            const otherB =
                wallB.start.id === corner.id
                    ? wallB.end
                    : wallB.start;

            //----------------------------------
            // Must be straight
            //----------------------------------

            if (
                !areCollinear(
                    otherA.position,
                    corner.position,
                    otherB.position
                )
            )
                continue;

            //----------------------------------
            // Remove two walls
            //----------------------------------

            mergedWalls = mergedWalls.filter(

                w =>
                    w.id !== wallA.id &&
                    w.id !== wallB.id

            );

            //----------------------------------
            // Add merged wall
            //----------------------------------

            mergedWalls.push({

                id: crypto.randomUUID(),

                start: otherA,

                end: otherB

            });

            //----------------------------------
            // Remove unused corner
            //----------------------------------

            mergedCorners =
                mergedCorners.filter(

                    c => c.id !== corner.id

                );

            changed = true;

            break;
        }
    }

    return {

        corners: mergedCorners,

        walls: mergedWalls

    };
}