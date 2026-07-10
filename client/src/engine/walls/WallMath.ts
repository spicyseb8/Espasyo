import { Vector3 } from "three";

export function wallLength(

    start: Vector3,

    end: Vector3

): number {

    return start.distanceTo(end);

}

export function wallCenter(

    start: Vector3,

    end: Vector3

): Vector3 {

    return new Vector3(

        (start.x + end.x) / 2,

        (start.y + end.y) / 2,

        (start.z + end.z) / 2

    );

}

export function wallAngle(

    start: Vector3,

    end: Vector3

): number {

    return Math.atan2(

        end.z - start.z,

        end.x - start.x

    );

}