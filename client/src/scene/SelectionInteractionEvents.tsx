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
):
    | {
        type:
            | "furniture"
            | "door"
            | "window";
        id: string;
    }
    | null {

    let current: Object3D | null = object;

    while (current) {

        if (
            typeof current.userData?.furnitureId ===
            "string"
        ) {
            return {
                type: "furniture",
                id: current.userData.furnitureId
            };
        }

        if (
            typeof current.userData?.doorId ===
            "string"
        ) {
            return {
                type: "door",
                id: current.userData.doorId
            };
        }

        if (
            typeof current.userData?.windowId ===
            "string"
        ) {
            return {
                type: "window",
                id: current.userData.windowId
            };
        }

        current = current.parent;
    }

    return null;
}

// Identify floor and wall meshes so their clicks
// are not mistaken for empty-scene clicks.
function isFloorOrWall(
    object: Object3D
): boolean {

    let current: Object3D | null = object;

    while (current) {

        if (
            current.userData?.isFloor === true
        ) {
            return true;
        }

        if (
            typeof current.userData?.wallId ===
            "string"
        ) {
            return true;
        }

        current = current.parent;
    }

    return false;
}

function isInsideUi(
    target: EventTarget | null
): boolean {

    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(
        target.closest(
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

    const raycaster = useMemo(
        () => new Raycaster(),
        []
    );

    const pointer = useMemo(
        () => new Vector2(),
        []
    );

    useEffect(() => {

        const canvas = gl.domElement;

        // Right-click clears the current selection.
        function onRightPointerDown(
            event: PointerEvent
        ) {

            if (event.button !== 2) {
                return;
            }

            if (state.walkthroughMode) {
                return;
            }

            dispatch({
                type: "CLEAR_SELECTION"
            });
        }

        function onClick(
            event: MouseEvent
        ) {

            // Only process clicks on the scene canvas.
            if (event.target !== canvas) {
                return;
            }

            if (isInsideUi(event.target)) {
                return;
            }

            if (state.walkthroughMode) {
                return;
            }

            if (
                state.buildTool !==
                BuildTool.None
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
                ) *
                2 - 1;

            pointer.y =
                -(
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height
                ) *
                2 + 1;

            raycaster.setFromCamera(
                pointer,
                camera
            );

            const hits =
                raycaster.intersectObjects(
                    scene.children,
                    true
                );

            for (const hit of hits) {

                // Handle furniture, doors, and windows.
                const selection =
                    findSelectionId(
                        hit.object
                    );

                if (selection) {

                    if (
                        selection.type ===
                        "furniture"
                    ) {
                        dispatch({
                            type: "SELECT_FURNITURE",
                            payload: selection.id
                        });

                        return;
                    }

                    if (
                        selection.type ===
                        "door"
                    ) {
                        dispatch({
                            type: "SELECT_DOOR",
                            payload: selection.id
                        });

                        return;
                    }

                    if (
                        selection.type ===
                        "window"
                    ) {
                        dispatch({
                            type: "SELECT_WINDOW",
                            payload: selection.id
                        });

                        return;
                    }
                }

                // Floor.tsx and WallPiece.tsx handle
                // their own selection. Do not clear
                // their selection from this handler.
                if (
                    isFloorOrWall(
                        hit.object
                    )
                ) {
                    return;
                }
            }

            // No selectable furniture, door, window,
            // floor, or wall was hit.
            dispatch({
                type: "CLEAR_SELECTION"
            });
        }

        function onContextMenu(
            event: MouseEvent
        ) {
            event.preventDefault();
        }

        window.addEventListener(
            "pointerdown",
            onRightPointerDown,
            true
        );

        window.addEventListener(
            "click",
            onClick
        );

        document.addEventListener(
            "contextmenu",
            onContextMenu,
            true
        );

        return () => {

            window.removeEventListener(
                "pointerdown",
                onRightPointerDown,
                true
            );

            window.removeEventListener(
                "click",
                onClick
            );

            document.removeEventListener(
                "contextmenu",
                onContextMenu,
                true
            );
        };

    }, [
        gl,
        camera,
        scene,
        state.walkthroughMode,
        state.buildTool,
        dispatch,
        raycaster,
        pointer
    ]);

    return null;
}