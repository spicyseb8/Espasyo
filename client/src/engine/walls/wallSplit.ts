import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";

export function splitWall(
    wall: Wall,
    corner: Corner
): [Wall, Wall] {

    if (
        corner.id === wall.start.id ||
        corner.id === wall.end.id
    ) {

        throw new Error("Cannot split wall on an endpoint.");

    }

    return [

        {

            ...wall,

            id: crypto.randomUUID(),

            start: wall.start,

            end: corner

        },

        {

            ...wall,

            id: crypto.randomUUID(),

            start: corner,

            end: wall.end

        }

    ];

}