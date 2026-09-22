import {
    useEffect,
    useMemo,
    useState
} from "react";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import {
    getDoorWindowAssets
} from "../../engine/build/FirebaseDoorWindowLibrary";

import Window
    from "./Window";


export default function Windows() {

    const {
        state
    } = useEditor();

    const [
        firebaseLoaded,
        setFirebaseLoaded
    ] = useState(false);


    useEffect(
        () => {

            let cancelled =
                false;

            getDoorWindowAssets()
                .then(
                    () => {

                        if (
                            !cancelled
                        ) {

                            setFirebaseLoaded(
                                true
                            );

                        }
                    }
                )
                .catch(
                    error => {

                        console.error(
                            "Failed to load Firebase door/window catalog:",
                            error
                        );

                        if (
                            !cancelled
                        ) {

                            setFirebaseLoaded(
                                true
                            );

                        }
                    }
                );

            return () => {

                cancelled =
                    true;

            };

        },
        []
    );

    void firebaseLoaded;


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
