import {
    memo,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useCursor,
    useGLTF
} from "@react-three/drei";

import useEditor
    from "../../context/editor/useEditor";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedFurnitureAsset,
    getFurnitureAssets
} from "../../engine/furniture/FirebaseFurnitureLibrary";

import type {
    Furniture
} from "../../engine/furniture/FurnitureTypes";

import type {
    Asset
} from "../../assets/Asset";

import {
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";


//======================================================
// PROPS
//======================================================

interface FurnitureItemProps {

    id:
        string;

    assetId:
        string;

    position:
        Furniture["position"];

    rotationY:
        number;

    modelOffset:
        Furniture["modelOffset"];

}


//======================================================
// HIGHLIGHT SETTINGS
//======================================================

const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


//======================================================
// ORIGINAL MATERIAL USER DATA
//======================================================

const ORIGINAL_COLOR_KEY =
    "__espasyoOriginalColor";

const ORIGINAL_EMISSIVE_KEY =
    "__espasyoOriginalEmissive";

const ORIGINAL_EMISSIVE_INTENSITY_KEY =
    "__espasyoOriginalEmissiveIntensity";


//======================================================
// APPLY HOVER HIGHLIGHT
//======================================================

function setFurnitureHighlight(

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

                    const standard =
                        material as
                            MeshStandardMaterial |
                            MeshPhysicalMaterial;


                    //--------------------------------------------------
                    // SAVE ORIGINAL COLOR
                    //--------------------------------------------------

                    if (
                        "color" in material &&
                        material.color
                    ) {

                        if (
                            standard.userData[
                                ORIGINAL_COLOR_KEY
                            ] === undefined
                        ) {

                            standard.userData[
                                ORIGINAL_COLOR_KEY
                            ] =
                                material.color.getHex();

                        }

                    }


                    //--------------------------------------------------
                    // SAVE ORIGINAL EMISSIVE
                    //--------------------------------------------------

                    if (
                        "emissive" in standard &&
                        standard.emissive
                    ) {

                        if (
                            standard.userData[
                                ORIGINAL_EMISSIVE_KEY
                            ] === undefined
                        ) {

                            standard.userData[
                                ORIGINAL_EMISSIVE_KEY
                            ] =
                                standard.emissive.getHex();

                        }


                        if (
                            standard.userData[
                                ORIGINAL_EMISSIVE_INTENSITY_KEY
                            ] === undefined
                        ) {

                            standard.userData[
                                ORIGINAL_EMISSIVE_INTENSITY_KEY
                            ] =
                                standard.emissiveIntensity;

                        }

                    }


                    //--------------------------------------------------
                    // HIGHLIGHT
                    //--------------------------------------------------

                    if (
                        highlighted
                    ) {

                        if (
                            "emissive" in standard &&
                            standard.emissive
                        ) {

                            standard.emissive.set(
                                HOVER_COLOR
                            );

                            standard.emissiveIntensity =
                                HOVER_EMISSIVE_INTENSITY;

                            return;

                        }


                        if (
                            "color" in material &&
                            material.color
                        ) {

                            const originalColor =
                                standard.userData[
                                    ORIGINAL_COLOR_KEY
                                ];


                            if (
                                typeof originalColor ===
                                "number"
                            ) {

                                material.color.setHex(
                                    originalColor
                                );

                            }


                            material.color.offsetHSL(
                                0,
                                0,
                                0.12
                            );

                        }


                        return;

                    }


                    //--------------------------------------------------
                    // RESTORE ORIGINAL
                    //--------------------------------------------------

                    const originalColor =
                        standard.userData[
                            ORIGINAL_COLOR_KEY
                        ];


                    if (
                        typeof originalColor ===
                        "number" &&

                        "color" in material &&
                        material.color
                    ) {

                        material.color.setHex(
                            originalColor
                        );

                    }


                    //--------------------------------------------------
                    // RESTORE EMISSIVE
                    //--------------------------------------------------

                    const originalEmissive =
                        standard.userData[
                            ORIGINAL_EMISSIVE_KEY
                        ];


                    if (
                        typeof originalEmissive ===
                        "number" &&

                        "emissive" in standard &&
                        standard.emissive
                    ) {

                        standard.emissive.setHex(
                            originalEmissive
                        );


                        const originalIntensity =
                            standard.userData[
                                ORIGINAL_EMISSIVE_INTENSITY_KEY
                            ];


                        if (
                            typeof originalIntensity ===
                            "number"
                        ) {

                            standard.emissiveIntensity =
                                originalIntensity;

                        }

                    }

                }

            );

        }

    );

}


//======================================================
// FURNITURE ITEM
//======================================================
//
// IMPORTANT:
//
// This component does NOT call useGLTF().
//
// It waits until a valid Asset with a valid model URL
// exists, then mounts FurnitureModel.
//
// This prevents:
//
//     useGLTF("")
//
// which was causing the HTML/JSON error.
//======================================================

function FurnitureItem({

    id,

    assetId,

    position,

    rotationY,

    modelOffset

}: FurnitureItemProps) {

    const {
        state
    } = useEditor();


    //--------------------------------------------------
    // Hover
    //--------------------------------------------------

    const [
        hovered,
        setHovered
    ] = useState(
        false
    );


    //--------------------------------------------------
    // Cursor
    //--------------------------------------------------

    useCursor(

        hovered &&
        !state.walkthroughMode,

        'url("/cursors/hand.png") 16 16, pointer'

    );


    //--------------------------------------------------
    // Firebase asset
    //
    // Firebase is preferred.
    // Local AssetLibrary remains a fallback.
    //--------------------------------------------------

    const asset:
        Asset | undefined =

        getCachedFurnitureAsset(
            assetId
        ) ??
        findAsset(
            assetId
        );


    //--------------------------------------------------
    // Hide while moving
    //--------------------------------------------------

    if (
        state.movingFurnitureId ===
        id
    ) {

        return null;
    }


    //--------------------------------------------------
    // Asset is not ready yet
    //
    // IMPORTANT:
    // Do NOT call useGLTF with an empty string.
    //--------------------------------------------------

    if (
        !asset
    ) {

        return null;
    }


    //--------------------------------------------------
    // Model URL is missing
    //--------------------------------------------------

    if (
        typeof asset.model !==
        "string" ||

        asset.model.trim() === ""
    ) {

        console.warn(

            "Furniture asset has no valid model URL:",

            {
                furnitureId:
                    id,

                assetId:
                    assetId,

                asset
            }

        );

        return null;
    }


    //--------------------------------------------------
    // Only now render the component that uses useGLTF.
    //--------------------------------------------------

    return (

        <FurnitureModel

            id={
                id
            }

            asset={
                asset
            }

            position={
                position
            }

            rotationY={
                rotationY
            }

            modelOffset={
                modelOffset
            }

            setHovered={
                setHovered
            }

        />

    );

}


//======================================================
// FURNITURE MODEL
//======================================================
//
// useGLTF() is isolated here.
//
// This component cannot mount until FurnitureItem
// confirms that asset.model is a real URL.
//======================================================

interface FurnitureModelProps {

    id:
        string;

    asset:
        Asset;

    position:
        Furniture["position"];

    rotationY:
        number;

    modelOffset:
        Furniture["modelOffset"];

    setHovered:
        (value: boolean) => void;

}


function FurnitureModel({

    id,

    asset,

    position,

    rotationY,

    modelOffset,

    setHovered

}: FurnitureModelProps) {

    const {
        state
    } = useEditor();


    //--------------------------------------------------
    // GLTF
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset.model
    );


    //--------------------------------------------------
    // Clone model
    //--------------------------------------------------

    const model =
        useMemo(

            () => {

                const clone =
                    scene.clone(
                        true
                    );


                //--------------------------------------------------
                // Furniture ID
                //--------------------------------------------------

                clone.traverse(

                    child => {

                        child.userData = {

                            ...child.userData,

                            furnitureId:
                                id

                        };


                        //--------------------------------------------------
                        // Shadows
                        //--------------------------------------------------

                        child.castShadow =
                            true;

                        child.receiveShadow =
                            true;


                        //--------------------------------------------------
                        // Clone materials
                        //--------------------------------------------------

                        if (
                            child instanceof Mesh
                        ) {

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

                    }

                );


                return clone;

            },

            [
                scene,
                id
            ]

        );


    //--------------------------------------------------
    // Clear hover when furniture starts moving
    //--------------------------------------------------

    useEffect(

        () => {

            if (
                state.movingFurnitureId ===
                id
            ) {

                setHovered(
                    false
                );

                setFurnitureHighlight(
                    model,
                    false
                );

            }

        },

        [
            state.movingFurnitureId,
            id,
            model,
            setHovered
        ]

    );


    //--------------------------------------------------
    // Pointer enter
    //--------------------------------------------------

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


            setFurnitureHighlight(
                model,
                true
            );

        };


    //--------------------------------------------------
    // Pointer leave
    //--------------------------------------------------

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


            setFurnitureHighlight(
                model,
                false
            );

        };


    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <group

            userData={{
                furnitureId:
                    id
            }}

            position={[
                position.x,
                position.y,
                position.z
            ]}

            rotation={[
                0,
                rotationY,
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
                    model
                }

                position={[
                    modelOffset.x,
                    modelOffset.y,
                    modelOffset.z
                ]}

            />

        </group>

    );

}


//======================================================
// FURNITURE SCENE
//======================================================

function FurnitureScene() {

    const {
        state
    } = useEditor();


    //--------------------------------------------------
    // Firebase catalog loaded
    //--------------------------------------------------

    const [
        firebaseFurnitureLoaded,
        setFirebaseFurnitureLoaded
    ] = useState(
        false
    );


    //--------------------------------------------------
    // Load Firebase catalog
    //--------------------------------------------------

    useEffect(

        () => {

            let cancelled =
                false;


            getFurnitureAssets()

                .then(

                    () => {

                        if (
                            !cancelled
                        ) {

                            setFirebaseFurnitureLoaded(
                                true
                            );

                        }

                    }

                )

                .catch(

                    error => {

                        console.error(

                            "Failed to load Firebase furniture catalog:",

                            error

                        );


                        if (
                            !cancelled
                        ) {

                            setFirebaseFurnitureLoaded(
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
    // Intentionally used to force a re-render after
    // the Firebase furniture catalog finishes loading.
    //--------------------------------------------------

    void firebaseFurnitureLoaded;


    //--------------------------------------------------
    // Render furniture
    //--------------------------------------------------

    return (

        <>

            {

                state.furniture.map(

                    furniture => (

                        <FurnitureItem

                            key={
                                furniture.id
                            }

                            id={
                                furniture.id
                            }

                            assetId={
                                furniture.assetId
                            }

                            position={
                                furniture.position
                            }

                            rotationY={
                                furniture.rotationY
                            }

                            modelOffset={
                                furniture.modelOffset
                            }

                        />

                    )

                )

            }

        </>

    );

}


//======================================================
// EXPORT
//======================================================

export default memo(
    FurnitureScene
);