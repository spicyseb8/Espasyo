import { Vector3 } from "three";
import type { GraphNode } from "./RegionGraph";
import type { RegionPolygon } from "./Polygon";

export function walkRegions(
    graph: Map<string, GraphNode>
): RegionPolygon[] {

    const polygons: RegionPolygon[] = [];

    const visited = new Set<string>();

    for (const node of graph.values()) {

        for (const edge of node.edges) {

            const key = edge.from.id + "_" + edge.to.id;

            if (visited.has(key))
                continue;

            const polygon: Vector3[] = [];

            let current = edge;

            while (true) {

                visited.add(current.from.id + "_" + current.to.id);

                polygon.push(
                    current.from.position.clone()
                );

                const nextNode = graph.get(current.to.id);

                if (!nextNode)
                    break;

                const next = nextNode.edges.find(
                    e =>
                        e.to.id !== current.from.id &&
                        !visited.has(
                            e.from.id + "_" + e.to.id
                        )
                );

                if (!next)
                    break;

                current = next;

                if (current.to.id === edge.from.id) {

                    polygon.push(
                        current.from.position.clone()
                    );

                    polygons.push({
                        corners: polygon
                    });

                    break;

                }

            }

        }

    }

    return polygons;

}