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

            <primitive
                object={
                    normalized.model
                }
            />

        </group>

    );

}