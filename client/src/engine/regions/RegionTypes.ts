import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

export interface GraphEdge {
    wall: Wall;
    to: Corner;
}

export interface GraphNode {
    corner: Corner;
    edges: GraphEdge[];
}

export interface Region {
    id: string;
    corners: Corner[];
}