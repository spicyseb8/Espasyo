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


//==================================================
// CAMERA SETTINGS
//==================================================

const MOVE_SPEED =
    0.15;

const MIN_DISTANCE =
    2;

const MAX_DISTANCE =
    100;


//==================================================
// TRANSITION SPEEDS
//==================================================
//
// Position moves slowly so the "rise to top-down" feels
// deliberate and calm.
//
// Rotation finishes almost instantly so the camera does
// not visibly spin for a whole second while the user is
// also pressing WASD.
//==================================================

const WALKTHROUGH_POSITION_SPEED =
    3.5;

const WALKTHROUGH_ROTATION_SPEED =
    22;

const CAMERA_FINISH_DISTANCE =
    0.03;


//==================================================
// ORBIT CAMERA LIMITS
//==================================================

const MIN_POLAR_ANGLE =
    0;

const MAX_POLAR_ANGLE =
    Math.PI / 2 -
    MathUtils.degToRad(2);


//==================================================
// CAMERA VIEW SNAPSHOT
//==================================================

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


//==================================================
// CHECK IF USER IS TYPING
//==================================================

function isTypingTarget(
    target:
        EventTarget | null
): boolean {

    const element =
        target as HTMLElement | null;


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


//==================================================
// CLEAR MOVEMENT KEYS
//==================================================

function clearMovementKeys(
    keys:
        React.MutableRefObject<{
            w: boolean;
            a: boolean;
            s: boolean;
            d: boolean;
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


//==================================================
// CREATE DYNAMIC TOP VIEW
//==================================================

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


//==================================================
// CAMERA
//==================================================

export default function Camera() {

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


    //==================================================
    // NORMAL EDITOR WASD
    //==================================================

    const keys =
        useRef({

            w: false,

            a: false,

            s: false,

            d: false

        });


    //==================================================
    // SAVED EDITOR VIEW
    //==================================================

    const savedEditorView =
        useRef<CameraViewSnapshot | null>(
            null
        );


    //==================================================
    // CAMERA TRANSITION
    //==================================================

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


    //==================================================
    // KEYBOARD
    //==================================================

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


    //==================================================
    // NORMAL EDITOR WASD MOVEMENT
    //==================================================

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
                    forward.lengthSq() > 0
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


                if (keys.current.w) movement.add(forward);
                if (keys.current.s) movement.sub(forward);
                if (keys.current.d) movement.add(right);
                if (keys.current.a) movement.sub(right);


                if (
                    movement.lengthSq() > 0
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


    //==================================================
    // WALKTHROUGH MODE CHANGE
    //==================================================

    useEffect(() => {

        const wasInWalkthrough =
            previousWalkthroughMode.current;


        const isNowInWalkthrough =
            walkthroughMode;


        //----------------------------------------------
        // NORMAL → WALKTHROUGH
        //----------------------------------------------

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


            const topView =
                createTopView(

                    camera.position,

                    currentTarget,

                    camera.up

                );


            //--------------------------------------------------
            // Reset shared spawn-selection state.
            //--------------------------------------------------

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


        //----------------------------------------------
        // WALKTHROUGH → NORMAL
        //----------------------------------------------

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

        camera

    ]);


    //==================================================
    // SMOOTH CAMERA TRANSITION
    //==================================================
    //
    // IMPORTANT — WHY THERE IS NO update() CALL HERE:
    //
    // OrbitControls.update() ends with:
    //
    //     camera.lookAt(controls.target)
    //
    // That line OVERWRITES whatever quaternion we just
    // slerped. During the top-down transition, if the
    // camera is off-axis relative to the target (which
    // happens the moment WASD or scroll feeds the shared
    // offset), lookAt() wants one orientation and our
    // slerp wants another. Each frame they overwrite
    // each other → the camera quaternion oscillates →
    // the floor and walls appear to vibrate.
    //
    // So: we lerp camera.position, slerp camera.quaternion,
    // and lerp controls.target — but we DO NOT call
    // controls.update(). We call it once at the finish,
    // when the camera is aligned with the target and both
    // orientations agree.
    //==================================================

    useFrame(
        (
            _,
            delta
        ) => {

            if (
                !transition.current.active
            ) {

                return;

            }


            const current =
                transition.current;


            //--------------------------------------------------
            // If spawn was confirmed mid-transition, cancel.
            //--------------------------------------------------

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


            //--------------------------------------------------
            // Damping (separate rates for position & rotation).
            //--------------------------------------------------

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


            //--------------------------------------------------
            // Effective target position
            //   = top-down end position + user offset
            //     (WASD + scroll added to offset while
            //      transitionActive is true).
            //--------------------------------------------------

            const targetPosition =
                current.endPosition.clone();


            if (
                walkthroughMode
            ) {

                targetPosition.add(
                    walkthroughSpawnState.offset
                );

            }


            //--------------------------------------------------
            // Position
            //--------------------------------------------------

            camera.position.lerp(
                targetPosition,
                positionAlpha
            );


            //--------------------------------------------------
            // Rotation
            //--------------------------------------------------

            camera.quaternion.slerp(
                current.endQuaternion,
                rotationAlpha
            );


            //--------------------------------------------------
            // Target (OrbitControls internal target)
            //
            //   Lerped so it arrives smoothly with the camera.
            //
            //   DO NOT call controlsRef.current.update() here.
            //   See the big comment above the useFrame.
            //--------------------------------------------------

            if (
                controlsRef.current
            ) {

                controlsRef.current.target.lerp(
                    current.endTarget,
                    positionAlpha
                );

            }


            //--------------------------------------------------
            // Completion checks.
            //--------------------------------------------------

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


            //--------------------------------------------------
            // Finish
            //--------------------------------------------------

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


                    //--------------------------------------------------
                    // Single update() — at the moment the camera
                    // is aligned with the target. lookAt() here
                    // produces the same orientation we just set,
                    // so nothing snaps.
                    //--------------------------------------------------

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


    //==================================================
    // RESET NORMAL EDITOR KEYS
    //==================================================

    useEffect(() => {

        clearMovementKeys(
            keys
        );

    }, [

        walkthroughMode

    ]);


    //==================================================
    // ORBIT CONTROLS
    //==================================================

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
                !transition.current.active
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