import { Vector3 } from "three";
import type { GraphNode, HalfEdge } from "./RegionTypes";
import type { Region } from "./Polygon";
import { pointInPolygon } from "./Polygon";

function createRegionId(points: Vector3[]): string {
    const normalized = normalizePolygon(points);
    return `region-${normalized
        .split("")
        .map(char => char.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")}`;
}

export function walkRegions(
    graph: Map<string, GraphNode>
): Region[] {

    const regions: Region[] = [];

    for (const node of graph.values()) {

        for (const startEdge of node.edges) {

            if (startEdge.visited)
                continue;

            const polygon: Vector3[] = [];
            const wallIds = new Set<string>();

            let edge: HalfEdge | undefined = startEdge;

            while (edge) {

                if (edge.visited)
                    break;

                edge.visited = true;

                wallIds.add(edge.wall.id);

                const p = edge.from.position;
                const last = polygon[polygon.length - 1];
                if (
                    !last ||
                    !last.equals(p)
                ) {
                    polygon.push(
                        p.clone()
                    );
                }
                const nextNode = graph.get(edge.to.id);

                if (!nextNode)
                    break;

                const twin = edge.twin!;

                const twinIndex = nextNode.edges.findIndex(

                    e => e === twin

                );

                if (twinIndex === -1)
                    break;

                let nextIndex = twinIndex - 1;

                if (nextIndex < 0)
                    nextIndex = nextNode.edges.length - 1;

                edge = nextNode.edges[nextIndex];

                if (
                    edge.from.id === startEdge.from.id &&
                    edge.to.id === startEdge.to.id
                ) {

                    const walls = Array.from(wallIds)
                        .map(id => {
                            return graph.get(node.corner.id)?.edges.find(
                                halfEdge => halfEdge.wall.id === id
                            )?.wall;
                        })
                        .filter((wall): wall is NonNullable<typeof wall> => Boolean(wall));

                    const area = Math.abs(polygonArea(polygon));
                    const perimeter = polygonPerimeter(polygon);

                    const region: Region = {
                        id: createRegionId(polygon),
                        corners: polygon,
                        walls,
                        parentRegionId: null,
                        childRegionIds: [],
                        adjacentRegionIds: [],
                        boundaryLoops: [{
                            corners: polygon,
                            wallIds: Array.from(wallIds)
                        }],
                        area: area,
                        perimeter: perimeter,
                        relationshipSummary: []
                    };

                    regions.push(region);
                    break;

                }

            }

        }

    }

    return pruneCompositeRegions(removeDuplicateRegions(regions));

}


function polygonArea(points: Vector3[]) {
    let area = 0;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a.x * b.z - b.x * a.z;
    }

    return area / 2;
}

function polygonPerimeter(points: Vector3[]) {
    if (points.length < 2) {
        return 0;
    }

    let perimeter = 0;

    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        perimeter += current.distanceTo(next);
    }

    return perimeter;
}

function normalizePolygon(points: Vector3[]): string {

    const coords = points.map(
        p => `${p.x},${p.z}`
    );

    function rotate(list: string[]) {

        let smallest = 0;

        for (let i = 1; i < list.length; i++) {

            if (list[i] < list[smallest]) {

                smallest = i;

            }

        }

        return [

            ...list.slice(smallest),

            ...list.slice(0, smallest)

        ];

    }

    const clockwise = rotate(coords);
    const counter = rotate(
        [...coords].reverse()
    );

    const cw = clockwise.join("|");
    const ccw = counter.join("|");

    return cw < ccw ? cw : ccw;

}

function removeDuplicateRegions(
    regions: Region[]
): Region[] {

    const unique: Region[] = [];

    const seen = new Set<string>();

    const removed: { id: string; reason: string }[] = [];

    for (const region of regions) {

        const key = normalizePolygon(
            region.corners
        );

        if (seen.has(key)) {
            removed.push({ id: region.id, reason: "Duplicate polygon detected" });
            continue;
        }

        seen.add(key);

        unique.push(region);

    }

    return unique;

}

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

function isPolygonContained(
    child: Vector3[],
    parent: Vector3[]
): boolean {
    if (child.length < 3 || parent.length < 3) {
        return false;
    }

    return child.every(point => pointInOrOnPolygon(point, parent));
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

function pruneCompositeRegions(
    regions: Region[]
): Region[] {
    const kept: Region[] = [];
    const removed: { id: string; reason: string }[] = [];

    for (const region of regions) {
        const contained = regions.filter(
            other =>
                other.id !== region.id &&
                isPolygonContained(
                    other.corners,
                    region.corners
                )
        );

        const isComposite = isRedundantCompositeRegion(region, regions);

        if (isComposite) {
            removed.push({ 
                id: region.id, 
                reason: `Composite union: contains ${contained.length} smaller regions with no extra boundary walls` 
            });
            continue;
        }

        kept.push(region);
    }

    return kept;
}