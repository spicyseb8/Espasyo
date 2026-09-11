import {
    useMemo
} from "react";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import Window from "./Window";


export default function Windows() {

    const {
        state
    } = useEditor();

    const windowElements =
        useMemo(

            () =>

                state.windows.map(
                    window => (

                        <Window
                            key={
                                window.id
                            }

                            window={
                                window
                            }

                        />

                    )
                ),

            [
                state.windows,

                //--------------------------------------------------
                // Important:
                //
                // Moving a window changes buildInteraction.moveTarget
                // and BuildTool changes at the same time.
                //
                // Include the current move target so this list
                // re-renders and hides the original window.
                //--------------------------------------------------

                state.buildTool,

                buildInteraction.moveTarget?.type,

                buildInteraction.moveTarget?.id
            ]

        );

    return (
        <>
            {
                windowElements
            }
        </>
    );
}