import { useMemo } from "react";

import useEditor from "../../context/editor/useEditor";

import Door from "./Door";

export default function Doors() {

    const { state } = useEditor();

    const doorElements = useMemo(

        () =>

            state.doors.map(

                door => (

                    <Door

                        key={door.id}

                        door={door}

                    />

                )

            ),

        [state.doors]

    );

    return <>{doorElements}</>;

}