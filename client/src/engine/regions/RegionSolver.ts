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

    return polygons.filter(p => {

    const area = Math.abs(
        polygonArea(p.corners)
    );

    return (
        p.corners.length >= 3 &&
        area > 0.01
    );

});

}