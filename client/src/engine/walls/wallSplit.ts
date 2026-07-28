import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";

export function splitWall(

    wall: Wall,

    splitCorner: Corner

): [Wall, Wall] {

    const leftWall: Wall = {

        id: crypto.randomUUID(),

        start: wall.start,

        end: splitCorner

    };

    const rightWall: Wall = {

        id: crypto.randomUUID(),

        start: splitCorner,

        end: wall.end

    };

    return [

        leftWall,

        rightWall

    ];

}