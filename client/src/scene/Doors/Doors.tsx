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

import Door
    from "./Door";


export default function Doors() {

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
