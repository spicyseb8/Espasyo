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
    BackSide,
    DoubleSide,
    Mesh,
    MeshBasicMaterial
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

            hovered={
                hovered
            }

            setHovered={
                setHovered
            }

        />

    );

}


//======================================================
// FURNITURE MODEL PROPS
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

    hovered:
        boolean;

    setHovered:
        (value: boolean) => void;

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

function FurnitureModel({

    id,

    asset,

    position,

    rotationY,

    modelOffset,

    hovered,

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
    // Clone actual furniture model
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
    // Gray outline model
    //
    // VISUAL ONLY:
    // Every mesh has raycast disabled.
    //--------------------------------------------------

    const outlineModel =
        useMemo(

            () => {

                const clone =
                    scene.clone(
                        true
                    );


                clone.traverse(

                    child => {

                        if (
                            !(child instanceof Mesh)
                        ) {

                            return;

                        }


                        //--------------------------------------------------
                        // IMPORTANT:
                        //
                        // This mesh must NEVER receive pointer events.
                        // Otherwise the mouse can alternate between the
                        // outline and real furniture and cause flicker.
                        //--------------------------------------------------

                        child.raycast =
                            () => null;


                        //--------------------------------------------------
                        // Gray outline material
                        //--------------------------------------------------

                        child.material =

                            Array.isArray(
                                child.material
                            )

                                ? child.material.map(

                                    () =>
                                        new MeshBasicMaterial({

                                            color:
                                                "#666666",

                                            transparent:
                                                true,

                                            opacity:
                                                0.90,

                                            depthWrite:
                                                false,

                                            side:
                                                BackSide

                                        })

                                )

                                : new MeshBasicMaterial({

                                    color:
                                        "#666666",

                                    transparent:
                                        true,

                                    opacity:
                                        0.90,

                                    depthWrite:
                                        false,

                                    side:
                                        BackSide

                                });


                        //--------------------------------------------------
                        // Visual only
                        //--------------------------------------------------

                        child.castShadow =
                            false;

                        child.receiveShadow =
                            false;


                        //--------------------------------------------------
                        // Render behind actual furniture
                        //--------------------------------------------------

                        child.renderOrder =
                            -1;

                    }

                );


                return clone;

            },

            [
                scene
            ]

        );


    //--------------------------------------------------
    // Subtle gray highlight model
    //
    // VISUAL ONLY:
    // Every mesh has raycast disabled.
    //--------------------------------------------------

    const highlightModel =
        useMemo(

            () => {

                const clone =
                    scene.clone(
                        true
                    );


                clone.traverse(

                    child => {

                        if (
                            !(child instanceof Mesh)
                        ) {

                            return;

                        }


                        //--------------------------------------------------
                        // IMPORTANT:
                        //
                        // This mesh must NEVER receive pointer events.
                        //--------------------------------------------------

                        child.raycast =
                            () => null;


                        //--------------------------------------------------
                        // Very subtle gray overlay
                        //--------------------------------------------------

                        child.material =

                            Array.isArray(
                                child.material
                            )

                                ? child.material.map(

                                    () =>
                                        new MeshBasicMaterial({

                                            color:
                                                "#888888",

                                            transparent:
                                                true,

                                            opacity:
                                                0.055,

                                            depthWrite:
                                                false,

                                            side:
                                                DoubleSide

                                        })

                                )

                                : new MeshBasicMaterial({

                                    color:
                                        "#888888",

                                    transparent:
                                        true,

                                    opacity:
                                        0.055,

                                    depthWrite:
                                        false,

                                    side:
                                        DoubleSide

                                });


                        //--------------------------------------------------
                        // Visual only
                        //--------------------------------------------------

                        child.castShadow =
                            false;

                        child.receiveShadow =
                            false;


                        child.renderOrder =
                            1;

                    }

                );


                return clone;

            },

            [
                scene
            ]

        );


    //--------------------------------------------------
    // Selected furniture
    //--------------------------------------------------

    const selected =
        state.selectedFurnitureId ===
        id;


    //--------------------------------------------------
    // Show gray selection state
    //
    // Hover:
    //     gray outline + subtle gray highlight
    //
    // Selected:
    //     gray outline + subtle gray highlight
    //
    // Walkthrough:
    //     no highlight
    //--------------------------------------------------

    const showHighlight =

        !state.walkthroughMode &&

        (
            hovered ||
            selected
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

            }

        },

        [
            state.movingFurnitureId,
            id,
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


            //--------------------------------------------------
            // Stop event so parent objects do not interfere.
            //--------------------------------------------------

            event.stopPropagation();


            setHovered(
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

            {/*==================================================
                GRAY OUTLINE
            ==================================================*/}

            {
                showHighlight && (

                    <primitive

                        object={
                            outlineModel
                        }

                        position={[

                            modelOffset.x,

                            modelOffset.y,

                            modelOffset.z

                        ]}

                        scale={[

                            1.008,

                            1.008,

                            1.008

                        ]}

                    />

                )
            }


            {/*==================================================
                SUBTLE GRAY HIGHLIGHT
            ==================================================*/}

            {
                showHighlight && (

                    <primitive

                        object={
                            highlightModel
                        }

                        position={[

                            modelOffset.x,

                            modelOffset.y,

                            modelOffset.z

                        ]}

                    />

                )
            }


            {/*==================================================
                ACTUAL FURNITURE
            ==================================================*/}

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