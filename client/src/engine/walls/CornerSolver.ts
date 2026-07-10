import { Vector3 } from "three";
import type { Corner } from "./Corner";

export function findExistingCorner(
    position: Vector3,
    corners: Corner[],
    tolerance = 0.05
): Corner | null {

    let nearest: Corner | null = null;
    let nearestDistance = tolerance;

    for (const corner of corners) {

        const distance = corner.position.distanceTo(position);

        if (distance < nearestDistance) {

            nearestDistance = distance;
            nearest = corner;

        }

    }

    return nearest;

}

export function findOrCreateCorner(
    position: Vector3,
    corners: Corner[]
): {
    corner: Corner;
    isNew: boolean;
} {

    const existing = findExistingCorner(position, corners);

    if (existing) {

        return {

            corner: existing,

            isNew: false

        };

    }

    const corner: Corner = {

        id: crypto.randomUUID(),

        position: position.clone()

    };

    return {

        corner,

        isNew: true

    };

}