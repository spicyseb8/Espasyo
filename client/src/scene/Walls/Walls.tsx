import { memo } from "react";

import useEditor from "../../context/editor/useEditor";

import WallPiece from "./WallPiece";

import { buildWallMeshes } from "../../engine/walls/WallMeshBuilder";

function Walls() {

    const { state } = useEditor();

    return (
        <>
            {state.walls.map((wall) => {

                const pieces = buildWallMeshes(
                    wall,
                    state.wallHeight,
                    state.wallThickness,
                    state.doors,
                    state.openings
                );

                return (
                    <group key={wall.id}>

                        {pieces.map((piece, index) => (

                            <WallPiece
                                key={`${wall.id}-${piece.kind}-${index}`}
                                wallId={wall.id}
                                piece={piece}
                            />

                        ))}

                    </group>
                );

            })}
        </>
    );
}

export default memo(Walls);