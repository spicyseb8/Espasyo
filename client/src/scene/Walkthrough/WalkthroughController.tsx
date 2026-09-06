import {
    useEffect,
    useMemo,
    useRef
} from "react";

import {
    PointerLockControls
} from "@react-three/drei";

import {
    useFrame,
    useThree
} from "@react-three/fiber";

import {
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildWallMeshes
} from "../../engine/walls/WallMeshBuilder";

import {
    canWalkTo,
    PLAYER_HEIGHT
} from "./WalkthroughCollision";

import {
    getWalkthroughSpawn
} from "./WalkthroughSpawn";


//==================================================
// SETTINGS
//==================================================

const WALK_SPEED = 2.5;


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
// WALKTHROUGH CONTROLLER
//==================================================

export default function WalkthroughController() {

    const {
        camera
    } = useThree();


    const {
        state
    } = useEditor();


    //==================================================
    // KEYS
    //==================================================

    const keys =
        useRef({

            w: false,

            a: false,

            s: false,

            d: false

        });


    //==================================================
    // BUILD COLLISION WALL PIECES
    //==================================================

    const wallPieces =
        useMemo(() => {

            if (
                !state.walls ||
                state.walls.length === 0
            ) {

                return [];

            }


            return state.walls.flatMap(
                wall => {

                    return buildWallMeshes(

                        wall,

                        state.wallHeight,

                        state.wallThickness,

                        state.doors,

                        state.openings,

                        state.windows

                    );

                }
            );

        }, [

            state.walls,

            state.wallHeight,

            state.wallThickness,

            state.doors,

            state.openings,

            state.windows

        ]);


    //==================================================
    // KEYBOARD
    //==================================================

    useEffect(() => {

        if (
            !state.walkthroughMode
        ) {

            return;

        }


        const handleKeyDown =
            (
                event: KeyboardEvent
            ) => {

                //--------------------------------------------------
                // Do not trigger walkthrough movement while typing.
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

    }, [
        state.walkthroughMode
    ]);


    //==================================================
    // SPAWN PLAYER
    //==================================================

    useEffect(() => {

        if (
            !state.walkthroughMode
        ) {

            return;

        }


        const spawn =
            getWalkthroughSpawn(
                state.walls
            );


        if (!spawn) {

            return;

        }


        camera.position.copy(
            spawn
        );

    }, [
        state.walkthroughMode,
        state.walls,
        camera
    ]);


    //==================================================
    // RESET KEYS
    //==================================================

    useEffect(() => {

        if (
            !state.walkthroughMode
        ) {

            clearMovementKeys(
                keys
            );

        }

    }, [
        state.walkthroughMode
    ]);


    //==================================================
    // MOVEMENT
    //==================================================

    useFrame(
        (
            _,
            delta
        ) => {

            if (
                !state.walkthroughMode
            ) {

                return;

            }


            //------------------------------------------
            // Keep player's eye height fixed.
            //------------------------------------------

            camera.position.y =
                PLAYER_HEIGHT;


            //------------------------------------------
            // Forward direction
            //------------------------------------------

            const forward =
                new Vector3();


            camera.getWorldDirection(
                forward
            );


            forward.y = 0;


            if (
                forward.lengthSq() > 0
            ) {

                forward.normalize();

            }


            //------------------------------------------
            // Right direction
            //------------------------------------------

            const right =
                new Vector3(

                    -forward.z,

                    0,

                    forward.x

                );


            //------------------------------------------
            // Movement
            //------------------------------------------

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


            //------------------------------------------
            // Nothing to move
            //------------------------------------------

            if (
                movement.lengthSq() === 0
            ) {

                return;

            }


            movement.normalize();


            movement.multiplyScalar(
                WALK_SPEED *
                delta
            );


            //------------------------------------------
            // Furniture
            //------------------------------------------

            const furniture =
                Array.isArray(
                    state.furniture
                )
                    ? state.furniture
                    : [];


            //------------------------------------------
            // X MOVEMENT
            //------------------------------------------

            const nextX =
                camera.position.clone();


            nextX.x +=
                movement.x;


            if (
                canWalkTo(

                    nextX,

                    wallPieces,

                    furniture

                )
            ) {

                camera.position.x =
                    nextX.x;

            }


            //------------------------------------------
            // Z MOVEMENT
            //------------------------------------------

            const nextZ =
                camera.position.clone();


            nextZ.z +=
                movement.z;


            if (
                canWalkTo(

                    nextZ,

                    wallPieces,

                    furniture

                )
            ) {

                camera.position.z =
                    nextZ.z;

            }

        }
    );


    //==================================================
    // POINTER LOCK
    //==================================================

    if (
        !state.walkthroughMode
    ) {

        return null;

    }


    return (

        <PointerLockControls />

    );

}