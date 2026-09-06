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

const START_CALIBRATION_EVENT =
    "espasyo-start-blueprint-calibration";

const CANCEL_CALIBRATION_EVENT =
    "espasyo-cancel-blueprint-calibration";

const CALIBRATION_POINT_EVENT =
    "espasyo-blueprint-calibration-point";

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
    // Calibration
    //
    // Calibration UI stays completely inside
    // FloorPlanPanel. Nothing is drawn in the scene.
    //--------------------------------------------------

    const calibrationActive =
        useRef(false);

    const calibrationStart =
        useRef<Vector3 | null>(null);

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
    // Start / cancel calibration events
    //--------------------------------------------------

    useEffect(() => {

        function handleStartCalibration() {

            if (!blueprint) {
                return;
            }

            if (blueprint.locked) {
                return;
            }

            calibrationActive.current =
                true;

            calibrationStart.current =
                null;

            //--------------------------------------------------
            // Make sure the blueprint is visible.
            //--------------------------------------------------

            if (!blueprint.selected) {

                dispatch({
                    type:
                        "SHOW_BLUEPRINT"
                });
            }

            window.dispatchEvent(
                new CustomEvent(
                    CALIBRATION_POINT_EVENT,
                    {
                        detail: {
                            type:
                                "started"
                        }
                    }
                )
            );
        }

        function handleCancelCalibration() {

            calibrationActive.current =
                false;

            calibrationStart.current =
                null;
        }

        window.addEventListener(
            START_CALIBRATION_EVENT,
            handleStartCalibration
        );

        window.addEventListener(
            CANCEL_CALIBRATION_EVENT,
            handleCancelCalibration
        );

        return () => {

            window.removeEventListener(
                START_CALIBRATION_EVENT,
                handleStartCalibration
            );

            window.removeEventListener(
                CANCEL_CALIBRATION_EVENT,
                handleCancelCalibration
            );
        };

    }, [
        blueprint,
        dispatch
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
    // Select / drag / calibrate
    //--------------------------------------------------

    function handlePointerDown(
        event: any
    ) {

        if (!blueprint) {
            return;
        }

        event.stopPropagation();

        //--------------------------------------------------
        // Calibration mode
        //
        // Only the clicked 3D point is sent back to the
        // FloorPlanPanel. No ruler, HTML, label, or form
        // is rendered in the scene.
        //--------------------------------------------------

        if (
            calibrationActive.current
        ) {

            if (blueprint.locked) {
                return;
            }

            const point =
                event.point instanceof Vector3
                    ? event.point.clone()
                    : new Vector3(
                        event.point.x,
                        0,
                        event.point.z
                    );

            if (
                !calibrationStart.current
            ) {

                calibrationStart.current =
                    point;

                window.dispatchEvent(
                    new CustomEvent(
                        CALIBRATION_POINT_EVENT,
                        {
                            detail: {
                                type:
                                    "first-point"
                            }
                        }
                    )
                );

                return;
            }

            const start =
                calibrationStart.current;

            const end =
                point;

            const dx =
                end.x -
                start.x;

            const dz =
                end.z -
                start.z;

            const measuredLength =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );

            calibrationActive.current =
                false;

            calibrationStart.current =
                null;

            window.dispatchEvent(
                new CustomEvent(
                    CALIBRATION_POINT_EVENT,
                    {
                        detail: {
                            type:
                                "second-point",
                            measuredLength
                        }
                    }
                )
            );

            return;
        }

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

            dragging.current =
                false;

            calibrationActive.current =
                false;

            calibrationStart.current =
                null;

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

        function isTypingTarget(
            target: EventTarget | null
        ) {

            const element =
                target as HTMLElement | null;

            if (!element) {
                return false;
            }

            const tagName =
                element.tagName?.toLowerCase();

            return (
                tagName === "input" ||
                tagName === "textarea" ||
                tagName === "select" ||
                element.isContentEditable
            );
        }

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
                isTypingTarget(
                    event.target
                )
            ) {
                return;
            }

            if (
                calibrationActive.current
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
    // Blueprint only appears when selected.
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
    // Render blueprint
    //--------------------------------------------------

    return (
        <mesh
            position={[
                blueprint.x,
                0.006,
                blueprint.z
            ]}

            rotation={[
                -Math.PI / 2,
                0,
                blueprint.rotationY
            ]}

            onPointerDown={
                handlePointerDown
            }

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
