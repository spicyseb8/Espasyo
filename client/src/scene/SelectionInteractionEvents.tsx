import {
    useEffect,
    useMemo
} from "react";

import {
    useThree
} from "@react-three/fiber";

import {
    Object3D,
    Raycaster,
    Vector2
} from "three";

import useEditor
    from "../context/editor/useEditor";

import {
    BuildTool
} from "../context/BuildTool";

function findSelectionId(
    object: Object3D
): {
    type:
        | "furniture"
        | "door"
        | "window";

    id: string;
} | null {

    let current:
        Object3D | null =
        object;

    while (
        current
    ) {

        if (
            typeof current.userData
                ?.furnitureId ===
            "string"
        ) {

            return {
                type:
                    "furniture",

                id:
                    current.userData
                        .furnitureId
            };
        }

        if (
            typeof current.userData
                ?.doorId ===
            "string"
        ) {

            return {
                type:
                    "door",

                id:
                    current.userData
                        .doorId
            };
        }

        if (
            typeof current.userData
                ?.windowId ===
            "string"
        ) {

            return {
                type:
                    "window",

                id:
                    current.userData
                        .windowId
            };
        }

        current =
            current.parent;
    }

    return null;
}

function isInsideUi(
    target: EventTarget | null
): boolean {

    const element =
        target as HTMLElement | null;

    if (!element) {
        return false;
    }

    return Boolean(
        element.closest(
            ".selection-toolbar"
        )
    );
}

export default function SelectionInteractionEvents() {

    const {
        gl,
        camera,
        scene
    } = useThree();

    const {
        state,
        dispatch
    } = useEditor();

    const raycaster =
        useMemo(
            () =>
                new Raycaster(),
            []
        );

    const pointer =
        useMemo(
            () =>
                new Vector2(),
            []
        );

    useEffect(
        () => {

            const canvas =
                gl.domElement;

            function onPointerDown(
                event: PointerEvent
            ) {

                if (
                    event.button !== 0
                ) {
                    return;
                }

                if (
                    state.walkthroughMode
                ) {
                    return;
                }

                //--------------------------------------------------
                // Do not interfere with active build placement.
                //--------------------------------------------------

                if (
                    state.buildTool !==
                    BuildTool.None
                ) {
                    return;
                }

                //--------------------------------------------------
                // Do not steal clicks from UI.
                //--------------------------------------------------

                if (
                    isInsideUi(
                        event.target
                    )
                ) {
                    return;
                }

                const rect =
                    canvas.getBoundingClientRect();

                if (
                    rect.width === 0 ||
                    rect.height === 0
                ) {
                    return;
                }

                pointer.x =
                    (
                        (
                            event.clientX -
                            rect.left
                        ) /
                        rect.width
                    ) * 2 - 1;

                pointer.y =
                    -(
                        (
                            event.clientY -
                            rect.top
                        ) /
                        rect.height
                    ) * 2 + 1;

                raycaster.setFromCamera(
                    pointer,
                    camera
                );

                const hits =
                    raycaster.intersectObjects(
                        scene.children,
                        true
                    );

                for (
                    const hit of hits
                ) {

                    const selection =
                        findSelectionId(
                            hit.object
                        );

                    if (
                        !selection
                    ) {
                        continue;
                    }

                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        selection.type ===
                        "furniture"
                    ) {

                        dispatch({
                            type:
                                "SELECT_FURNITURE",

                            payload:
                                selection.id
                        });

                        return;
                    }

                    if (
                        selection.type ===
                        "door"
                    ) {

                        dispatch({
                            type:
                                "SELECT_DOOR",

                            payload:
                                selection.id
                        });

                        return;
                    }

                    if (
                        selection.type ===
                        "window"
                    ) {

                        dispatch({
                            type:
                                "SELECT_WINDOW",

                            payload:
                                selection.id
                        });

                        return;
                    }
                }

                //--------------------------------------------------
                // Empty canvas.
                //--------------------------------------------------

                dispatch({
                    type:
                        "CLEAR_SELECTION"
                });
            }

            canvas.addEventListener(
                "pointerdown",
                onPointerDown
            );

            return () => {

                canvas.removeEventListener(
                    "pointerdown",
                    onPointerDown
                );
            };

        },
        [
            gl,
            camera,
            scene,
            state.walkthroughMode,
            state.buildTool,
            dispatch,
            raycaster,
            pointer
        ]
    );

    return null;
}