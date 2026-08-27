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

    //==================================================
    // Current regions
    //==================================================

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

        <group>

            {
                state.walls.map(
                    wall => {

                        //==================================================
                        // Build visible wall pieces
                        //==================================================

                        const pieces =
                            buildWallMeshes(

                                wall,

                                state.wallHeight,

                                state.wallThickness,

                                state.doors

                            );

                        //==================================================
                        // Determine wall finishes
                        //
                        // A shared wall can have two sides:
                        //
                        // Room A → material A
                        // Room B → material B
                        //==================================================

                        const finishSides =
                            getWallFinishSides(

                                wall,

                                regions,

                                state.wallFinishes

                            );

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