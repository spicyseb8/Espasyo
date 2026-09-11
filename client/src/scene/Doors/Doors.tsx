import {
    useMemo
} from "react";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import Door from "./Door";


export default function Doors() {

    const {
        state
    } = useEditor();

    const doorElements =
        useMemo(

            () =>

                state.doors.map(
                    door => (

                        <Door
                            key={
                                door.id
                            }

                            door={
                                door
                            }

                        />

                    )
                ),

            [
                state.doors,

                //--------------------------------------------------
                // Important:
                //
                // Re-render when Door Move starts/ends.
                //--------------------------------------------------

                state.buildTool,

                buildInteraction.moveTarget?.type,

                buildInteraction.moveTarget?.id
            ]

        );

    return (
        <>
            {
                doorElements
            }
        </>
    );
}