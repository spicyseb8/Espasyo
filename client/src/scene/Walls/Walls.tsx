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
    // Regions
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

    //--------------------------------------------------
    // Render walls
    //--------------------------------------------------

    return (

        <group>

            {
                state.walls.map(
                    wall => {

                        //--------------------------------------------------
                        // BUILD WALL PIECES
                        //--------------------------------------------------

                        const pieces =
                            buildWallMeshes(

                                wall,

                                state.wallHeight,

                                state.wallThickness,

                                state.doors,

                                state.openings,

                                state.windows

                            );

                        //--------------------------------------------------
                        // WALL FINISH
                        //--------------------------------------------------

                        const finishSides =
                            getWallFinishSides(

                                wall,

                                regions,

                                state.wallFinishes

                            );

                        //--------------------------------------------------
                        // DEBUG:
                        //
                        // Count how many pieces this wall currently has.
                        //
                        // Normal wall with no cutouts:
                        //
                        //      1 piece
                        //
                        // Wall with rectangular opening:
                        //
                        //      usually 3 pieces
                        //
                        //--------------------------------------------------



                        //--------------------------------------------------
                        // Temporary visual indication.
                        //
                        // Walls with openings/windows become slightly
                        // blue so we can see whether WallMeshBuilder
                        // recognizes them.
                        //--------------------------------------------------

                        return (

                            <group
                                key={
                                    wall.id
                                }
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

        </group>

    );
}

export default memo(
    Walls
);