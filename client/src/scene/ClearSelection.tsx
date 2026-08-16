import useEditor from "../context/editor/useEditor";
import { Tool } from "../context/editor/tools";

export default function ClearSelection() {

    const { state, dispatch } = useEditor();

    return (

        <mesh

            rotation={[-Math.PI / 2, 0, 0]}

            onClick={() => {

                if (state.activeTool === Tool.Wall)
                    return;

                dispatch({
                    type: "SELECT_WALL",
                    payload: null
                });

                dispatch({
                    type: "SELECT_REGION",
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