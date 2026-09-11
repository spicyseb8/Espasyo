import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    useThree
} from "@react-three/fiber";

import {
    Line
} from "@react-three/drei";

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
    //--------------------------------------------------

    const calibrationActive =
        useRef(false);

    const calibrationStart =
        useRef<Vector3 | null>(null);

    //--------------------------------------------------
    // Calibration visual line
    //--------------------------------------------------

    const [
        calibrationLineStart,
        setCalibrationLineStart
    ] = useState<Vector3 | null>(null);

    const [
        calibrationLineEnd,
        setCalibrationLineEnd
    ] = useState<Vector3 | null>(null);

    //--------------------------------------------------
    // Calibration line reference
    //
    // We use this to force the line material to always
    // render above the blueprint.
    //--------------------------------------------------

    const calibrationLineRef =
        useRef<any>(null);

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
    // Convert screen coordinate to floor coordinate
    //--------------------------------------------------

    const getFloorPoint =
        useCallback(
            (
                clientX: number,
                clientY: number
            ): Vector3 | null => {

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
            },
            [
                camera,
                gl,
                groundPlane,
                raycaster
            ]
        );

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
            // Clear previous calibration line
            //--------------------------------------------------

            setCalibrationLineStart(
                null
            );

            setCalibrationLineEnd(
                null
            );

            //--------------------------------------------------
            // Make sure the blueprint is visible
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

            //--------------------------------------------------
            // Remove temporary line
            //--------------------------------------------------

            setCalibrationLineStart(
                null
            );

            setCalibrationLineEnd(
                null
            );
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
    // Calibration mouse movement
    //
    // After the first point is selected, the line end
    // follows the mouse.
    //--------------------------------------------------

    useEffect(() => {

        function handleCalibrationPointerMove(
            event: PointerEvent
        ) {

            if (
                !calibrationActive.current
            ) {
                return;
            }

            if (
                !calibrationStart.current
            ) {
                return;
            }

            const rect =
                gl.domElement.getBoundingClientRect();

            //--------------------------------------------------
            // Only update while cursor is inside canvas.
            //--------------------------------------------------

            if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
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

            //--------------------------------------------------
            // Keep the guide slightly above the blueprint.
            //--------------------------------------------------

            const linePoint =
                new Vector3(
                    point.x,
                    0.02,
                    point.z
                );

            setCalibrationLineEnd(
                linePoint
            );
        }

        window.addEventListener(
            "pointermove",
            handleCalibrationPointerMove
        );

        return () => {

            window.removeEventListener(
                "pointermove",
                handleCalibrationPointerMove
            );
        };

    }, [
        getFloorPoint,
        gl
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

            //--------------------------------------------------
            // FIRST POINT
            //--------------------------------------------------

            if (
                !calibrationStart.current
            ) {

                calibrationStart.current =
                    point;

                //--------------------------------------------------
                // Guide start
                //--------------------------------------------------

                const linePoint =
                    new Vector3(
                        point.x,
                        0.02,
                        point.z
                    );

                setCalibrationLineStart(
                    linePoint
                );

                //--------------------------------------------------
                // Start and end initially coincide.
                //--------------------------------------------------

                setCalibrationLineEnd(
                    linePoint.clone()
                );

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

            //--------------------------------------------------
            // SECOND POINT
            //--------------------------------------------------

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

            //--------------------------------------------------
            // Calibration finished
            //--------------------------------------------------

            calibrationActive.current =
                false;

            calibrationStart.current =
                null;

            //--------------------------------------------------
            // Remove temporary line
            //--------------------------------------------------

            setCalibrationLineStart(
                null
            );

            setCalibrationLineEnd(
                null
            );

            //--------------------------------------------------
            // Send result
            //--------------------------------------------------

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
        // Select blueprint
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
        // Locked
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

            setCalibrationLineStart(
                null
            );

            setCalibrationLineEnd(
                null
            );

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
    // Force calibration line rendering
    //
    // This is the important fix.
    //
    // The line must not test or write depth because
    // the blueprint image is intentionally transparent
    // and lies directly on the floor.
    //--------------------------------------------------

    useEffect(() => {

        const line =
            calibrationLineRef.current;

        if (!line) {
            return;
        }

        line.renderOrder =
            100000;

        const material =
            line.material;

        if (!material) {
            return;
        }

        material.depthTest =
            false;

        material.depthWrite =
            false;

        material.toneMapped =
            false;

    }, [
        calibrationLineStart,
        calibrationLineEnd
    ]);

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
    // Render
    //--------------------------------------------------

    return (
        <>
            {/* ==================================================
                BLUEPRINT
               ================================================== */}

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

            {/* ==================================================
                CALIBRATION GUIDE
               ================================================== */}

            {
                calibrationActive.current &&
                calibrationLineStart &&
                calibrationLineEnd && (
                    <Line
                        ref={
                            calibrationLineRef
                        }

                        points={[
                            calibrationLineStart,
                            calibrationLineEnd
                        ]}

                        color="#00E5FF"

                        lineWidth={
                            4
                        }

                        dashed

                        dashSize={
                            0.12
                        }

                        gapSize={
                            0.07
                        }

                        depthTest={
                            false
                        }

                        depthWrite={
                            false
                        }

                        toneMapped={
                            false
                        }

                        renderOrder={
                            100000
                        }

                        frustumCulled={
                            false
                        }

                        raycast={() => null}
                    />
                )
            }

            {/* ==================================================
                FIRST POINT OUTER CIRCLE

                Black outline makes the marker visible
                against both white and black blueprint lines.
               ================================================== */}

            {
                calibrationActive.current &&
                calibrationLineStart && (
                    <mesh
                        position={
                            calibrationLineStart
                        }

                        rotation={[
                            -Math.PI / 2,
                            0,
                            0
                        ]}

                        renderOrder={
                            100001
                        }

                        raycast={() => null}
                    >

                        <circleGeometry
                            args={[
                                0.11,
                                32
                            ]}
                        />

                        <meshBasicMaterial
                            color={
                                "#000000"
                            }

                            depthTest={
                                false
                            }

                            depthWrite={
                                false
                            }

                            toneMapped={
                                false
                            }

                            side={
                                DoubleSide
                            }
                        />

                    </mesh>
                )
            }

            {/* ==================================================
                FIRST POINT INNER CIRCLE
               ================================================== */}

            {
                calibrationActive.current &&
                calibrationLineStart && (
                    <mesh
                        position={[
                            calibrationLineStart.x,
                            calibrationLineStart.y +
                                0.002,
                            calibrationLineStart.z
                        ]}

                        rotation={[
                            -Math.PI / 2,
                            0,
                            0
                        ]}

                        renderOrder={
                            100002
                        }

                        raycast={() => null}
                    >

                        <circleGeometry
                            args={[
                                0.065,
                                32
                            ]}
                        />

                        <meshBasicMaterial
                            color={
                                "#00E5FF"
                            }

                            depthTest={
                                false
                            }

                            depthWrite={
                                false
                            }

                            toneMapped={
                                false
                            }

                            side={
                                DoubleSide
                            }
                        />

                    </mesh>
                )
            }
        </>
    );
}