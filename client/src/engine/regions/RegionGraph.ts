import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

export interface Edge {
    wall: Wall;
    from: Corner;
    to: Corner;
}

export interface GraphNode {
    corner: Corner;
    edges: Edge[];
}

export function buildRegionGraph(
    corners: Corner[],
    walls: Wall[]
): Map<string, GraphNode> {

    const graph = new Map<string, GraphNode>();

    for (const corner of corners) {

        graph.set(corner.id, {
            corner,
            edges: []
        });

    }

    for (const wall of walls) {

        graph.get(wall.start.id)?.edges.push({
            wall,
            from: wall.start,
            to: wall.end
        });

        graph.get(wall.end.id)?.edges.push({
            wall,
            from: wall.end,
            to: wall.start
        });

    }

    return graph;

}