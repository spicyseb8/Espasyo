import { Vector3 } from "three";
import type { GraphNode, HalfEdge } from "./RegionTypes";
import type { Region } from "./Polygon";

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
                        area: Math.abs(polygonArea(polygon)),
                        perimeter: polygonPerimeter(polygon),
                        relationshipSummary: []
                    };

                    regions.push(region);
                    break;

                }

            }

        }

    }

    return removeDuplicateRegions(regions);

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

    for (const region of regions) {

        const key = normalizePolygon(
            region.corners
        );

        if (seen.has(key))
            continue;

        seen.add(key);

        unique.push(region);

    }

    return unique;

}