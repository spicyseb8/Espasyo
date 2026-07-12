import type { Wall } from "./WallTypes";

function isSameWall(
    a: Wall,
    b: Wall
) {

    return (

        (

            a.start.id === b.start.id &&

            a.end.id === b.end.id

        )

        ||

        (

            a.start.id === b.end.id &&

            a.end.id === b.start.id

        )

    );

}

export function removeDuplicateWalls(

    walls: Wall[]

): Wall[] {

    const unique: Wall[] = [];

    for (const wall of walls) {

        const exists = unique.some(

            other => isSameWall(

                wall,

                other

            )

        );

        if (!exists) {

            unique.push(wall);

        }

    }

    return unique;

}