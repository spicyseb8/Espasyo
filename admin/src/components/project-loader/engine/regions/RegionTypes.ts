import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

export interface HalfEdge {

    wall: Wall;

    from: Corner;

    to: Corner;

    angle: number;

    twin?: HalfEdge;

    visited: boolean;

}

export interface GraphNode {

    corner: Corner;

    edges: HalfEdge[];

}