import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
    ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
    ADMIN_COMMENT_FOCUS_EVENT,
    type AdminCommentFocusDetail
} from "@/services/assets/adminCommentEvents";

const MIN_DISTANCE = 2;
const MAX_DISTANCE = 100;
const MIN_POLAR_ANGLE = 0;
const MAX_POLAR_ANGLE =
    Math.PI / 2 -
    MathUtils.degToRad(2);
const MOVE_SPEED = 4;
const FAST_MOVE_MULTIPLIER = 2;
const FOCUS_DISTANCE = 3.5;
const FOCUS_SPEED = 7;

export default function AdminCamera() {
    const controlsRef =
        useRef<OrbitControlsImpl | null>(null);

    const keys =
        useRef(new Set<string>());

    const forward =
        useRef(new Vector3());

    const right =
        useRef(new Vector3());

    const movement =
        useRef(new Vector3());

    const up =
        useRef(new Vector3(0, 1, 0));

    const focusTarget =
        useRef<Vector3 | null>(null);

    const focusPosition =
        useRef<Vector3 | null>(null);

    const activeFocusCommentId =
        useRef<string | null>(null);

    useEffect(() => {
        function isTypingTarget(
            target: EventTarget | null
        ) {
            const element =
                target as HTMLElement | null;

            if (!element) {
                return false;
            }

            return (
                element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement ||
                element.isContentEditable
            );
        }

        function handleKeyDown(
            event: KeyboardEvent
        ) {
            if (
                isTypingTarget(
                    event.target
                )
            ) {
                keys.current.clear();
                return;
            }

            const key =
                event.key.toLowerCase();

            if (
                [
                    "w",
                    "a",
                    "s",
                    "d",
                    "shift"
                ].includes(key)
            ) {
                event.preventDefault();
                keys.current.add(key);
            }
        }

        function handleKeyUp(
            event: KeyboardEvent
        ) {
            if (
                isTypingTarget(
                    event.target
                )
            ) {
                keys.current.clear();
                return;
            }

            keys.current.delete(
                event.key.toLowerCase()
            );
        }

        function handleBlur() {
            keys.current.clear();
        }

        function handleFocus(
            event: Event
        ) {
            const customEvent =
                event as CustomEvent<AdminCommentFocusDetail>;

            const point =
                customEvent.detail?.position;

            const commentId =
                customEvent.detail?.commentId;

            const controls =
                controlsRef.current;

            if (
                !point ||
                !commentId ||
                !controls
            ) {
                return;
            }

            const camera =
                controls.object;

            const target =
                new Vector3(
                    point.x,
                    point.y,
                    point.z
                );

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
                    1,
                    1
                );
            }

            direction.normalize();

            focusTarget.current =
                target;

            focusPosition.current =
                target.clone().add(
                    direction.multiplyScalar(
                        FOCUS_DISTANCE
                    )
                );

            activeFocusCommentId.current =
                commentId;

            controls.enabled =
                false;
        }

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
            handleBlur
        );

        window.addEventListener(
            ADMIN_COMMENT_FOCUS_EVENT,
            handleFocus
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
                handleBlur
            );

            window.removeEventListener(
                ADMIN_COMMENT_FOCUS_EVENT,
                handleFocus
            );
        };
    }, []);

    useFrame(
        (
            {
                camera
            },
            delta
        ) => {
            const controls =
                controlsRef.current;

            if (!controls) {
                return;
            }

            if (
                focusTarget.current &&
                focusPosition.current
            ) {
                const target =
                    focusTarget.current;

                const position =
                    focusPosition.current;

                const alpha =
                    1 -
                    Math.exp(
                        -FOCUS_SPEED *
                        delta
                    );

                camera.position.lerp(
                    position,
                    alpha
                );

                controls.target.lerp(
                    target,
                    alpha
                );

                controls.update();

                const cameraFinished =
                    camera.position.distanceToSquared(
                        position
                    ) <
                    0.0025;

                const targetFinished =
                    controls.target.distanceToSquared(
                        target
                    ) <
                    0.0025;

                if (
                    cameraFinished &&
                    targetFinished
                ) {
                    camera.position.copy(
                        position
                    );

                    controls.target.copy(
                        target
                    );

                    controls.update();

                    focusTarget.current =
                        null;

                    focusPosition.current =
                        null;

                    controls.enabled =
                        true;

                    const commentId =
                        activeFocusCommentId.current;

                    activeFocusCommentId.current =
                        null;

                    if (commentId) {
                        window.dispatchEvent(
                            new CustomEvent<string>(
                                ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
                                {
                                    detail:
                                        commentId
                                }
                            )
                        );
                    }
                }

                return;
            }

            const w =
                keys.current.has("w");

            const s =
                keys.current.has("s");

            const a =
                keys.current.has("a");

            const d =
                keys.current.has("d");

            if (
                !w &&
                !s &&
                !a &&
                !d
            ) {
                return;
            }

            camera.getWorldDirection(
                forward.current
            );

            forward.current.y =
                0;

            if (
                forward.current.lengthSq() <
                0.000001
            ) {
                return;
            }

            forward.current.normalize();

            right.current.crossVectors(
                forward.current,
                up.current
            );

            right.current.normalize();

            movement.current.set(
                0,
                0,
                0
            );

            if (w) {
                movement.current.add(
                    forward.current
                );
            }

            if (s) {
                movement.current.sub(
                    forward.current
                );
            }

            if (d) {
                movement.current.add(
                    right.current
                );
            }

            if (a) {
                movement.current.sub(
                    right.current
                );
            }

            if (
                movement.current.lengthSq() >
                0.000001
            ) {
                movement.current.normalize();
            }

            const speed =
                MOVE_SPEED *
                (
                    keys.current.has(
                        "shift"
                    )
                        ? FAST_MOVE_MULTIPLIER
                        : 1
                );

            movement.current.multiplyScalar(
                speed *
                delta
            );

            camera.position.add(
                movement.current
            );

            controls.target.add(
                movement.current
            );

            controls.update();
        }
    );

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enablePan
            enableZoom
            enableRotate
            screenSpacePanning={false}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            minPolarAngle={MIN_POLAR_ANGLE}
            maxPolarAngle={MAX_POLAR_ANGLE}
        />
    );
}