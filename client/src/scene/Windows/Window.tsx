import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useCursor,
    useGLTF
} from "@react-three/drei";

import {
    Mesh,
    Material,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";

import type {
    Window as WindowType
} from "../../engine/windows/WindowTypes";

import type {
    Asset
} from "../../assets/Asset";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedWindowAsset,
    getDoorWindowAssets
} from "../../engine/build/FirebaseDoorWindowLibrary";

import {
    normalizeWindowModel
} from "../../engine/windows/normalizeWindowModel";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import useEditor
    from "../../context/editor/useEditor";


//======================================================
// PROPS
//======================================================

interface Props {

    window:
        WindowType;
}


//======================================================
// HIGHLIGHT SETTINGS
//======================================================

const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


//======================================================
// GLASS DETECTION
//======================================================

function isGlassMaterial(
    material:
        Material
): boolean {

    if (
        material.transparent
    ) {

        return true;
    }


    if (
        typeof material.opacity ===
            "number" &&

        material.opacity < 0.95
    ) {

        return true;
    }


    return false;
}


//======================================================
// WINDOW SHADOWS
//======================================================

function configureWindowShadows(
    model:
        Object3D
): void {

    model.traverse(

        child => {

            if (
                !(child instanceof Mesh)
            ) {

                return;
            }


            if (
                Array.isArray(
                    child.material
                )
            ) {

                const hasGlass =
                    child.material.some(

                        material =>
                            isGlassMaterial(
                                material
                            )

                    );


                child.castShadow =
                    !hasGlass;

                child.receiveShadow =
                    true;


                return;
            }


            const material =
                child.material;


            const glass =
                isGlassMaterial(
                    material
                );


            child.castShadow =
                !glass;

            child.receiveShadow =
                true;

        }

    );

}


//======================================================
// WINDOW HIGHLIGHT
//======================================================

function setWindowHighlight(
    object:
        Object3D,

    highlighted:
        boolean

) {

    object.traverse(

        child => {

            if (
                !(child instanceof Mesh)
            ) {

                return;
            }


            const materials =
                Array.isArray(
                    child.material
                )

                    ? child.material

                    : [
                        child.material
                    ];


            materials.forEach(

                material => {

                    //--------------------------------------------------
                    // Don't highlight glass
                    //--------------------------------------------------

                    if (
                        isGlassMaterial(
                            material
                        )
                    ) {

                        return;
                    }


                    const standard =
                        material as
                            | MeshStandardMaterial
                            | MeshPhysicalMaterial;


                    //--------------------------------------------------
                    // EMISSIVE
                    //--------------------------------------------------

                    if (
                        "emissive" in standard &&
                        standard.emissive
                    ) {

                        if (
                            highlighted
                        ) {

                            standard.emissive.set(
                                HOVER_COLOR
                            );

                            standard.emissiveIntensity =
                                HOVER_EMISSIVE_INTENSITY;

                        } else {

                            standard.emissive.set(
                                0x000000
                            );

                            standard.emissiveIntensity =
                                0;

                        }


                        return;
                    }


                    //--------------------------------------------------
                    // FALLBACK COLOR
                    //--------------------------------------------------

                    if (
                        "color" in material &&
                        material.color &&
                        highlighted
                    ) {

                        material.color.offsetHSL(
                            0,
                            0,
                            0.12
                        );

                    }

                }

            );

        }

    );

}


//======================================================
// DEFAULT WINDOW CASING
//======================================================
//
// Generated automatically around every window.
// It is NOT a Firebase asset.
//
// IMPORTANT:
//
// The window model is centered around its local Y origin.
// Therefore the casing must also be centered around Y = 0.
//
// This prevents:
//
// - casing appearing too high
// - bottom casing appearing through the middle
// - incorrect vertical alignment
//
// Casing is shown on both wall faces.
//======================================================

interface WindowCasingProps {

    windowId:
        string;

    width:
        number;

    height:
        number;

    wallThickness:
        number;
}


//======================================================
// CASING SETTINGS
//======================================================

const WINDOW_CASING_WIDTH =
    0.060;

const WINDOW_CASING_DEPTH =
    0.025;

const WINDOW_CASING_GAP =
    0.004;

const WINDOW_CASING_COLOR =
    "#E9E5DE";


//======================================================
// WINDOW CASING
//======================================================

function WindowCasing({

    windowId,

    width,

    height,

    wallThickness

}: WindowCasingProps) {

    //--------------------------------------------------
    // Push casing slightly outside each wall face.
    //--------------------------------------------------

    const sideOffset =
        wallThickness * 0.5 +
        WINDOW_CASING_DEPTH * 0.5 +
        WINDOW_CASING_GAP;


    //--------------------------------------------------
    // Window is centered around Y = 0.
    //
    // Therefore:
    //
    // top    = +height / 2
    // bottom = -height / 2
    //--------------------------------------------------

    const halfHeight =
        height * 0.5;

    const halfWidth =
        width * 0.5;


    //--------------------------------------------------
    // Vertical casing center.
    //--------------------------------------------------

    const verticalY =
        0;


    //--------------------------------------------------
    // Bottom casing center.
    //
    // Move half a casing width below the window edge.
    //--------------------------------------------------

    const bottomY =
        -halfHeight -
        WINDOW_CASING_WIDTH * 0.5;


    //--------------------------------------------------
    // Top casing center.
    //--------------------------------------------------

    const topY =
        halfHeight +
        WINDOW_CASING_WIDTH * 0.5;


    //--------------------------------------------------
    // Left / right casing center.
    //--------------------------------------------------

    const leftX =
        -halfWidth -
        WINDOW_CASING_WIDTH * 0.5;


    const rightX =
        halfWidth +
        WINDOW_CASING_WIDTH * 0.5;


    //--------------------------------------------------
    // Horizontal casing width.
    //--------------------------------------------------

    const horizontalWidth =
        width +
        WINDOW_CASING_WIDTH * 2;


    //--------------------------------------------------
    // Render on both wall faces.
    //--------------------------------------------------

    const sides = [
        -1,
        1
    ] as const;


    return (

        <group>

            {
                sides.map(

                    side => {

                        const z =
                            side *
                            sideOffset;


                        return (

                            <group

                                key={
                                    `window-casing-${windowId}-${side}`
                                }

                            >

                                {/*==================================================
                                    LEFT CASING
                                ==================================================*/}

                                <mesh

                                    position={[

                                        leftX,

                                        verticalY,

                                        z

                                    ]}

                                    userData={{

                                        windowId

                                    }}

                                    castShadow

                                    receiveShadow

                                >

                                    <boxGeometry

                                        args={[

                                            WINDOW_CASING_WIDTH,

                                            height,

                                            WINDOW_CASING_DEPTH

                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/*==================================================
                                    RIGHT CASING
                                ==================================================*/}

                                <mesh

                                    position={[

                                        rightX,

                                        verticalY,

                                        z

                                    ]}

                                    userData={{

                                        windowId

                                    }}

                                    castShadow

                                    receiveShadow

                                >

                                    <boxGeometry

                                        args={[

                                            WINDOW_CASING_WIDTH,

                                            height,

                                            WINDOW_CASING_DEPTH

                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/*==================================================
                                    BOTTOM CASING
                                ==================================================*/}

                                <mesh

                                    position={[

                                        0,

                                        bottomY,

                                        z

                                    ]}

                                    userData={{

                                        windowId

                                    }}

                                    castShadow

                                    receiveShadow

                                >

                                    <boxGeometry

                                        args={[

                                            horizontalWidth,

                                            WINDOW_CASING_WIDTH,

                                            WINDOW_CASING_DEPTH

                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/*==================================================
                                    TOP CASING
                                ==================================================*/}

                                <mesh

                                    position={[

                                        0,

                                        topY,

                                        z

                                    ]}

                                    userData={{

                                        windowId

                                    }}

                                    castShadow

                                    receiveShadow

                                >

                                    <boxGeometry

                                        args={[

                                            horizontalWidth,

                                            WINDOW_CASING_WIDTH,

                                            WINDOW_CASING_DEPTH

                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>

                            </group>

                        );

                    }

                )
            }

        </group>

    );

}

//======================================================
// WINDOW
//======================================================
//
// IMPORTANT:
//
// This component does not call useGLTF() until a valid
// Firebase/local Asset with a non-empty model URL exists.
//======================================================

export default function Window({
    window
}: Props) {

    const {
        state
    } = useEditor();


    //==================================================
    // HOVER
    //==================================================

    const [
        hovered,
        setHovered
    ] = useState(false);


    //==================================================
    // CATALOG READY
    //==================================================

    const [
        catalogReady,
        setCatalogReady
    ] = useState(false);


    //==================================================
    // LOAD FIREBASE DOOR/WINDOW CATALOG
    //==================================================

    useEffect(

        () => {

            let cancelled =
                false;


            getDoorWindowAssets()

                .then(

                    () => {

                        if (
                            !cancelled
                        ) {

                            setCatalogReady(
                                true
                            );

                        }

                    }

                )

                .catch(

                    error => {

                        console.error(

                            "Failed to load Firebase door/window catalog:",

                            error

                        );


                        if (
                            !cancelled
                        ) {

                            setCatalogReady(
                                true
                            );

                        }

                    }

                );


            return () => {

                cancelled =
                    true;

            };

        },

        []

    );


    //--------------------------------------------------
    // Intentionally used to rerender after catalog
    // loading.
    //--------------------------------------------------

    void catalogReady;


    //==================================================
    // CURSOR
    //==================================================

    useCursor(

        hovered &&
        !state.walkthroughMode,

        'url("/cursors/hand.png") 16 16, pointer'

    );


    //==================================================
    // ASSET
    //==================================================

    const asset:
        Asset | undefined =

        getCachedWindowAsset(
            window.assetId
        ) ??
        findAsset(
            window.assetId
        );


    //==================================================
    // MOVING
    //==================================================

    const isMoving =
        buildInteraction.moveTarget?.type ===
            "window" &&

        buildInteraction.moveTarget.id ===
            window.id;


    if (
        isMoving
    ) {

        return null;
    }


    //==================================================
    // NO ASSET YET
    //==================================================

    if (
        !asset
    ) {

        return null;
    }


    //==================================================
    // NO VALID MODEL URL
    //==================================================

    if (
        typeof asset.model !==
        "string" ||

        asset.model.trim() === ""
    ) {

        console.warn(

            "Window asset has no valid model URL:",

            {
                windowId:
                    window.id,

                assetId:
                    window.assetId,

                asset
            }

        );

        return null;
    }


    //==================================================
    // ACTUAL GLTF MODEL
    //==================================================

    return (

        <WindowModel

            window={
                window
            }

            asset={
                asset
            }

            setHovered={
                setHovered
            }

        />

    );

}


//======================================================
// WINDOW MODEL
//======================================================

interface WindowModelProps {

    window:
        WindowType;

    asset:
        Asset;

    setHovered:
        (value: boolean) => void;

}


function WindowModel({

    window,

    asset,

    setHovered

}: WindowModelProps) {

    const {
        state
    } = useEditor();


    //==================================================
    // GLTF
    //==================================================

    const {
        scene
    } = useGLTF(
        asset.model
    );


    //==================================================
    // NORMALIZE WINDOW MODEL
    //==================================================

    const normalized =
        useMemo(

            () => {

                const result =
                    normalizeWindowModel(
                        scene,
                        asset
                    );


                //--------------------------------------------------
                // Clone materials
                //--------------------------------------------------

                if (
                    result?.model
                ) {

                    result.model.traverse(

                        child => {

                            if (
                                !(child instanceof Mesh)
                            ) {

                                return;
                            }


                            if (
                                Array.isArray(
                                    child.material
                                )
                            ) {

                                child.material =
                                    child.material.map(
                                        material =>
                                            material.clone()
                                    );

                            }

                            else if (
                                child.material
                            ) {

                                child.material =
                                    child.material.clone();

                            }

                        }

                    );

                }


                return result;

            },

            [
                scene,
                asset
            ]

        );


    //==================================================
    // CONFIGURE SHADOWS
    //==================================================

    useMemo(

        () => {

            if (
                !normalized?.model
            ) {

                return;
            }


            configureWindowShadows(
                normalized.model
            );

        },

        [
            normalized
        ]

    );


    //==================================================
    // NORMALIZATION FAILED
    //==================================================

    if (
        !normalized?.model
    ) {

        return null;
    }


    //==================================================
    // POINTER ENTER
    //==================================================

    const handlePointerEnter =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }


            event.stopPropagation();


            setHovered(
                true
            );


            setWindowHighlight(
                normalized.model,
                true
            );

        };


    //==================================================
    // POINTER LEAVE
    //==================================================

    const handlePointerLeave =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }


            event.stopPropagation();


            setHovered(
                false
            );


            setWindowHighlight(
                normalized.model,
                false
            );

        };


    //==================================================
    // ROTATION
    //==================================================

    const finalRotationY =
        window.rotationY +
        (
            asset.rotationOffsetY ??
            0
        );


    //==================================================
    // RENDER
    //==================================================

    return (

        <group

            userData={{
                windowId:
                    window.id
            }}

            position={[
                window.position.x,
                window.position.y,
                window.position.z
            ]}

            rotation={[
                0,
                finalRotationY,
                0
            ]}

            onPointerEnter={
                handlePointerEnter
            }

            onPointerLeave={
                handlePointerLeave
            }

        >

            {/*==================================================
                DEFAULT WINDOW CASING
            ==================================================*/}

            <WindowCasing

                windowId={
                    window.id
                }

                width={
                    window.width
                }

                height={
                    window.height
                }

                wallThickness={
                    state.wallThickness
                }

            />


            <primitive
                object={
                    normalized.model
                }
            />

        </group>

    );

}