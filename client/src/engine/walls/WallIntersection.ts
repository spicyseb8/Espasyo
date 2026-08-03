import { Vector3 } from "three";

import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";

const EPSILON = 0.001;

export interface WallIntersection {

    wall: Wall;

    point: Vector3;

    distance: number;

    corner?: Corner;

    isEndpoint: boolean;

}

//------------------------------------------------------
// Returns every intersection between a new wall segment
// and existing walls.
//
// It detects BOTH:
//
// 1. Passing through a wall body
// 2. Passing through an existing wall endpoint
//------------------------------------------------------

export function findWallIntersections(

    start: Vector3,
    end: Vector3,

    walls: Wall[]

): WallIntersection[] {

    const intersections: WallIntersection[] = [];

    for (const wall of walls) {

        //----------------------------------
        // Existing start corner
        //----------------------------------

        if (

            isPointOnSegment(

                wall.start.position,

                start,

                end

            )

        ) {

            intersections.push({

                wall,

                point: wall.start.position.clone(),

                distance:

                    wall.start.position.distanceTo(start),

                corner: wall.start,

                isEndpoint: true

            });

        }

        //----------------------------------
        // Existing end corner
        //----------------------------------

        if (

            isPointOnSegment(

                wall.end.position,

                start,

                end

            )

        ) {

            intersections.push({

                wall,

                point: wall.end.position.clone(),

                distance:

                    wall.end.position.distanceTo(start),

                corner: wall.end,

                isEndpoint: true

            });

        }

        //----------------------------------
        // Middle intersection
        //----------------------------------

        const hit = getSegmentIntersection(

            start,
            end,

            wall.start.position,
            wall.end.position

        );

        if (!hit)
            continue;

        //----------------------------------
        // Ignore exact endpoints
        //----------------------------------

        if (

            hit.distanceTo(

                wall.start.position

            ) < EPSILON ||

            hit.distanceTo(

                wall.end.position

            ) < EPSILON

        ) {

            continue;

        }

        intersections.push({

            wall,

            point: hit,

            distance:

                hit.distanceTo(start),

            isEndpoint: false

        });

    }

    //--------------------------------------
    // Remove duplicate corners/intersections
    //--------------------------------------

    const unique: WallIntersection[] = [];

    for (const hit of intersections) {

        const exists = unique.some(

            other =>

                other.point.distanceTo(

                    hit.point

                ) < EPSILON

        );

        if (!exists)

            unique.push(hit);

    }

    //--------------------------------------

    unique.sort(

        (a, b) =>

            a.distance - b.distance

    );

    return unique;

}

//------------------------------------------------------
// Segment intersection
//------------------------------------------------------

function getSegmentIntersection(

    a1: Vector3,
    a2: Vector3,

    b1: Vector3,
    b2: Vector3

): Vector3 | null {

    const x1 = a1.x;
    const z1 = a1.z;

    const x2 = a2.x;
    const z2 = a2.z;

    const x3 = b1.x;
    const z3 = b1.z;

    const x4 = b2.x;
    const z4 = b2.z;

    const denominator =

        (x1 - x2) * (z3 - z4) -

        (z1 - z2) * (x3 - x4);

    if (Math.abs(denominator) < EPSILON)

        return null;

    const t =

        (

            (x1 - x3) * (z3 - z4) -

            (z1 - z3) * (x3 - x4)

        ) / denominator;

    const u =

        (

            (x1 - x3) * (z1 - z2) -

            (z1 - z3) * (x1 - x2)

        ) / denominator;

    if (

        t < 0 ||
        t > 1 ||

        u < 0 ||
        u > 1

    ) {

        return null;

    }

    return new Vector3(

        x1 + t * (x2 - x1),

        0,

        z1 + t * (z2 - z1)

    );

}

//------------------------------------------------------
// Checks if a point lies on a finite segment.
// Used for detecting when a new wall passes
// through an existing corner.
//------------------------------------------------------

function isPointOnSegment(

    point: Vector3,

    start: Vector3,
    end: Vector3

): boolean {

    const segment = end.clone().sub(start);

    const toPoint = point.clone().sub(start);

    const length = segment.length();

    if (length < EPSILON)

        return false;

    const projection =

        toPoint.dot(segment) /

        (length * length);

    if (

        projection < 0 ||

        projection > 1

    )

        return false;

    const closest =

        start.clone().add(

            segment.multiplyScalar(projection)

        );

    return (

        closest.distanceTo(point) < EPSILON

    );

}