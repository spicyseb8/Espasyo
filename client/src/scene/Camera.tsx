import {
    useEffect,
    useRef
} from "react";

import {
    OrbitControls
} from "@react-three/drei";

import {
    useThree
} from "@react-three/fiber";

import {
    Vector3
} from "three";

import useEditor
    from "../context/editor/useEditor";


//==================================================
// CAMERA SETTINGS
//==================================================

const MOVE_SPEED = 0.15;

const MIN_DISTANCE = 2;

const MAX_DISTANCE = 100;


//==================================================
// LANDING CAMERA
//==================================================

const LANDING_POSITION =
    new Vector3(
        0,
        20,
        0
    );

const LANDING_TARGET =
    new Vector3(
        0,
        0,
        0
    );


//==================================================
// CHECK IF USER IS TYPING
//==================================================

function isTypingTarget(
    target: EventTarget | null
): boolean {

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


//==================================================
// CLEAR MOVEMENT KEYS
//==================================================

function clearMovementKeys(
    keys: React.MutableRefObject<{
        w: boolean;
        a: boolean;
        s: boolean;
        d: boolean;
    }>
) {

    keys.current.w = false;

    keys.current.a = false;

    keys.current.s = false;

    keys.current.d = false;

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


    const keys =
        useRef({

            w: false,

            a: false,

            s: false,

            d: false

        });


    //==================================================
    // KEYBOARD
    //==================================================

    useEffect(() => {

        const handleKeyDown =
            (
                event: KeyboardEvent
            ) => {

                //--------------------------------------------------
                // Ignore keyboard shortcuts while typing.
                //--------------------------------------------------

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
                event: KeyboardEvent
            ) => {

                //--------------------------------------------------
                // Always clear the key.
                //
                // This prevents a key from becoming stuck when
                // focus changes to a textbox.
                //--------------------------------------------------

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
    //
    // Walkthrough has its own movement controller.
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

                const forward =
                    new Vector3();


                camera.getWorldDirection(
                    forward
                );


                // Keep movement horizontal.
                forward.y = 0;


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


                    //--------------------------------------------------
                    // Keep OrbitControls target together with camera.
                    //--------------------------------------------------

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
    // EXIT WALKTHROUGH
    //
    // Return to the original landing camera.
    //==================================================

    useEffect(() => {

        const wasInWalkthrough =
            previousWalkthroughMode.current;


        const isNowInWalkthrough =
            walkthroughMode;


        //----------------------------------------------
        // Walkthrough → Normal editor
        //----------------------------------------------

        if (
            wasInWalkthrough &&
            !isNowInWalkthrough
        ) {

            camera.position.copy(
                LANDING_POSITION
            );


            if (
                controlsRef.current
            ) {

                controlsRef.current.target.copy(
                    LANDING_TARGET
                );

                controlsRef.current.update();

            }

        }


        previousWalkthroughMode.current =
            walkthroughMode;

    }, [
        walkthroughMode,
        camera
    ]);


    //==================================================
    // RESET KEYS WHEN MODE CHANGES
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

            target={[
                0,
                0,
                0
            ]}

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
                !walkthroughMode
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

        />

    );

}