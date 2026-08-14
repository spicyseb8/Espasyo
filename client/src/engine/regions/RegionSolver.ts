import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";
import { Vector3 } from "three";
import { buildRegionGraph } from "./RegionGraph";
import { walkRegions } from "./RegionWalker";
import {
    pointInPolygon,
    polygonArea,
    polygonPerimeter,
    type BoundaryLoop,
    type Region
} from "./Polygon";

export function solveRegions(
    corners: Corner[],
    walls: Wall[]
): Region[] {

    const graph = buildRegionGraph(
        corners,
        walls
    );

    const regions = walkRegions(graph);

    const validRegions = regions.filter(region => {

        const area = Math.abs(
            polygonArea(region.corners)
        );

        return (
            region.corners.length >= 3 &&
            area > 0.01
        );
    });

    return classifyRegionRelationships(
        validRegions
    );
}

function classifyRegionRelationships(
    regions: Region[]
): Region[] {

    /*
     * Start from a completely clean relationship state.
     *
     * This is important because solveRegions() is called repeatedly.
     * Relationships must never depend on the order in which rooms
     * were originally created.
     */

    const candidates: Region[] = regions.map(
        region => ({
            ...region,

            parentRegionId: null,

            childRegionIds: [],

            adjacentRegionIds: [],

            relationshipSummary: [],

            boundaryLoops: [
                {
                    corners: region.corners,
                    wallIds: region.walls.map(
                        wall => wall.id
                    )
                }
            ]
        })
    );

    /*
     * ----------------------------------------
     * STEP 1
     * Find adjacent regions.
     * ----------------------------------------
     */

    for (const region of candidates) {

        for (const other of candidates) {

            if (region.id === other.id) {
                continue;
            }

            const sharesWall =
                region.walls.some(
                    wall =>
                        other.walls.some(
                            otherWall =>
                                otherWall.id === wall.id
                        )
                );

            if (!sharesWall) {
                continue;
            }

            if (
                !region.adjacentRegionIds.includes(
                    other.id
                )
            ) {
                region.adjacentRegionIds.push(
                    other.id
                );
            }

            if (
                !region.relationshipSummary.includes(
                    "sharesWall"
                )
            ) {
                region.relationshipSummary.push(
                    "sharesWall"
                );
            }
        }
    }

    /*
     * ----------------------------------------
     * STEP 2
     * Find every region that contains another.
     * ----------------------------------------
     *
     * We deliberately do NOT use creation order.
     *
     * A room created first or last produces the
     * same containment hierarchy.
     */

    for (const region of candidates) {

        const possibleParents =
            candidates.filter(other => {

                if (other.id === region.id) {
                    return false;
                }

                if (
                    other.area <= region.area
                ) {
                    return false;
                }

                return isPolygonContained(
                    region.corners,
                    other.corners
                );
            });

        if (possibleParents.length === 0) {
            continue;
        }

        /*
         * If several polygons contain this region,
         * choose the smallest containing polygon.
         *
         * Example:
         *
         * BIG
         *   └── MEDIUM
         *         └── SMALL
         *
         * SMALL's parent should be MEDIUM,
         * not BIG.
         */

        possibleParents.sort(
            (a, b) =>
                a.area - b.area
        );

        const parent =
            possibleParents[0];

        region.parentRegionId =
            parent.id;
    }

    /*
     * ----------------------------------------
     * STEP 3
     * Build child relationships.
     * ----------------------------------------
     */

    for (const region of candidates) {

        if (!region.parentRegionId) {
            continue;
        }

        const parent =
            candidates.find(
                candidate =>
                    candidate.id ===
                    region.parentRegionId
            );

        if (!parent) {
            continue;
        }

        if (
            !parent.childRegionIds.includes(
                region.id
            )
        ) {
            parent.childRegionIds.push(
                region.id
            );
        }

        if (
            !parent.relationshipSummary.includes(
                "contains"
            )
        ) {
            parent.relationshipSummary.push(
                "contains"
            );
        }

        if (
            !region.relationshipSummary.includes(
                "containedBy"
            )
        ) {
            region.relationshipSummary.push(
                "containedBy"
            );
        }
    }

    /*
     * ----------------------------------------
     * STEP 4
     * Build holes for parent regions.
     * ----------------------------------------
     *
     * A child region becomes a hole in its parent.
     *
     * The child itself remains a normal region.
     */

    for (const parent of candidates) {

        if (
            parent.childRegionIds.length === 0
        ) {
            continue;
        }

        for (
            const childId of parent.childRegionIds
        ) {

            const child =
                candidates.find(
                    region =>
                        region.id === childId
                );

            if (!child) {
                continue;
            }

            const childBoundary: BoundaryLoop = {
                corners: child.corners,
                wallIds: child.walls.map(
                    wall => wall.id
                )
            };

            const alreadyExists =
                parent.boundaryLoops.some(
                    loop =>
                        sameBoundary(
                            loop,
                            childBoundary
                        )
                );

            if (!alreadyExists) {
                parent.boundaryLoops.push(
                    childBoundary
                );
            }
        }
    }

    /*
     * ----------------------------------------
     * STEP 5
     * Final metadata.
     * ----------------------------------------
     */

    return candidates.map(region => {

        const outerArea =
            Math.abs(
                polygonArea(region.corners)
            );

        const holeArea =
            region.boundaryLoops
                .slice(1)
                .reduce(
                    (sum, loop) =>
                        sum +
                        Math.abs(
                            polygonArea(
                                loop.corners
                            )
                        ),
                    0
                );

        return {
            ...region,

            area:
                Math.max(
                    0,
                    outerArea - holeArea
                ),

            perimeter:
                polygonPerimeter(
                    region.corners
                ) +
                region.boundaryLoops
                    .slice(1)
                    .reduce(
                        (sum, loop) =>
                            sum +
                            polygonPerimeter(
                                loop.corners
                            ),
                        0
                    )
        };
    });
}

/*
 * ----------------------------------------
 * Polygon containment
 * ----------------------------------------
 */

function isPolygonContained(
    child: Vector3[],
    parent: Vector3[]
): boolean {

    if (
        child.length < 3 ||
        parent.length < 3
    ) {
        return false;
    }

    /*
     * Every child corner must be inside the parent.
     */

    for (const point of child) {

        if (
            !pointInPolygon(
                point,
                parent
            )
        ) {
            return false;
        }
    }

    /*
     * A child boundary must not cross
     * the parent boundary.
     */

    for (
        let i = 0;
        i < child.length;
        i++
    ) {

        const a1 = child[i];

        const a2 =
            child[
                (i + 1) % child.length
            ];

        for (
            let j = 0;
            j < parent.length;
            j++
        ) {

            const b1 = parent[j];

            const b2 =
                parent[
                    (j + 1) % parent.length
                ];

            if (
                segmentsProperlyCross(
                    a1,
                    a2,
                    b1,
                    b2
                )
            ) {
                return false;
            }
        }
    }

    return true;
}

/*
 * ----------------------------------------
 * Boundary comparison
 * ----------------------------------------
 */

function sameBoundary(
    a: BoundaryLoop,
    b: BoundaryLoop
): boolean {

    if (
        a.corners.length !==
        b.corners.length
    ) {
        return false;
    }

    return a.corners.every(
        point =>
            b.corners.some(
                other =>
                    point.distanceTo(other) <
                    0.0001
            )
    );
}

/*
 * ----------------------------------------
 * Segment intersection
 * ----------------------------------------
 *
 * Touching at an existing corner is allowed.
 * Actual crossing is not.
 */

function segmentsProperlyCross(
    a1: Vector3,
    a2: Vector3,
    b1: Vector3,
    b2: Vector3
): boolean {

    const o1 =
        orientation(
            a1,
            a2,
            b1
        );

    const o2 =
        orientation(
            a1,
            a2,
            b2
        );

    const o3 =
        orientation(
            b1,
            b2,
            a1
        );

    const o4 =
        orientation(
            b1,
            b2,
            a2
        );

    /*
     * If the boundaries only touch at a corner,
     * that is not considered crossing.
     */

    if (
        o1 === 0 ||
        o2 === 0 ||
        o3 === 0 ||
        o4 === 0
    ) {
        return false;
    }

    return (
        (o1 > 0) !== (o2 > 0) &&
        (o3 > 0) !== (o4 > 0)
    );
}

function orientation(
    a: Vector3,
    b: Vector3,
    c: Vector3
): number {

    const value =
        (b.x - a.x) *
        (c.z - a.z) -
        (b.z - a.z) *
        (c.x - a.x);

    if (
        Math.abs(value) <
        0.00001
    ) {
        return 0;
    }

    return value > 0
        ? 1
        : -1;
}