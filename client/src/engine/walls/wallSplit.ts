import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";

export function splitWall(
    wall: Wall,
    corner: Corner
): [Wall, Wall] {

    return [

        {
            id: crypto.randomUUID(),
            start: wall.start,
            end: corner
        },

        {
            id: crypto.randomUUID(),
            start: corner,
            end: wall.end
        }

    ];

}