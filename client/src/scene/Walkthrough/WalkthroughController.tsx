import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    PointerLockControls
} from "@react-three/drei";

import {
    useFrame,
    useThree
} from "@react-three/fiber";

import {
    Mesh,
    MeshStandardMaterial,
    Object3D,
    Raycaster,
    Scene,
    Vector2,
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildWallMeshes
} from "../../engine/walls/WallMeshBuilder";

import {
    canWalkTo,
    canSpawnAt,
    PLAYER_HEIGHT,
    PLAYER_RADIUS
} from "./WalkthroughCollision";


//==================================================
// SETTINGS
//==================================================

const WALK_SPEED =
    2.5;


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
// GET FLOOR OBJECTS
//==================================================

function getFloorObjects(
    scene:
        Scene
): Object3D[] {

    const objects:
        Object3D[] = [];

    scene.traverse(
        object => {

            if (
                object.userData
                    ?.isFloor === true
            ) {

                objects.push(
                    object
                );
            }
        }
    );

    return objects;
}


//==================================================
// GET FLOOR POINT
//==================================================

function getFloorPoint(
    raycaster:
        Raycaster,

    floorObjects:
        Object3D[]
): Vector3 | null {

    if (
        floorObjects.length === 0
    ) {

        return null;
    }

    const hits =
        raycaster.intersectObjects(
            floorObjects,
            true
        );

    if (
        hits.length === 0
    ) {

        return null;
    }

    return hits[0]
        .point
        .clone();
}


//==================================================
// WALKTHROUGH CONTROLLER
//==================================================

export default function WalkthroughController() {

    const {
        camera,
        scene,
        gl
    } = useThree();

    const {
        state,
        dispatch
    } = useEditor();


    //==================================================
    // POINTER
    //==================================================

    const pointer =
        useRef(
            new Vector2()
        );

    const raycaster =
        useRef(
            new Raycaster()
        );

    const hasPointer =
        useRef(
            false
        );


    //==================================================
    // SPAWN
    //==================================================

    const [
        spawnConfirmed,
        setSpawnConfirmed
    ] = useState(
        false
    );

    const spawnPosition =
        useRef<Vector3 | null>(
            null
        );

    const spawnValid =
        useRef(
            false
        );

    const spawnPreviewRef =
        useRef<Mesh | null>(
            null
        );


    //==================================================
    // POINTER LOCK CONTROLS
    //==================================================

    const controlsRef =
        useRef<any>(
            null
        );


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
        useMemo(
            () => {

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

            },
            [

                state.walls,

                state.wallHeight,

                state.wallThickness,

                state.doors,

                state.openings,

                state.windows

            ]
        );


    //==================================================
    // RESET WHEN WALKTHROUGH STARTS
    //==================================================

    useEffect(
        () => {

            if (
                !state.walkthroughMode
            ) {

                return;
            }


            //--------------------------------------------------
            // Start in spawn selection mode.
            //--------------------------------------------------

            setSpawnConfirmed(
                false
            );

            spawnPosition.current =
                null;

            spawnValid.current =
                false;

            hasPointer.current =
                false;


            //--------------------------------------------------
            // Clear movement keys.
            //--------------------------------------------------

            clearMovementKeys(
                keys
            );


            //--------------------------------------------------
            // Hide spawn preview.
            //--------------------------------------------------

            if (
                spawnPreviewRef.current
            ) {

                spawnPreviewRef.current.visible =
                    false;
            }

        },
        [
            state.walkthroughMode
        ]
    );


    //==================================================
    // EXIT POINTER LOCK WHEN WALKTHROUGH ENDS
    //==================================================

    useEffect(
        () => {

            if (
                state.walkthroughMode
            ) {

                return;
            }


            //--------------------------------------------------
            // Clear movement keys.
            //--------------------------------------------------

            clearMovementKeys(
                keys
            );


            //--------------------------------------------------
            // Release pointer lock.
            //--------------------------------------------------

            if (
                document.pointerLockElement
            ) {

                document.exitPointerLock();
            }


            //--------------------------------------------------
            // Restore cursor immediately.
            //--------------------------------------------------

            document.body.style.cursor =
                "default";

            gl.domElement.style.cursor =
                "default";


            //--------------------------------------------------
            // Clear spawn information.
            //--------------------------------------------------

            spawnPosition.current =
                null;

            spawnValid.current =
                false;

            hasPointer.current =
                false;

        },
        [
            state.walkthroughMode,
            gl
        ]
    );


    //==================================================
    // KEYBOARD
    //==================================================

    useEffect(
        () => {

            if (
                !state.walkthroughMode
            ) {

                return;
            }


            //==================================================
            // KEY DOWN
            //==================================================

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


                    //==================================================
                    // ESCAPE
                    //==================================================
                    //
                    // IMPORTANT:
                    //
                    // Capture phase is used so this handler gets
                    // the Escape event before other handlers.
                    //
                    // One Escape immediately:
                    //
                    // 1. releases pointer lock
                    // 2. exits walkthrough
                    // 3. restores cursor
                    //==================================================

                    if (
                        event.key ===
                        "Escape"
                    ) {

                        event.preventDefault();

                        event.stopPropagation();

                        event.stopImmediatePropagation();


                        //--------------------------------------------------
                        // Release pointer lock first.
                        //--------------------------------------------------

                        if (
                            document.pointerLockElement
                        ) {

                            document.exitPointerLock();
                        }


                        //--------------------------------------------------
                        // Clear movement keys.
                        //--------------------------------------------------

                        clearMovementKeys(
                            keys
                        );


                        //--------------------------------------------------
                        // Reset spawn state.
                        //--------------------------------------------------

                        setSpawnConfirmed(
                            false
                        );

                        spawnPosition.current =
                            null;

                        spawnValid.current =
                            false;

                        hasPointer.current =
                            false;


                        //--------------------------------------------------
                        // Exit walkthrough.
                        //--------------------------------------------------

                        dispatch({

                            type:
                                "TOGGLE_WALKTHROUGH"

                        });


                        return;
                    }


                    //==================================================
                    // SPACEBAR
                    //==================================================
                    //
                    // Space must never toggle walkthrough.
                    //==================================================

                    if (
                        event.key ===
                        " "
                    ) {

                        event.preventDefault();

                        event.stopPropagation();

                        return;
                    }


                    //==================================================
                    // MOVEMENT
                    //==================================================

                    if (
                        !spawnConfirmed
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


            //==================================================
            // KEY UP
            //==================================================

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


            //==================================================
            // WINDOW BLUR
            //==================================================

            const handleWindowBlur =
                () => {

                    clearMovementKeys(
                        keys
                    );
                };


            //==================================================
            // IMPORTANT:
            //
            // keydown uses CAPTURE phase.
            //==================================================

            window.addEventListener(
                "keydown",
                handleKeyDown,
                true
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
                    handleKeyDown,
                    true
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

        },
        [
            state.walkthroughMode,
            spawnConfirmed,
            dispatch
        ]
    );


    //==================================================
    // SPAWN SELECTION POINTER EVENTS
    //==================================================

    useEffect(
        () => {

            if (
                !state.walkthroughMode ||
                spawnConfirmed
            ) {

                return;
            }


            const canvas =
                gl.domElement;


            //==================================================
            // POINTER MOVE
            //==================================================

            function updatePointer(
                event:
                    PointerEvent
            ) {

                const rect =
                    canvas.getBoundingClientRect();


                if (
                    rect.width <= 0 ||
                    rect.height <= 0
                ) {

                    return;
                }


                const inside =
                    event.clientX >=
                        rect.left &&

                    event.clientX <=
                        rect.right &&

                    event.clientY >=
                        rect.top &&

                    event.clientY <=
                        rect.bottom;


                if (
                    !inside
                ) {

                    hasPointer.current =
                        false;

                    return;
                }


                pointer.current.x =
                    (
                        (
                            event.clientX -
                            rect.left
                        ) /
                        rect.width
                    ) *
                    2 -
                    1;


                pointer.current.y =
                    -(
                        (
                            event.clientY -
                            rect.top
                        ) /
                        rect.height
                    ) *
                    2 +
                    1;


                hasPointer.current =
                    true;
            }


            //==================================================
            // CONFIRM SPAWN
            //==================================================

            function onPointerDown(
                event:
                    PointerEvent
            ) {

                if (
                    event.button !==
                    0
                ) {

                    return;
                }


                if (
                    !spawnValid.current ||
                    !spawnPosition.current
                ) {

                    return;
                }


                event.preventDefault();

                event.stopPropagation();


                //==================================================
                // SET CAMERA
                //==================================================

                camera.position.copy(
                    spawnPosition.current
                );

                camera.position.y =
                    PLAYER_HEIGHT;


                //==================================================
                // CONFIRM SPAWN
                //==================================================

                setSpawnConfirmed(
                    true
                );


                //==================================================
                // POINTER LOCK
                //==================================================

                if (
                    canvas.requestPointerLock
                ) {

                    canvas.requestPointerLock();
                }

            }


            canvas.addEventListener(
                "pointermove",
                updatePointer
            );

            canvas.addEventListener(
                "pointerdown",
                onPointerDown
            );


            return () => {

                canvas.removeEventListener(
                    "pointermove",
                    updatePointer
                );

                canvas.removeEventListener(
                    "pointerdown",
                    onPointerDown
                );

            };

        },
        [

            gl,

            camera,

            state.walkthroughMode,

            spawnConfirmed

        ]
    );


    //==================================================
    // SPAWN PREVIEW
    //==================================================

    useFrame(
        () => {

            //--------------------------------------------------
            // Preview only before spawn.
            //--------------------------------------------------

            if (
                !state.walkthroughMode ||
                spawnConfirmed
            ) {

                if (
                    spawnPreviewRef.current
                ) {

                    spawnPreviewRef.current.visible =
                        false;
                }

                return;
            }


            if (
                !spawnPreviewRef.current
            ) {

                return;
            }


            //--------------------------------------------------
            // Mouse must be inside canvas.
            //--------------------------------------------------

            if (
                !hasPointer.current
            ) {

                spawnPreviewRef.current.visible =
                    false;

                spawnPosition.current =
                    null;

                spawnValid.current =
                    false;

                return;
            }


            //--------------------------------------------------
            // Raycast.
            //--------------------------------------------------

            raycaster.current.setFromCamera(

                pointer.current,

                camera

            );


            //--------------------------------------------------
            // Get current floor objects.
            //--------------------------------------------------

            const floorObjects =
                getFloorObjects(
                    scene
                );


            //--------------------------------------------------
            // Get floor point.
            //--------------------------------------------------

            const floorPoint =
                getFloorPoint(

                    raycaster.current,

                    floorObjects

                );


            if (
                !floorPoint
            ) {

                spawnPreviewRef.current.visible =
                    false;

                spawnPosition.current =
                    null;

                spawnValid.current =
                    false;

                return;
            }


            //--------------------------------------------------
            // Candidate player position.
            //--------------------------------------------------

            const candidate =
                floorPoint.clone();


            candidate.y =
                floorPoint.y +
                PLAYER_HEIGHT;


            //--------------------------------------------------
            // Furniture.
            //--------------------------------------------------

            const furniture =
                Array.isArray(
                    state.furniture
                )
                    ? state.furniture
                    : [];


            //--------------------------------------------------
            // Spawn safety.
            //--------------------------------------------------

            const valid =
                canSpawnAt(

                    candidate,

                    wallPieces,

                    furniture

                );


            spawnPosition.current =
                candidate;

            spawnValid.current =
                valid;


            //--------------------------------------------------
            // Show preview.
            //--------------------------------------------------

            spawnPreviewRef.current.visible =
                true;


            spawnPreviewRef.current.position.set(

                candidate.x,

                floorPoint.y +
                0.04,

                candidate.z

            );


            //--------------------------------------------------
            // Color.
            //--------------------------------------------------

            const material =
                spawnPreviewRef.current
                    .material;


            if (
                material instanceof
                MeshStandardMaterial
            ) {

                material.color.set(

                    valid
                        ? "#4DA3FF"
                        : "#D9534F"

                );


                material.opacity =
                    valid
                        ? 0.65
                        : 0.50;
            }

        }
    );


    //==================================================
    // WALK MOVEMENT
    //==================================================

    useFrame(
        (
            _,
            delta
        ) => {

            if (
                !state.walkthroughMode ||
                !spawnConfirmed
            ) {

                return;
            }


            //------------------------------------------
            // Keep eye height fixed.
            //------------------------------------------

            camera.position.y =
                PLAYER_HEIGHT;


            //------------------------------------------
            // Forward.
            //------------------------------------------

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


            //------------------------------------------
            // Right.
            //------------------------------------------

            const right =
                new Vector3(

                    -forward.z,

                    0,

                    forward.x

                );


            //------------------------------------------
            // Movement.
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


            if (
                movement.lengthSq() ===
                0
            ) {

                return;
            }


            movement.normalize();


            const totalDistance =
                WALK_SPEED *
                delta;


            //------------------------------------------
            // Small movement steps.
            //------------------------------------------

            const maxStep =
                PLAYER_RADIUS *
                0.45;


            const steps =
                Math.max(

                    1,

                    Math.ceil(
                        totalDistance /
                        maxStep
                    )

                );


            const stepMovement =
                movement
                    .clone()
                    .multiplyScalar(

                        totalDistance /
                        steps

                    );


            //------------------------------------------
            // Furniture.
            //------------------------------------------

            const furniture =
                Array.isArray(
                    state.furniture
                )
                    ? state.furniture
                    : [];


            //------------------------------------------
            // Movement substeps.
            //------------------------------------------

            for (
                let i = 0;
                i < steps;
                i++
            ) {

                const current =
                    camera.position.clone();


                //------------------------------------------
                // Full movement.
                //------------------------------------------

                const full =
                    current
                        .clone()
                        .add(
                            stepMovement
                        );


                if (
                    canWalkTo(

                        full,

                        wallPieces,

                        furniture

                    )
                ) {

                    camera.position.copy(
                        full
                    );

                    continue;
                }


                //------------------------------------------
                // X slide.
                //------------------------------------------

                const xOnly =
                    current.clone();


                xOnly.x +=
                    stepMovement.x;


                if (
                    canWalkTo(

                        xOnly,

                        wallPieces,

                        furniture

                    )
                ) {

                    camera.position.x =
                        xOnly.x;
                }


                //------------------------------------------
                // Z slide.
                //------------------------------------------

                const zOnly =
                    camera.position.clone();


                zOnly.z +=
                    stepMovement.z;


                if (
                    canWalkTo(

                        zOnly,

                        wallPieces,

                        furniture

                    )
                ) {

                    camera.position.z =
                        zOnly.z;
                }

            }

        }
    );


    //==================================================
    // NOT WALKTHROUGH
    //==================================================

    if (
        !state.walkthroughMode
    ) {

        return null;
    }


    //==================================================
    // RENDER
    //==================================================

    return (

        <>

            {/*==================================================
                SPAWN PREVIEW
            ==================================================*/}

            {
                !spawnConfirmed && (

                    <mesh
                        ref={
                            spawnPreviewRef
                        }

                        visible={
                            false
                        }
                    >

                        <cylinderGeometry
                            args={[
                                PLAYER_RADIUS,
                                PLAYER_RADIUS,
                                0.06,
                                32
                            ]}
                        />

                        <meshStandardMaterial

                            color={
                                "#4DA3FF"
                            }

                            transparent

                            opacity={
                                0.65
                            }

                            depthWrite={
                                false
                            }

                            roughness={
                                0.8
                            }

                        />

                    </mesh>
                )
            }


            {/*==================================================
                POINTER LOCK
            ==================================================*/}

            <PointerLockControls
                ref={
                    controlsRef
                }

                enabled={
                    spawnConfirmed
                }
            />

        </>

    );
}