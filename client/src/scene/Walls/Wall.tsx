import { memo, useState } from "react";

import useEditor from "../../context/editor/useEditor";

import type { Wall as WallType } from "../../engine/walls";

import { buildWallMeshes } from "../../engine/walls/WallMeshBuilder";

function WallComponent({

    wall,

}: {

    wall: WallType;

}) {

    const { state, dispatch } = useEditor();

    const [hovered, setHovered] = useState(false);

    const selected =

        state.selectedWallId === wall.id;

    //--------------------------------------------------
    // Global Settings
    //--------------------------------------------------

    const height = state.wallHeight;

    const thickness = state.wallThickness;

    //--------------------------------------------------
    // Build Wall Pieces
    //--------------------------------------------------

    const pieces = buildWallMeshes(
    wall,
    height,
    thickness,
    state.doors,
    state.openings
);

    return (

        <>

            {

                pieces.map((piece, index) => (

                    <mesh

                        key={`${wall.id}-${piece.kind}-${index}`}

                        position={piece.position}

                        rotation={[

                            0,

                            -piece.rotationY,

                            0

                        ]}

                        userData={{

                            wallId: wall.id

                        }}

                        onPointerOver={(e) => {

                            e.stopPropagation();

                            setHovered(true);

                        }}

                        onPointerOut={() => {

                            setHovered(false);

                        }}

                        onClick={(e) => {

                            e.stopPropagation();

                            dispatch({

                                type: "SELECT_WALL",

                                payload: wall.id

                            });

                        }}

                    >

                        <boxGeometry

                            args={[

                                piece.width,

                                piece.height,

                                piece.thickness

                            ]}

                        />

                        <meshStandardMaterial

                            color={

                                selected

                                    ? "#2196F3"

                                    : hovered

                                    ? "#8CC8FF"

                                    : "#D9D9D9"

                            }

                        />

                    </mesh>

                ))

            }

        </>

    );

}

export default memo(WallComponent);