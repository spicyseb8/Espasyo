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
    console.log(`🔧 After walkRegions: ${regions.length} candidates`);

    const validRegions = regions.filter(region => {

        const area = Math.abs(
            polygonArea(region.corners)
        );

        return (
            region.corners.length >= 3 &&
            area > 0.01
        );
    });

    const minimalRegions = validRegions.filter(region => {
        const contained = validRegions.filter(
            other =>
                other.id !== region.id &&
                isPolygonContained(
                    other.corners,
                    region.corners
                )
        );

        if (contained.length <= 1) {
            return true;
        }

        return !isRedundantCompositeRegion(region, validRegions);
    });

    const classified = classifyRegionRelationships(
        minimalRegions
    );

    /*
     * A larger loop that encloses multiple room faces is not a valid room.
     * It is only the outer composite boundary created by adjacent rooms
     * sharing a wall or corner.
     */
    const removed: { id: string; reason: string }[] = [];
    const result = classified.filter(region => {
        const contained = classified.filter(
            other =>
                other.id !== region.id &&
                isPolygonContained(
                    other.corners,
                    region.corners
                )
        );

        const isComposite = isRedundantCompositeRegion(region, classified);

        if (isComposite) {
            removed.push({
                id: region.id,
                reason: `Composite union: contains ${contained.length} child regions with no extra boundary walls`
            });
            return false;
        }

        return true;
    });

    return result;
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

    console.group("📋 REGION RELATIONSHIPS AFTER CLASSIFICATION");
    for (const region of candidates) {
        console.log(`Region ${region.id}:`, {
            area: region.area.toFixed(2),
            parentId: region.parentRegionId || "NONE",
            childCount: region.childRegionIds.length,
            adjacentCount: region.adjacentRegionIds.length,
            relationships: region.relationshipSummary.join(", ")
        });
    }
    console.groupEnd();

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

function isPointOnSegment(
    point: Vector3,
    a: Vector3,
    b: Vector3,
    tolerance = 0.0001
): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segmentLengthSquared = dx * dx + dz * dz;

    if (segmentLengthSquared <= tolerance * tolerance) {
        return point.distanceTo(a) <= tolerance;
    }

    const t = ((point.x - a.x) * dx + (point.z - a.z) * dz) / segmentLengthSquared;
    if (t < 0 || t > 1) {
        return false;
    }

    const closestX = a.x + t * dx;
    const closestZ = a.z + t * dz;
    const distanceToSegment = Math.hypot(point.x - closestX, point.z - closestZ);

    return distanceToSegment <= tolerance;
}

function isPointOnPolygonBoundary(
    point: Vector3,
    polygon: Vector3[],
    tolerance = 0.0001
): boolean {
    return polygon.some((corner, index) => {
        const next = polygon[(index + 1) % polygon.length];
        return isPointOnSegment(point, corner, next, tolerance);
    });
}

function pointInOrOnPolygon(
    point: Vector3,
    polygon: Vector3[]
): boolean {
    return pointInPolygon(point, polygon) || isPointOnPolygonBoundary(point, polygon);
}

function isRedundantCompositeRegion(
    region: Region,
    regions: Region[]
): boolean {
    const contained = regions.filter(
        other =>
            other.id !== region.id &&
            isPolygonContained(
                other.corners,
                region.corners
            )
    );

    if (contained.length <= 1) {
        return false;
    }

    const parentWallIds = new Set(
        region.walls.map(wall => wall.id)
    );

    const childWallIds = new Set(
        contained.flatMap(other =>
            other.walls.map(wall => wall.id)
        )
    );

    const hasExtraBoundary =
        Array.from(parentWallIds).some(
            wallId => !childWallIds.has(wallId)
        );

    return !hasExtraBoundary;
}

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
     * Every child corner may lie inside the parent or exactly on its boundary.
     * Shared edges between a composite outer boundary and its contained child rooms
     * are valid and should not cause the relationship to be rejected.
     */

    for (const point of child) {

        if (
            !pointInOrOnPolygon(
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
     * Collinear overlap along a shared wall is allowed and should be treated as a
     * composite boundary condition rather than a boundary violation.
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

    if (
        o1 === 0 &&
        o2 === 0 &&
        o3 === 0 &&
        o4 === 0
    ) {
        return false;
    }

    /*
     * If either segment only touches the other at an endpoint or sits along the
     * same line, it is not a proper crossing.
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