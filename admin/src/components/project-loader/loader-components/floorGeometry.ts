import { Path, Shape, ShapeGeometry } from "three";
import type { Region } from "../engine/regions/Polygon";

export function createAdminFloorGeometry(
    boundaryLoops: Region["boundaryLoops"]
): ShapeGeometry | null {
    const loops = boundaryLoops ?? [];
    if (loops.length === 0) return null;

    const outer = loops[0].corners.filter(Boolean);
    if (outer.length < 3) return null;

    const shape = new Shape();
    shape.moveTo(outer[0].x, -outer[0].z);
    for (let index = 1; index < outer.length; index += 1) {
        shape.lineTo(outer[index].x, -outer[index].z);
    }
    shape.closePath();

    shape.holes = loops
        .slice(1)
        .map(loop => {
            const points = loop.corners.filter(Boolean);
            if (points.length < 3) return null;

            const hole = new Path();
            hole.moveTo(points[0].x, -points[0].z);
            for (let index = 1; index < points.length; index += 1) {
                hole.lineTo(points[index].x, -points[index].z);
            }
            hole.closePath();
            return hole;
        })
        .filter((hole): hole is Path => hole !== null);

    return new ShapeGeometry(shape);
}
