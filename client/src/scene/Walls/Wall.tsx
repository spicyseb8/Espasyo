import { memo, useState } from "react";

import useEditor from "../../context/editor/useEditor";

import type { Wall as WallType } from "../../engine/walls";

function WallComponent({

    wall,

}: {

    wall: WallType;

}) {

    const { state, dispatch } = useEditor();

    const [hovered, setHovered] = useState(false);

    const selected = state.selectedWallId === wall.id;

    const dx =

        wall.end.position.x -

        wall.start.position.x;

    const dz =

        wall.end.position.z -

        wall.start.position.z;

    const length = Math.sqrt(

        dx * dx +

        dz * dz

    );

    const angle = Math.atan2(

        dz,

        dx

    );

    const centerX =

        (

            wall.start.position.x +

            wall.end.position.x

        ) / 2;

    const centerZ =

        (

            wall.start.position.z +

            wall.end.position.z

        ) / 2;

    return (

        <mesh

            position={[

                centerX,

                wall.height / 2,

                centerZ

            ]}

            rotation={[

                0,

                -angle,

                0

            ]}

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

                    length,

                    wall.height,

                    wall.thickness

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

export default memo(WallComponent);