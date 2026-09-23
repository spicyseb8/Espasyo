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
    Group,
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

import {
    walkthroughSpawnState
} from "./WalkthroughSpawnState";


//==================================================
// SETTINGS
//==================================================

const WALK_SPEED =
    2.5;


//==================================================
// ZOOM SETTINGS
//==================================================

const ORBIT_ZOOM_SPEED =
    1.0;

const MIN_CAMERA_HEIGHT =
    3;

const MAX_CAMERA_HEIGHT =
    60;

const MAX_TRANSITION_ZOOM_OFFSET =
    30;


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

interface WalkthroughControllerProps {

    onSpawnConfirmed?:
        (
            confirmed:
                boolean
        ) => void;

}


export default function WalkthroughController({

    onSpawnConfirmed

}: WalkthroughControllerProps) {


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


    //==================================================
    // PERSON PREVIEW
    //==================================================

    const personPreviewRef =
        useRef<Group | null>(
            null
        );


    //==================================================
    // PERSON MATERIAL
    //==================================================

    const personMaterial =
        useMemo(
            () =>
                new MeshStandardMaterial({

                    color:
                        "#4DA3FF",

                    transparent:
                        true,

                    opacity:
                        0.60,

                    depthWrite:
                        false,

                    roughness:
                        0.75,

                    metalness:
                        0

                }),

            []
        );


    //==================================================
    // POINTER LOCK
    //==================================================

    const controlsRef =
        useRef<any>(
            null
        );


    //==================================================
    // WALKTHROUGH KEYS
    //==================================================

    const keys =
        useRef({

            w: false,

            a: false,

            s: false,

            d: false

        });


    //==================================================
    // COLLISION WALL PIECES
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
    // START WALKTHROUGH
    //==================================================

    useEffect(() => {

        if (
            !state.walkthroughMode
        ) {

            return;

        }


        //--------------------------------------------------
        // Start in spawn-selection mode.
        //--------------------------------------------------

        setSpawnConfirmed(
            false
        );


        onSpawnConfirmed?.(
            false
        );


        spawnPosition.current =
            null;


        spawnValid.current =
            false;


        hasPointer.current =
            false;


        //--------------------------------------------------
        // Reset shared spawn state.
        //--------------------------------------------------

        walkthroughSpawnState.offset.set(
            0,
            0,
            0
        );

        walkthroughSpawnState.confirmed =
            false;


        //--------------------------------------------------
        // WASD MOVEMENT IS AVAILABLE IMMEDIATELY.
        //--------------------------------------------------

        clearMovementKeys(
            keys
        );


        if (
            personPreviewRef.current
        ) {

            personPreviewRef.current.visible =
                false;

        }

    }, [

        state.walkthroughMode

    ]);


    //==================================================
    // EXIT WALKTHROUGH CLEANUP
    //==================================================

    useEffect(() => {

        if (
            state.walkthroughMode
        ) {

            return;

        }


        clearMovementKeys(
            keys
        );


        if (
            document.pointerLockElement
        ) {

            document.exitPointerLock();

        }


        document.body.style.cursor =
            "default";


        gl.domElement.style.cursor =
            "default";


        spawnPosition.current =
            null;


        spawnValid.current =
            false;


        hasPointer.current =
            false;


        if (
            personPreviewRef.current
        ) {

            personPreviewRef.current.visible =
                false;

        }

    }, [

        state.walkthroughMode,

        gl

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
                event:
                    KeyboardEvent
            ) => {


                //--------------------------------------------------
                // Never control walkthrough while typing.
                //--------------------------------------------------

                if (
                    isTypingTarget(
                        event.target
                    )
                ) {

                    return;

                }


                //--------------------------------------------------
                // ESCAPE
                //--------------------------------------------------

                if (
                    event.key ===
                    "Escape"
                ) {

                    event.preventDefault();

                    event.stopPropagation();

                    event.stopImmediatePropagation();


                    if (
                        document.pointerLockElement
                    ) {

                        document.exitPointerLock();

                    }


                    clearMovementKeys(
                        keys
                    );


                    setSpawnConfirmed(
                        false
                    );


                    onSpawnConfirmed?.(
                        false
                    );


                    spawnPosition.current =
                        null;


                    spawnValid.current =
                        false;


                    hasPointer.current =
                        false;


                    if (
                        personPreviewRef.current
                    ) {

                        personPreviewRef.current.visible =
                            false;

                    }


                    document.body.style.cursor =
                        "default";


                    gl.domElement.style.cursor =
                        "default";


                    dispatch({

                        type:
                            "TOGGLE_WALKTHROUGH"

                    });


                    return;

                }


                //--------------------------------------------------
                // SPACEBAR
                //--------------------------------------------------

                if (
                    event.key ===
                    " "
                ) {

                    event.preventDefault();

                    event.stopPropagation();

                    return;

                }


                //--------------------------------------------------
                // WALKTHROUGH MOVEMENT
                //--------------------------------------------------

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


        const handleBlur =
            () => {

                clearMovementKeys(
                    keys
                );

            };


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
            handleBlur
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
                handleBlur
            );

        };

    }, [

        state.walkthroughMode,

        dispatch,

        gl

    ]);


    //==================================================
    // SPAWN POINTER
    //==================================================

    useEffect(() => {

        if (
            !state.walkthroughMode ||
            spawnConfirmed
        ) {

            return;

        }


        const canvas =
            gl.domElement;


        //--------------------------------------------------
        // POINTER MOVE
        //--------------------------------------------------

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


        //--------------------------------------------------
        // CONFIRM SPAWN
        //--------------------------------------------------

        function handlePointerDown(
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


            //--------------------------------------------------
            // Place player at selected position.
            //--------------------------------------------------

            camera.position.copy(
                spawnPosition.current
            );


            camera.position.y =
                PLAYER_HEIGHT;


            //--------------------------------------------------
            // Confirm spawn.
            //--------------------------------------------------

            setSpawnConfirmed(
                true
            );


            onSpawnConfirmed?.(
                true
            );


            //--------------------------------------------------
            // Tell Camera.tsx to cancel its transition.
            //--------------------------------------------------

            walkthroughSpawnState.confirmed =
                true;


            //--------------------------------------------------
            // Hide preview.
            //--------------------------------------------------

            if (
                personPreviewRef.current
            ) {

                personPreviewRef.current.visible =
                    false;

            }


            //--------------------------------------------------
            // DO NOT requestPointerLock().
            //
            // The cursor remains unlocked until the user
            // clicks the canvas again.
            //--------------------------------------------------

        }


        canvas.addEventListener(
            "pointermove",
            updatePointer
        );


        canvas.addEventListener(
            "pointerdown",
            handlePointerDown
        );


        return () => {

            canvas.removeEventListener(
                "pointermove",
                updatePointer
            );


            canvas.removeEventListener(
                "pointerdown",
                handlePointerDown
            );

        };

    }, [

        gl,

        camera,

        state.walkthroughMode,

        spawnConfirmed,

        onSpawnConfirmed

    ]);


   useEffect(() => {

    if (
        !state.walkthroughMode ||
        spawnConfirmed
    ) {

        return;

    }


    const canvas =
        gl.domElement;


    function handleWheel(
        event:
            WheelEvent
    ) {

        event.preventDefault();

        event.stopPropagation();


        //--------------------------------------------------
        // Multiplicative dolly, matching OrbitControls.
        //--------------------------------------------------

        const scrollUnits =
            event.deltaY *
            0.01;

        const factor =
            Math.pow(
                0.95,
                scrollUnits *
                ORBIT_ZOOM_SPEED
            );


        //--------------------------------------------------
        // Current effective height.
        //
        // During transition, use the top-down end Y plus
        // the accumulated offset (that's where the camera
        // is heading, so scaling relative to it feels
        // stable even mid-tilt).
        //--------------------------------------------------

        let currentHeight:
            number;


        if (
            walkthroughSpawnState.transitionActive
        ) {

            currentHeight =
                walkthroughSpawnState.topViewY +
                walkthroughSpawnState.offset.y;

        } else {

            currentHeight =
                camera.position.y;

        }


        //--------------------------------------------------
        // Clamp.
        //--------------------------------------------------

        const targetHeight =
            Math.max(

                MIN_CAMERA_HEIGHT,

                Math.min(

                    MAX_CAMERA_HEIGHT,

                    currentHeight *
                    factor

                )

            );


        const deltaY =
            targetHeight -
            currentHeight;


        //--------------------------------------------------
        // Apply.
        //--------------------------------------------------

        if (
            walkthroughSpawnState.transitionActive
        ) {

            walkthroughSpawnState.offset.y +=
                deltaY;


            //--------------------------------------------------
            // Keep offset bounded so it cannot drift far
            // from the top-down Y.
            //--------------------------------------------------

            if (
                walkthroughSpawnState.offset.y <
                -MAX_TRANSITION_ZOOM_OFFSET
            ) {

                walkthroughSpawnState.offset.y =
                    -MAX_TRANSITION_ZOOM_OFFSET;

            }


            if (
                walkthroughSpawnState.offset.y >
                MAX_TRANSITION_ZOOM_OFFSET
            ) {

                walkthroughSpawnState.offset.y =
                    MAX_TRANSITION_ZOOM_OFFSET;

            }

        } else {

            camera.position.y =
                targetHeight;

        }

    }


    canvas.addEventListener(
        "wheel",
        handleWheel,
        { passive: false }
    );


    return () => {

        canvas.removeEventListener(
            "wheel",
            handleWheel
        );

    };

}, [

    gl,

    camera,

    state.walkthroughMode,

    spawnConfirmed

]);


    //==================================================
    // SPAWN PREVIEW
    //==================================================

    useFrame(() => {

        if (
            !state.walkthroughMode ||
            spawnConfirmed
        ) {

            if (
                personPreviewRef.current
            ) {

                personPreviewRef.current.visible =
                    false;

            }

            return;

        }


        if (
            !personPreviewRef.current
        ) {

            return;

        }


        //--------------------------------------------------
        // No mouse position.
        //--------------------------------------------------

        if (
            !hasPointer.current
        ) {

            personPreviewRef.current.visible =
                false;


            spawnPosition.current =
                null;


            spawnValid.current =
                false;


            return;

        }


        //--------------------------------------------------
        // Ray from mouse.
        //--------------------------------------------------

        raycaster.current.setFromCamera(

            pointer.current,

            camera

        );


        //--------------------------------------------------
        // Floor.
        //--------------------------------------------------

        const floorObjects =
            getFloorObjects(
                scene
            );


        const floorPoint =
            getFloorPoint(

                raycaster.current,

                floorObjects

            );


        if (
            !floorPoint
        ) {

            personPreviewRef.current.visible =
                false;


            spawnPosition.current =
                null;


            spawnValid.current =
                false;


            return;

        }


        //--------------------------------------------------
        // Candidate position.
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
        // Check spawn.
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

        personPreviewRef.current.visible =
            true;


        personPreviewRef.current.position.set(

            candidate.x,

            floorPoint.y,

            candidate.z

        );


        //--------------------------------------------------
        // Preview color.
        //--------------------------------------------------

        personMaterial.color.set(

            valid
                ? "#4DA3FF"
                : "#D9534F"

        );


        personMaterial.opacity =
            valid
                ? 0.60
                : 0.48;

    });


    //==================================================
    // WALKTHROUGH MOVEMENT
    //==================================================
    //
    //  SPAWN-SELECTION MODE (spawnConfirmed = false):
    //
    //      Axis source: fixed world axes, because the
    //      top-down view is world-aligned
    //          screen-up    = world -Z
    //          screen-right = world +X
    //
    //      While Camera.tsx's transition is still active,
    //      WASD is written into walkthroughSpawnState.offset
    //      and Camera.tsx adds it to its lerp target — so
    //      WASD steers the camera during the tilt without
    //      fighting the lerp.
    //
    //      Once the transition settles, WASD moves
    //      camera.position directly. No collision —
    //      spawn-selection is a free-flying observer.
    //
    //  PLAYER MODE (spawnConfirmed = true):
    //
    //      Axis source: camera look direction.
    //      Collision with walls and furniture active.
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


            //--------------------------------------------------
            // Keep eye height once spawned.
            //--------------------------------------------------

            if (
                spawnConfirmed
            ) {

                camera.position.y =
                    PLAYER_HEIGHT;

            }


            //--------------------------------------------------
            // Forward / right axes.
            //--------------------------------------------------

            let forward:
                Vector3;

            let right:
                Vector3;


            if (
                spawnConfirmed
            ) {

                forward =
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


                right =
                    new Vector3(

                        -forward.z,

                        0,

                        forward.x

                    );

            } else {

                forward =
                    new Vector3(
                        0,
                        0,
                        -1
                    );


                right =
                    new Vector3(
                        1,
                        0,
                        0
                    );

            }


            //--------------------------------------------------
            // Movement.
            //--------------------------------------------------

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


            //--------------------------------------------------
            // SPAWN-SELECTION MODE
            //--------------------------------------------------

            if (
                !spawnConfirmed
            ) {

                if (
                    walkthroughSpawnState.transitionActive
                ) {

                    walkthroughSpawnState.offset
                        .addScaledVector(

                            movement,

                            totalDistance

                        );

                } else {

                    camera.position
                        .addScaledVector(

                            movement,

                            totalDistance

                        );

                }

                return;

            }


            //--------------------------------------------------
            // PLAYER MODE: substep collision.
            //--------------------------------------------------

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


            const furniture =
                Array.isArray(
                    state.furniture
                )
                    ? state.furniture
                    : [];


            for (
                let i = 0;
                i < steps;
                i++
            ) {

                const current =
                    camera.position.clone();


                //--------------------------------------------------
                // Full movement.
                //--------------------------------------------------

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


                //--------------------------------------------------
                // X slide.
                //--------------------------------------------------

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


                //--------------------------------------------------
                // Z slide.
                //--------------------------------------------------

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
                PERSON SPAWN PREVIEW
            ==================================================*/}

            {
                !spawnConfirmed && (

                    <group

                        ref={
                            personPreviewRef
                        }

                        visible={
                            false
                        }

                        renderOrder={
                            1000
                        }

                    >

                        {/* Spawn circle */}

                        <mesh

                            rotation={[
                                -Math.PI / 2,
                                0,
                                0
                            ]}

                            renderOrder={
                                1000
                            }

                        >

                            <circleGeometry

                                args={[
                                    PLAYER_RADIUS *
                                        1.15,
                                    32
                                ]}

                            />

                            <meshBasicMaterial

                                color={
                                    "#4DA3FF"
                                }

                                transparent

                                opacity={
                                    0.18
                                }

                                depthWrite={
                                    false
                                }

                            />

                        </mesh>


                        {/* Left leg */}

                        <mesh

                            position={[
                                -0.09,
                                0.43,
                                0
                            ]}

                        >

                            <cylinderGeometry

                                args={[
                                    0.07,
                                    0.07,
                                    0.86,
                                    12
                                ]}

                            />

                            <primitive

                                object={
                                    personMaterial
                                }

                                attach="material"

                            />

                        </mesh>


                        {/* Right leg */}

                        <mesh

                            position={[
                                0.09,
                                0.43,
                                0
                            ]}

                        >

                            <cylinderGeometry

                                args={[
                                    0.07,
                                    0.07,
                                    0.86,
                                    12
                                ]}

                            />

                            <primitive

                                object={
                                    personMaterial
                                }

                                attach="material"

                            />

                        </mesh>


                        {/* Body */}

                        <mesh

                            position={[
                                0,
                                1.03,
                                0
                            ]}

                        >

                            <cylinderGeometry

                                args={[
                                    0.18,
                                    0.21,
                                    0.68,
                                    16
                                ]}

                            />

                            <primitive

                                object={
                                    personMaterial
                                }

                                attach="material"

                            />

                        </mesh>


                        {/* Left arm */}

                        <mesh

                            position={[
                                -0.27,
                                1.05,
                                0
                            ]}

                            rotation={[
                                0,
                                0,
                                -0.08
                            ]}

                        >

                            <cylinderGeometry

                                args={[
                                    0.055,
                                    0.055,
                                    0.58,
                                    12
                                ]}

                            />

                            <primitive

                                object={
                                    personMaterial
                                }

                                attach="material"

                            />

                        </mesh>


                        {/* Right arm */}

                        <mesh

                            position={[
                                0.27,
                                1.05,
                                0
                            ]}

                            rotation={[
                                0,
                                0,
                                0.08
                            ]}

                        >

                            <cylinderGeometry

                                args={[
                                    0.055,
                                    0.055,
                                    0.58,
                                    12
                                ]}

                            />

                            <primitive

                                object={
                                    personMaterial
                                }

                                attach="material"

                            />

                        </mesh>


                        {/* Head */}

                        <mesh

                            position={[
                                0,
                                1.56,
                                0
                            ]}

                        >

                            <sphereGeometry

                                args={[
                                    0.16,
                                    16,
                                    16
                                ]}

                            />

                            <primitive

                                object={
                                    personMaterial
                                }

                                attach="material"

                            />

                        </mesh>

                    </group>

                )
            }


            {/*==================================================
                POINTER LOCK CONTROLS
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