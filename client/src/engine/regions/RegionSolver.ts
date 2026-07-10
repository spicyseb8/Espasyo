import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

import { buildRegionGraph } from "./RegionGraph";
import { walkRegions } from "./RegionWalker";
import { polygonArea } from "./Polygon";

export function solveRegions(

    corners: Corner[],
    walls: Wall[]

) {

    const graph = buildRegionGraph(
        corners,
        walls
    );

    const polygons = walkRegions(graph);

    return polygons.filter(p =>

        p.corners.length >= 4 &&
        Math.abs(
            polygonArea(p.corners)
        ) > 0.01

    );

}