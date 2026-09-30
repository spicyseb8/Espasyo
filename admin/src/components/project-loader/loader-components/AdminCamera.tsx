import {
    useEffect,
    useRef
} from "react";

import {
    OrbitControls
} from "@react-three/drei";

import {
    useFrame
} from "@react-three/fiber";

import {
    MathUtils,
    Vector3
} from "three";

import type {
    OrbitControls as OrbitControlsImpl
} from "three-stdlib";


//==================================================
// CAMERA SETTINGS
//==================================================

const MIN_DISTANCE =
    2;

const MAX_DISTANCE =
    100;

const MIN_POLAR_ANGLE =
    0;

const MAX_POLAR_ANGLE =
    Math.PI / 2 -
    MathUtils.degToRad(2);


//--------------------------------------------------
// WASD SPEED
//--------------------------------------------------

const MOVE_SPEED =
    4;

const FAST_MOVE_MULTIPLIER =
    2;


//==================================================
// ADMIN CAMERA
//==================================================

export default function AdminCamera() {

    //--------------------------------------------------
    // OrbitControls reference
    //--------------------------------------------------

    const controlsRef =
        useRef<OrbitControlsImpl | null>(
            null
        );


    //--------------------------------------------------
    // Keyboard state
    //--------------------------------------------------

    const keys =
        useRef(
            new Set<string>()
        );


    //--------------------------------------------------
    // Movement vectors
    //--------------------------------------------------

    const forward =
        useRef(
            new Vector3()
        );

    const right =
        useRef(
            new Vector3()
        );

    const movement =
        useRef(
            new Vector3()
        );


    //==================================================
    // KEYBOARD EVENTS
    //==================================================

    useEffect(() => {

        function handleKeyDown(
            event: KeyboardEvent
        ) {

            const key =
                event.key.toLowerCase();


            if (
                [
                    "w",
                    "a",
                    "s",
                    "d",
                    "shift"
                ].includes(
                    key
                )
            ) {

                event.preventDefault();

                keys.current.add(
                    key
                );

            }

        }


        function handleKeyUp(
            event: KeyboardEvent
        ) {

            const key =
                event.key.toLowerCase();


            keys.current.delete(
                key
            );

        }


        function handleBlur() {

            keys.current.clear();

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

        };

    }, []);


    //==================================================
    // WASD MOVEMENT
    //==================================================

    useFrame(
        ({
            camera
        }, delta) => {

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


            //--------------------------------------------------
            // Camera forward direction
            //--------------------------------------------------

            camera.getWorldDirection(
                forward.current
            );


            //--------------------------------------------------
            // Keep movement horizontal
            //--------------------------------------------------

            forward.current.y =
                0;


            if (
                forward.current.lengthSq() <
                0.000001
            ) {

                return;

            }


            forward.current.normalize();


            //--------------------------------------------------
            // Camera right direction
            //--------------------------------------------------

            right.current.crossVectors(

                forward.current,

                new Vector3(
                    0,
                    1,
                    0
                )

            );


            right.current.normalize();


            //--------------------------------------------------
            // Input direction
            //--------------------------------------------------

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


            //--------------------------------------------------
            // Prevent diagonal movement from being faster
            //--------------------------------------------------

            if (
                movement.current.lengthSq() >
                0.000001
            ) {

                movement.current.normalize();

            }


            //--------------------------------------------------
            // Speed
            //--------------------------------------------------

            const speed =
                MOVE_SPEED *
                (
                    keys.current.has("shift")
                        ? FAST_MOVE_MULTIPLIER
                        : 1
                );


            const distance =
                speed *
                delta;


            movement.current.multiplyScalar(
                distance
            );


            //--------------------------------------------------
            // Move camera
            //--------------------------------------------------

            camera.position.add(
                movement.current
            );


            //--------------------------------------------------
            // Move OrbitControls target too
            //--------------------------------------------------

            const controls =
                controlsRef.current;


            if (
                controls
            ) {

                controls.target.add(
                    movement.current
                );

                controls.update();

            }

        }
    );


    //==================================================
    // RENDER
    //==================================================

    return (

        <OrbitControls

            ref={
                controlsRef
            }

            makeDefault

            enablePan={
                true
            }

            enableZoom={
                true
            }

            enableRotate={
                true
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