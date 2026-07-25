import { memo, useState } from "react";

import useEditor from "../../context/editor/useEditor";

import type { WallPiece as WallPieceType } from "../../engine/walls/WallPiece";

interface Props {

    wallId: string;

    piece: WallPieceType;

}

function WallPiece({

    wallId,

    piece

}: Props) {

    const { state, dispatch } = useEditor();

    const [hovered, setHovered] = useState(false);

    const selected =
        state.selectedWallId === wallId;

    return (

        <mesh

            position={piece.position}

            rotation={[

                0,

                -piece.rotationY,

                0

            ]}

            userData={{

                wallId

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

                    payload: wallId

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

    );

}

export default memo(WallPiece);