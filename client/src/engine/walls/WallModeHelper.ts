import { Vector3 } from "three";

import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";

import { closestPointOnWall } from "./wallSnapping";
import { splitWall } from "./wallSplit";

export function getNearestWallEndpoint(

    point: Vector3,

    wall: Wall

): Corner {

    const startDistance =
        point.distanceTo(wall.start.position);

    const endDistance =
        point.distanceTo(wall.end.position);

    return startDistance <= endDistance

        ? wall.start

        : wall.end;

}


export function splitWallAtPoint(

    wall: Wall,

    point: Vector3

) {

    const snappedPoint =
        closestPointOnWall(

            point,

            wall

        );

    const corner: Corner = {

        id: crypto.randomUUID(),

        position: snappedPoint

    };

    const [first, second] = splitWall(

        wall,

        corner

    );

    return {

        corner,

        first,

        second

    };

}


export function isNearEndpoint(

    point: Vector3,

    wall: Wall,

    tolerance = 0.15

): boolean {

    return (

        point.distanceTo(

            wall.start.position

        ) < tolerance ||

        point.distanceTo(

            wall.end.position

        ) < tolerance

    );

}

export function isOnWallBody(

    point: Vector3,

    wall: Wall,

    tolerance = 0.05

): boolean {

    const closest =
        closestPointOnWall(

            point,

            wall

        );

    return (

        point.distanceTo(

            closest

        ) < tolerance

    );

}