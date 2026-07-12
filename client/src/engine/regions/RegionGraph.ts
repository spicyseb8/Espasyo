import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";
import type { HalfEdge, GraphNode } from "./RegionTypes";

export function buildRegionGraph(
    corners: Corner[],
    walls: Wall[]
): Map<string, GraphNode> {

    const graph = new Map<string, GraphNode>();

    for (const c of corners) {

        graph.set(c.id, {

            corner: c,

            edges: []

        });

    }

    for (const wall of walls) {

        const dx =
            wall.end.position.x -
            wall.start.position.x;

        const dz =
            wall.end.position.z -
            wall.start.position.z;

        const angleAB =
            Math.atan2(dz, dx);

        const angleBA =
            Math.atan2(-dz, -dx);

        const ab: HalfEdge = {

            wall,

            from: wall.start,

            to: wall.end,

            angle: angleAB,

            visited: false

        };

        const ba: HalfEdge = {

            wall,

            from: wall.end,

            to: wall.start,

            angle: angleBA,

            visited: false

        };

        ab.twin = ba;
        ba.twin = ab;

        graph
            .get(wall.start.id)!
            .edges
            .push(ab);

        graph
            .get(wall.end.id)!
            .edges
            .push(ba);

    }

    for (const node of graph.values()) {

        node.edges.sort(

            (a, b) => a.angle - b.angle

        );

    }

    return graph;

}