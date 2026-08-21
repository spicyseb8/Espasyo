import { useMemo } from "react";

import useEditor from "../../context/editor/useEditor";

import Window from "./Window";

export default function Windows() {

    const { state } =
        useEditor();

    const windowElements =
        useMemo(

            () =>

                state.windows.map(
                    window => (

                        <Window
                            key={window.id}
                            window={window}
                        />

                    )
                ),

            [state.windows]
        );

    return (
        <>
            {windowElements}
        </>
    );
}