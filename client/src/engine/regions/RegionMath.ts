import type { Corner } from "../walls/Corner";

export function calculateArea(

    corners: Corner[]

): number {

    let area = 0;

    for (let i = 0; i < corners.length; i++) {

        const current = corners[i].position;
        const next = corners[(i + 1) % corners.length].position;

        area +=

            current.x * next.z -
            next.x * current.z;

    }

    return Math.abs(area) / 2;

}

export function calculatePerimeter(

    corners: Corner[]

): number {

    let length = 0;

    for (let i = 0; i < corners.length; i++) {

        const current = corners[i].position;
        const next = corners[(i + 1) % corners.length].position;

        length += current.distanceTo(next);

    }

    return length;

}