import useEditor from "../../context/editor/useEditor";

import Wall from "./Wall";
import { useMemo } from "react";

export default function Walls() {

    const { state } = useEditor();

    const wallElements = useMemo(() => 
        state.walls.map((wall) => (
            <Wall
                key={wall.id}
                wall={wall}
            />
        )),
        [state.walls]
    );

    return (

        <>

            {wallElements}

        </>

    );

}