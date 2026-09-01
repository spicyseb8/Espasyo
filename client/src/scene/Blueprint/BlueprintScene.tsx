import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    useThree
} from "@react-three/fiber";

import {
    DoubleSide,
    Plane,
    Raycaster,
    Texture,
    TextureLoader,
    Vector2,
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import {
    snapBlueprintPosition
} from "../../engine/blueprint/BlueprintSnapping";

export default function BlueprintScene() {

    const {
        state,
        dispatch
    } = useEditor();

    const blueprint =
        state.blueprint;

    const {
        camera,
        gl
    } = useThree();

    const [
        texture,
        setTexture
    ] = useState<Texture | null>(null);

    //--------------------------------------------------
    // Dragging
    //--------------------------------------------------

    const dragging =
        useRef(false);

    const dragOffset =
        useRef({
            x: 0,
            z: 0
        });

    //--------------------------------------------------
    // Raycaster
    //--------------------------------------------------

    const raycaster =
        useMemo(
            () =>
                new Raycaster(),
            []
        );

    //--------------------------------------------------
    // Horizontal floor plane
    //--------------------------------------------------

    const groundPlane =
        useMemo(
            () =>
                new Plane(
                    new Vector3(
                        0,
                        1,
                        0
                    ),
                    0
                ),
            []
        );

    //--------------------------------------------------
    // Load texture
    //--------------------------------------------------

    useEffect(() => {

        if (!blueprint) {

            setTexture(
                previous => {

                    previous?.dispose();

                    return null;

                }
            );

            return;

        }

        const loader =
            new TextureLoader();

        let cancelled =
            false;

        loader.load(

            blueprint.url,

            loadedTexture => {

                if (cancelled) {

                    loadedTexture.dispose();

                    return;

                }

                loadedTexture.needsUpdate =
                    true;

                setTexture(
                    previous => {

                        previous?.dispose();

                        return loadedTexture;

                    }
                );

            }

        );

        return () => {

            cancelled = true;

        };

    }, [
        blueprint?.url
    ]);

    //--------------------------------------------------
    // Blueprint dimensions
    //--------------------------------------------------

    const height =
        blueprint
            ? blueprint.width /
              blueprint.aspectRatio
            : 1;

    //--------------------------------------------------
    // Convert screen coordinate to floor coordinate
    //--------------------------------------------------

    function getFloorPoint(
        clientX: number,
        clientY: number
    ): Vector3 | null {

        const rect =
            gl.domElement.getBoundingClientRect();

        if (
            rect.width === 0 ||
            rect.height === 0
        ) {

            return null;

        }

        const ndcX =
            (
                (
                    clientX -
                    rect.left
                ) /
                rect.width
            ) * 2 - 1;

        const ndcY =
            -(
                (
                    clientY -
                    rect.top
                ) /
                rect.height
            ) * 2 + 1;

        const pointer =
            new Vector2(
                ndcX,
                ndcY
            );

        raycaster.setFromCamera(
            pointer,
            camera
        );

        const point =
            new Vector3();

        const hit =
            raycaster.ray.intersectPlane(
                groundPlane,
                point
            );

        return hit
            ? point
            : null;
    }

    //--------------------------------------------------
    // Drag movement
    //--------------------------------------------------

    function handleWindowPointerMove(
        event: PointerEvent
    ) {

        if (
            !dragging.current ||
            !blueprint ||
            blueprint.locked ||
            !blueprint.selected
        ) {

            return;

        }

        const point =
            getFloorPoint(
                event.clientX,
                event.clientY
            );

        if (!point) {

            return;

        }

        const snapped =
            snapBlueprintPosition(

                point.x -
                    dragOffset.current.x,

                point.z -
                    dragOffset.current.z,

                state.gridSize,

                blueprint.snapEnabled

            );

        dispatch({

            type:
                "UPDATE_BLUEPRINT",

            payload: {

                x:
                    snapped.x,

                z:
                    snapped.z

            }

        });

    }

    //--------------------------------------------------
    // End dragging
    //--------------------------------------------------

    function handleWindowPointerUp() {

        dragging.current =
            false;

        window.removeEventListener(
            "pointermove",
            handleWindowPointerMove
        );

        window.removeEventListener(
            "pointerup",
            handleWindowPointerUp
        );

    }

    //--------------------------------------------------
    // Select + start dragging
    //--------------------------------------------------

    function handlePointerDown(
        event: any
    ) {

        if (
            !blueprint
        ) {

            return;

        }

        event.stopPropagation();

        //--------------------------------------------------
        // If somehow clicked while not selected,
        // activate it first.
        //--------------------------------------------------

        if (
            !blueprint.selected
        ) {

            dispatch({

                type:
                    "SET_BLUEPRINT_SELECTED",

                payload:
                    true

            });

            return;

        }

        //--------------------------------------------------
        // Locked = visible but cannot move
        //--------------------------------------------------

        if (
            blueprint.locked
        ) {

            return;

        }

        //--------------------------------------------------
        // Begin drag
        //--------------------------------------------------

        const point =
            event.point;

        dragOffset.current = {

            x:
                point.x -
                blueprint.x,

            z:
                point.z -
                blueprint.z

        };

        dragging.current =
            true;

        window.addEventListener(
            "pointermove",
            handleWindowPointerMove
        );

        window.addEventListener(
            "pointerup",
            handleWindowPointerUp
        );

    }

    //--------------------------------------------------
    // Cleanup
    //--------------------------------------------------

    useEffect(() => {

        return () => {

            window.removeEventListener(
                "pointermove",
                handleWindowPointerMove
            );

            window.removeEventListener(
                "pointerup",
                handleWindowPointerUp
            );

        };

    }, []);

    //--------------------------------------------------
    // R = rotate 90 degrees
    //--------------------------------------------------

    useEffect(() => {

        function handleKeyDown(
            event: KeyboardEvent
        ) {

            if (
                event.key.toLowerCase() !==
                "r"
            ) {

                return;

            }

            if (
                !blueprint ||
                !blueprint.selected ||
                blueprint.locked
            ) {

                return;

            }

            const target =
                event.target as HTMLElement | null;

            //--------------------------------------------------
            // Don't rotate while typing.
            //--------------------------------------------------

            if (
                target?.tagName === "INPUT" ||
                target?.tagName === "TEXTAREA"
            ) {

                return;

            }

            dispatch({

                type:
                    "UPDATE_BLUEPRINT",

                payload: {

                    rotationY:
                        blueprint.rotationY +
                        Math.PI / 2

                }

            });

        }

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {

            window.removeEventListener(
                "keydown",
                handleKeyDown
            );

        };

    }, [
        blueprint,
        dispatch
    ]);

    //--------------------------------------------------
    // IMPORTANT:
    //
    // Blueprint exists in state but has NOT been
    // activated yet.
    //
    // Therefore it should NOT appear in the scene.
    //--------------------------------------------------

    if (
        !blueprint ||
        !blueprint.selected ||
        !texture
    ) {

        return null;

    }

    //--------------------------------------------------
    // Opacity
    //--------------------------------------------------

    const opacity =
        Math.max(
            0,
            Math.min(
                1,
                blueprint.opacity
            )
        );

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <mesh

            position={[
                blueprint.x,

                // Slightly above the floor
                0.006,

                blueprint.z
            ]}

            //--------------------------------------------------
            // IMPORTANT:
            //
            // planeGeometry starts vertical on XY.
            //
            // Rotate -90° around X so it lies horizontally
            // on the XZ floor plane.
            //--------------------------------------------------

            rotation={[
                -Math.PI / 2,
                0,
                blueprint.rotationY
            ]}

            onPointerDown={
                handlePointerDown
            }

            //--------------------------------------------------
            // Locked blueprint should not intercept clicks.
            //--------------------------------------------------

            raycast={
                blueprint.locked
                    ? () => null
                    : undefined
            }

            renderOrder={
                -10
            }

        >

            <planeGeometry
                args={[
                    blueprint.width,
                    height
                ]}
            />

            <meshBasicMaterial

                map={
                    texture
                }

                transparent

                opacity={
                    opacity
                }

                depthWrite={
                    false
                }

                side={
                    DoubleSide
                }

            />

        </mesh>

    );
}