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

                polygon.push(
                    edge.from.position.clone()
                );

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

function removeDuplicatePolygons(
    polygons: RegionPolygon[]
): RegionPolygon[] {

    const unique: RegionPolygon[] = [];
    const seen = new Set<string>();

    for (const polygon of polygons) {

        const ids = polygon.corners
            .map(c => `${c.x},${c.z}`)
            .sort()
            .join("|");

        if (seen.has(ids))
            continue;

        seen.add(ids);

        unique.push(polygon);

    }

    return unique;

}