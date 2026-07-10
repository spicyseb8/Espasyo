import useEditor from "../context/editor/useEditor";

export default function ClearSelection() {

    const { dispatch } = useEditor();

    return (

        <mesh

            rotation={[-Math.PI / 2, 0, 0]}

            onClick={() => {

                dispatch({

                    type: "SELECT_WALL",

                    payload: null

                });

            }}

        >

            <planeGeometry

                args={[5000, 5000]}

            />

            <meshBasicMaterial

                transparent

                opacity={0}

            />

        </mesh>

    );

}