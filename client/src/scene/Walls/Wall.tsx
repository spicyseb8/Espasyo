import {
    memo,
    useMemo
} from "react";

import useEditor
    from "../../context/editor/useEditor";

import WallPiece
    from "./WallPiece";

import {
    buildWallMeshes
} from "../../engine/walls/WallMeshBuilder";

import {
    solveRegions
} from "../../engine/regions/RegionSolver";

import {
    getWallFinishSides
} from "./WallFinishUtils";

function Walls() {

    const {
        state
    } = useEditor();

    //--------------------------------------------------
    // Calculate regions once per layout change
    //--------------------------------------------------

    const regions =
        useMemo(
            () =>
                solveRegions(
                    state.corners,
                    state.walls
                ),
            [
                state.corners,
                state.walls
            ]
        );

    return (

        <>

            {
                state.walls.map(
                    wall => {

                        //--------------------------------------------------
                        // Build wall pieces
                        //--------------------------------------------------

                        const pieces =
                            buildWallMeshes(

                                wall,

                                state.wallHeight,

                                state.wallThickness,

                                state.doors

                            );

                        //--------------------------------------------------
                        // Find material assignments for this wall.
                        //
                        // Shared walls may produce two sides.
                        //--------------------------------------------------

                        const finishSides =
                            getWallFinishSides(

                                wall,

                                regions,

                                state.wallFinishes

                            );

                        //--------------------------------------------------
                        // Render pieces
                        //--------------------------------------------------

                       return (

    <group
        key={wall.id}
    >

        {
            pieces.map(
                (
                    piece,
                    index
                ) => (

                    <WallPiece

                        key={
                            `${wall.id}-${index}`
                        }

                        wallId={
                            wall.id
                        }

                        piece={
                            piece
                        }

                        finishSides={
                            finishSides
                        }

                    />

                )
            )
        }

    </group>

);
                    }
                )
            }

        </>

    );
}

export default memo(
    Walls
);