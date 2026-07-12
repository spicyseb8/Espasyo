import { Vector3 } from "three";
import type { GraphNode, HalfEdge } from "./RegionTypes";
import type { RegionPolygon } from "./Polygon";

export function walkRegions(
    graph: Map<string, GraphNode>
): RegionPolygon[] {

    const polygons: RegionPolygon[] = [];

    for (const node of graph.values()) {

        for (const startEdge of node.edges) {

            if (startEdge.visited)
                continue;

            const polygon: Vector3[] = [];

            let edge: HalfEdge | undefined = startEdge;

            while (edge) {

                if (edge.visited)
                    break;

                edge.visited = true;

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

                // Walk clockwise around the face
                let nextIndex = twinIndex - 1;

                if (nextIndex < 0)
                    nextIndex = nextNode.edges.length - 1;

                edge = nextNode.edges[nextIndex];

                if (
                    edge.from.id === startEdge.from.id &&
                    edge.to.id === startEdge.to.id
                ) {

                    polygons.push({

                        corners: polygon

                    });

                    break;

                }

            }

        }

    }

    return removeDuplicatePolygons(polygons);

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

    //------------------------------------
    // Clockwise
    //------------------------------------

    const clockwise = rotate(coords);

    //------------------------------------
    // Counter Clockwise
    //------------------------------------

    const counter = rotate(

        [...coords].reverse()

    );

    //------------------------------------
    // Choose canonical ordering
    //------------------------------------

    const cw = clockwise.join("|");

    const ccw = counter.join("|");

    return cw < ccw ? cw : ccw;

}

function removeDuplicatePolygons(
    polygons: RegionPolygon[]
): RegionPolygon[] {

    const unique: RegionPolygon[] = [];

    const seen = new Set<string>();

    for (const polygon of polygons) {

        const key = normalizePolygon(

            polygon.corners

        );

        if (seen.has(key))
            continue;

        seen.add(key);

        unique.push(polygon);

    }

    return unique;

}