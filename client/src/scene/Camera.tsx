import {
    useEffect,
    useRef
} from "react";

import {
    OrbitControls
} from "@react-three/drei";

import {
    useFrame,
    useThree
} from "@react-three/fiber";

import {
    MathUtils,
    Matrix4,
    Quaternion,
    Vector3
} from "three";

import useEditor
    from "../context/editor/useEditor";

import {
    walkthroughSpawnState
} from "./Walkthrough/WalkthroughSpawnState";

import {
    ADMIN_COMMENT_MARKER_CLICK_EVENT,
    emitAdminCommentFocusComplete
} from "../services/adminCommentEvents";

import type {
    AdminComment
} from "../services/adminCommentService";

import {
    getAdminCommentTargetPoint
} from "./Comment/AdminCommentTargetUtils";

const MOVE_SPEED =
    0.15;

const MIN_DISTANCE =
    2;

const MAX_DISTANCE =
    100;

const WALKTHROUGH_POSITION_SPEED =
    8.5;

const WALKTHROUGH_ROTATION_SPEED =
    25;

const CAMERA_FINISH_DISTANCE =
    0.03;

const FOCUS_DISTANCE =
    3.5;

const MIN_POLAR_ANGLE =
    0;

const MAX_POLAR_ANGLE =
    Math.PI / 2 -
    MathUtils.degToRad(2);

interface CameraViewSnapshot {
    position:
        Vector3;
    quaternion:
        Quaternion;
    target:
        Vector3;
}

interface CameraTransition {
    active:
        boolean;
    startPosition:
        Vector3;
    endPosition:
        Vector3;
    startQuaternion:
        Quaternion;
    endQuaternion:
        Quaternion;
    startTarget:
        Vector3;
    endTarget:
        Vector3;
}

function isTypingTarget(
    target:
        EventTarget | null
): boolean {
    const element =
        target as
            HTMLElement |
            null;

    if (
        !element
    ) {
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

function clearMovementKeys(
    keys:
        React.MutableRefObject<{
            w:
                boolean;
            a:
                boolean;
            s:
                boolean;
            d:
                boolean;
        }>
) {
    keys.current.w =
        false;

    keys.current.a =
        false;

    keys.current.s =
        false;

    keys.current.d =
        false;
}

function createTopView(
    cameraPosition:
        Vector3,
    currentTarget:
        Vector3,
    up:
        Vector3
): CameraViewSnapshot {
    const distance =
        MathUtils.clamp(
            cameraPosition.distanceTo(
                currentTarget
            ),
            MIN_DISTANCE,
            MAX_DISTANCE
        );

    const topPosition =
        currentTarget
            .clone()
            .add(
                new Vector3(
                    0,
                    distance,
                    0
                )
            );

    const lookAtMatrix =
        new Matrix4().lookAt(
            topPosition,
            currentTarget,
            up
        );

    const topQuaternion =
        new Quaternion()
            .setFromRotationMatrix(
                lookAtMatrix
            );

    return {
        position:
            topPosition,
        quaternion:
            topQuaternion,
        target:
            currentTarget.clone()
    };
}

function getDesignCenter(
    corners:
        {
            position:
                Vector3;
        }[],
    fallback:
        Vector3
): Vector3 {
    if (
        corners.length ===
        0
    ) {
        return fallback.clone();
    }

    let minX =
        Infinity;

    let maxX =
        -Infinity;

    let minZ =
        Infinity;

    let maxZ =
        -Infinity;

    for (
        const corner of
        corners
    ) {
        const x =
            corner.position.x;

        const z =
            corner.position.z;

        if (
            x <
            minX
        ) {
            minX =
                x;
        }

        if (
            x >
            maxX
        ) {
            maxX =
                x;
        }

        if (
            z <
            minZ
        ) {
            minZ =
                z;
        }

        if (
            z >
            maxZ
        ) {
            maxZ =
                z;
        }
    }

    if (
        !Number.isFinite(
            minX
        ) ||
        !Number.isFinite(
            maxX
        ) ||
        !Number.isFinite(
            minZ
        ) ||
        !Number.isFinite(
            maxZ
        )
    ) {
        return fallback.clone();
    }

    return new Vector3(
        (
            minX +
            maxX
        ) /
            2,
        fallback.y,
        (
            minZ +
            maxZ
        ) /
            2
    );
}

export default function Camera({
    adminComments = []
}: {
    adminComments?:
        AdminComment[];
}) {
    const {
        camera
    } = useThree();

    const {
        state
    } = useEditor();

    const walkthroughMode =
        state.walkthroughMode;

    const controlsRef =
        useRef<any>(null);

    const previousWalkthroughMode =
        useRef(
            walkthroughMode
        );

    const keys =
        useRef({
            w:
                false,
            a:
                false,
            s:
                false,
            d:
                false
        });

    const savedEditorView =
        useRef<
            CameraViewSnapshot |
            null
        >(null);

    const transition =
        useRef<CameraTransition>({
            active:
                false,
            startPosition:
                new Vector3(),
            endPosition:
                new Vector3(),
            startQuaternion:
                new Quaternion(),
            endQuaternion:
                new Quaternion(),
            startTarget:
                new Vector3(),
            endTarget:
                new Vector3()
        });

    const focusActive =
        useRef(
            false
        );

    const focusCommentId =
        useRef<
            string |
            null
        >(null);

    const focusTarget =
        useRef(
            new Vector3()
        );

    const focusCameraPosition =
        useRef(
            new Vector3()
        );

    useEffect(() => {
        const handleKeyDown =
            (
                event:
                    KeyboardEvent
            ) => {
                if (
                    isTypingTarget(
                        event.target
                    )
                ) {
                    return;
                }

                switch (
                    event.key.toLowerCase()
                ) {
                    case "w":
                        keys.current.w =
                            true;
                        break;

                    case "a":
                        keys.current.a =
                            true;
                        break;

                    case "s":
                        keys.current.s =
                            true;
                        break;

                    case "d":
                        keys.current.d =
                            true;
                        break;
                }
            };

        const handleKeyUp =
            (
                event:
                    KeyboardEvent
            ) => {
                switch (
                    event.key.toLowerCase()
                ) {
                    case "w":
                        keys.current.w =
                            false;
                        break;

                    case "a":
                        keys.current.a =
                            false;
                        break;

                    case "s":
                        keys.current.s =
                            false;
                        break;

                    case "d":
                        keys.current.d =
                            false;
                        break;
                }
            };

        const handleWindowBlur =
            () => {
                clearMovementKeys(
                    keys
                );
            };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        window.addEventListener(
            "keyup",
            handleKeyUp
        );

        window.addEventListener(
            "blur",
            handleWindowBlur
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );

            window.removeEventListener(
                "keyup",
                handleKeyUp
            );

            window.removeEventListener(
                "blur",
                handleWindowBlur
            );
        };
    }, []);

    useEffect(() => {
        const handleCommentFocus =
            (
                event:
                    Event
            ) => {
                if (
                    walkthroughMode
                ) {
                    return;
                }

                const customEvent =
                    event as CustomEvent<string>;

                const comment =
                    adminComments.find(
                        item =>
                            item.id ===
                            customEvent.detail
                    );

                if (
                    !comment
                ) {
                    return;
                }

                const target =
                    getAdminCommentTargetPoint(
                        state,
                        comment
                    );

                if (
                    !target
                ) {
                    return;
                }

                const direction =
                    new Vector3()
                        .subVectors(
                            camera.position,
                            target
                        );

                if (
                    direction.lengthSq() <
                    0.000001
                ) {
                    direction.set(
                        0,
                        0,
                        1
                    );
                }

                direction.normalize();

                focusTarget.current.copy(
                    target
                );

                focusCameraPosition.current
                    .copy(
                        target
                    )
                    .add(
                        direction.multiplyScalar(
                            FOCUS_DISTANCE
                        )
                    );

                focusCommentId.current =
                    comment.id;

                focusActive.current =
                    true;

                if (
                    controlsRef.current
                ) {
                    controlsRef.current.enabled =
                        false;
                }
            };

        window.addEventListener(
            ADMIN_COMMENT_MARKER_CLICK_EVENT,
            handleCommentFocus
        );

        return () => {
            window.removeEventListener(
                ADMIN_COMMENT_MARKER_CLICK_EVENT,
                handleCommentFocus
            );
        };
    }, [
        adminComments,
        camera,
        state,
        walkthroughMode
    ]);

    useEffect(() => {
        if (
            walkthroughMode
        ) {
            return;
        }

        let animationFrame =
            0;

        const moveCamera =
            () => {
                if (
                    focusActive.current ||
                    transition.current.active
                ) {
                    animationFrame =
                        requestAnimationFrame(
                            moveCamera
                        );

                    return;
                }

                const forward =
                    new Vector3();

                camera.getWorldDirection(
                    forward
                );

                forward.y =
                    0;

                if (
                    forward.lengthSq() >
                    0
                ) {
                    forward.normalize();
                }

                const right =
                    new Vector3(
                        -forward.z,
                        0,
                        forward.x
                    );

                const movement =
                    new Vector3();

                if (
                    keys.current.w
                ) {
                    movement.add(
                        forward
                    );
                }

                if (
                    keys.current.s
                ) {
                    movement.sub(
                        forward
                    );
                }

                if (
                    keys.current.d
                ) {
                    movement.add(
                        right
                    );
                }

                if (
                    keys.current.a
                ) {
                    movement.sub(
                        right
                    );
                }

                if (
                    movement.lengthSq() >
                    0
                ) {
                    movement
                        .normalize()
                        .multiplyScalar(
                            MOVE_SPEED
                        );

                    camera.position.add(
                        movement
                    );

                    if (
                        controlsRef.current
                    ) {
                        controlsRef.current.target.add(
                            movement
                        );

                        controlsRef.current.update();
                    }
                }

                animationFrame =
                    requestAnimationFrame(
                        moveCamera
                    );
            };

        animationFrame =
            requestAnimationFrame(
                moveCamera
            );

        return () => {
            cancelAnimationFrame(
                animationFrame
            );
        };
    }, [
        camera,
        walkthroughMode
    ]);

    useEffect(() => {
        const wasInWalkthrough =
            previousWalkthroughMode.current;

        const isNowInWalkthrough =
            walkthroughMode;

        if (
            !wasInWalkthrough &&
            isNowInWalkthrough
        ) {
            const currentTarget =
                controlsRef.current
                    ? controlsRef.current.target.clone()
                    : new Vector3();

            savedEditorView.current = {
                position:
                    camera.position.clone(),
                quaternion:
                    camera.quaternion.clone(),
                target:
                    currentTarget.clone()
            };

            const designCenter =
                getDesignCenter(
                    state.corners,
                    currentTarget
                );

            const topView =
                createTopView(
                    camera.position,
                    designCenter,
                    camera.up
                );

            walkthroughSpawnState.offset.set(
                0,
                0,
                0
            );

            walkthroughSpawnState.topViewY =
                topView.position.y;

            walkthroughSpawnState.confirmed =
                false;

            walkthroughSpawnState.transitionActive =
                true;

            focusActive.current =
                false;

            focusCommentId.current =
                null;

            if (
                controlsRef.current
            ) {
                controlsRef.current.enabled =
                    false;
            }

            transition.current = {
                active:
                    true,
                startPosition:
                    camera.position.clone(),
                endPosition:
                    topView.position.clone(),
                startQuaternion:
                    camera.quaternion.clone(),
                endQuaternion:
                    topView.quaternion.clone(),
                startTarget:
                    currentTarget.clone(),
                endTarget:
                    topView.target.clone()
            };
        }

        if (
            wasInWalkthrough &&
            !isNowInWalkthrough
        ) {
            clearMovementKeys(
                keys
            );

            walkthroughSpawnState.offset.set(
                0,
                0,
                0
            );

            walkthroughSpawnState.confirmed =
                false;

            walkthroughSpawnState.transitionActive =
                false;

            const savedView =
                savedEditorView.current;

            if (
                savedView
            ) {
                const currentTarget =
                    controlsRef.current
                        ? controlsRef.current.target.clone()
                        : new Vector3();

                if (
                    controlsRef.current
                ) {
                    controlsRef.current.enabled =
                        false;
                }

                transition.current = {
                    active:
                        true,
                    startPosition:
                        camera.position.clone(),
                    endPosition:
                        savedView.position.clone(),
                    startQuaternion:
                        camera.quaternion.clone(),
                    endQuaternion:
                        savedView.quaternion.clone(),
                    startTarget:
                        currentTarget,
                    endTarget:
                        savedView.target.clone()
                };
            }
        }

        previousWalkthroughMode.current =
            walkthroughMode;
    }, [
        walkthroughMode,
        camera,
        state.corners
    ]);

    useFrame(
        (
            _,
            delta
        ) => {
            if (
                focusActive.current
            ) {
                const alpha =
                    1 -
                    Math.exp(
                        -4.5 *
                        delta
                    );

                camera.position.lerp(
                    focusCameraPosition.current,
                    alpha
                );

                if (
                    controlsRef.current
                ) {
                    controlsRef.current.target.lerp(
                        focusTarget.current,
                        alpha
                    );

                    controlsRef.current.update();
                }

                const finished =
                    camera.position.distanceToSquared(
                        focusCameraPosition.current
                    ) <=
                    CAMERA_FINISH_DISTANCE *
                    CAMERA_FINISH_DISTANCE;

                if (
                    finished
                ) {
                    camera.position.copy(
                        focusCameraPosition.current
                    );

                    if (
                        controlsRef.current
                    ) {
                        controlsRef.current.target.copy(
                            focusTarget.current
                        );

                        controlsRef.current.update();

                        controlsRef.current.enabled =
                            true;
                    }

                    const commentId =
                        focusCommentId.current;

                    focusActive.current =
                        false;

                    focusCommentId.current =
                        null;

                    if (
                        commentId
                    ) {
                        emitAdminCommentFocusComplete(
                            commentId
                        );
                    }
                }

                return;
            }

            if (
                !transition.current.active
            ) {
                return;
            }

            const current =
                transition.current;

            if (
                walkthroughMode &&
                walkthroughSpawnState.confirmed
            ) {
                current.active =
                    false;

                walkthroughSpawnState.transitionActive =
                    false;

                walkthroughSpawnState.offset.set(
                    0,
                    0,
                    0
                );

                return;
            }

            const positionAlpha =
                1 -
                Math.exp(
                    -WALKTHROUGH_POSITION_SPEED *
                    delta
                );

            const rotationAlpha =
                1 -
                Math.exp(
                    -WALKTHROUGH_ROTATION_SPEED *
                    delta
                );

            const targetPosition =
                current.endPosition.clone();

            if (
                walkthroughMode
            ) {
                targetPosition.add(
                    walkthroughSpawnState.offset
                );
            }

            camera.position.lerp(
                targetPosition,
                positionAlpha
            );

            camera.quaternion.slerp(
                current.endQuaternion,
                rotationAlpha
            );

            if (
                controlsRef.current
            ) {
                controlsRef.current.target.lerp(
                    current.endTarget,
                    positionAlpha
                );
            }

            const positionFinished =
                camera.position.distanceToSquared(
                    targetPosition
                ) <=
                CAMERA_FINISH_DISTANCE *
                CAMERA_FINISH_DISTANCE;

            const rotationFinished =
                1 -
                Math.abs(
                    camera.quaternion.dot(
                        current.endQuaternion
                    )
                ) <=
                0.0005;

            const targetFinished =
                !controlsRef.current ||
                controlsRef.current.target
                    .distanceToSquared(
                        current.endTarget
                    ) <=
                CAMERA_FINISH_DISTANCE *
                CAMERA_FINISH_DISTANCE;

            if (
                positionFinished &&
                rotationFinished &&
                targetFinished
            ) {
                camera.position.copy(
                    targetPosition
                );

                camera.quaternion.copy(
                    current.endQuaternion
                );

                if (
                    controlsRef.current
                ) {
                    controlsRef.current.target.copy(
                        current.endTarget
                    );

                    controlsRef.current.update();

                    controlsRef.current.enabled =
                        !walkthroughMode;
                }

                current.active =
                    false;

                if (
                    walkthroughMode
                ) {
                    walkthroughSpawnState.transitionActive =
                        false;

                    walkthroughSpawnState.offset.set(
                        0,
                        0,
                        0
                    );
                }
            }
        }
    );

    useEffect(() => {
        clearMovementKeys(
            keys
        );
    }, [
        walkthroughMode
    ]);

    return (
        <OrbitControls
            ref={
                controlsRef
            }
            makeDefault
            enablePan={
                !walkthroughMode
            }
            enableZoom={
                !walkthroughMode
            }
            enableRotate={
                !walkthroughMode
            }
            enabled={
                !walkthroughMode &&
                !transition.current.active &&
                !focusActive.current
            }
            screenSpacePanning={
                false
            }
            minDistance={
                MIN_DISTANCE
            }
            maxDistance={
                MAX_DISTANCE
            }
            minPolarAngle={
                MIN_POLAR_ANGLE
            }
            maxPolarAngle={
                MAX_POLAR_ANGLE
            }
        />
    );
}