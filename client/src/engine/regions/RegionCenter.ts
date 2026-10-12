
import type { Region } from "./Polygon";

interface PointXZ {
    x: number;
    z: number;
}

export interface RegionCenter {
    x: number;
    z: number;
}

interface PolygonStats {
    center: RegionCenter;
    area: number;
}

function getPolygonStats(
    points: readonly PointXZ[]
): PolygonStats | null {
    if (points.length < 3) {
        return null;
    }

    let twiceArea = 0;
    let weightedX = 0;
    let weightedZ = 0;

    for (let index = 0; index < points.length; index++) {
        const current = points[index];
        const next = points[(index + 1) % points.length];

        const cross =
            current.x * next.z -
            next.x * current.z;

        twiceArea += cross;
        weightedX += (current.x + next.x) * cross;
        weightedZ += (current.z + next.z) * cross;
    }

    if (Math.abs(twiceArea) < 0.000001) {
        const center = points.reduce(
            (result, point) => ({
                x: result.x + point.x / points.length,
                z: result.z + point.z / points.length
            }),
            { x: 0, z: 0 }
        );

        return {
            center,
            area: 0
        };
    }

    return {
        center: {
            x: weightedX / (3 * twiceArea),
            z: weightedZ / (3 * twiceArea)
        },
        area: Math.abs(twiceArea) / 2
    };
}

export function getRegionCenter(
    region: Region
): RegionCenter {
    const loops = region.boundaryLoops ?? [];

    const outer = loops[0]
        ? getPolygonStats(loops[0].corners)
        : null;

    if (!outer) {
        return { x: 0, z: 0 };
    }

    let totalArea = outer.area;
    let weightedX = outer.center.x * outer.area;
    let weightedZ = outer.center.z * outer.area;

    for (const loop of loops.slice(1)) {
        const hole = getPolygonStats(loop.corners);

        if (!hole || hole.area <= 0) {
            continue;
        }

        totalArea -= hole.area;
        weightedX -= hole.center.x * hole.area;
        weightedZ -= hole.center.z * hole.area;
    }

    if (totalArea <= 0.000001) {
        return outer.center;
    }

    return {
        x: weightedX / totalArea,
        z: weightedZ / totalArea
    };
}
