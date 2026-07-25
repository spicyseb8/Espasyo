import { memo } from "react";

import useEditor from "../../context/editor/useEditor";

import WallPiece from "./WallPiece";

import { buildWallMeshes } from "../../engine/walls/WallMeshBuilder";

function Walls() {

    const { state } = useEditor();

    return (

        <>

            {

                state.walls.map((wall) => {

                    //--------------------------------------------------
                    // Build renderable pieces
                    //--------------------------------------------------

                    const pieces = buildWallMeshes(

                        wall,

                        state.wallHeight,

                        state.wallThickness,

                        state.doors

                    );

                    //--------------------------------------------------
                    // Render every piece
                    //--------------------------------------------------

                    return (

                        <>

                            {

                                pieces.map((piece, index) => (

                                    <WallPiece

                                        key={`${wall.id}-${index}`}

                                        wallId={wall.id}

                                        piece={piece}

                                    />

                                ))

                            }

                        </>

                    );

                })

            }

        </>

    );

}

export default memo(Walls);