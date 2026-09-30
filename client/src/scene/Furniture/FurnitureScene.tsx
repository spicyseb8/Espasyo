import {
    memo,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    useCursor,
    useGLTF
} from "@react-three/drei";

import {
    useFrame
} from "@react-three/fiber";

import useEditor
    from "../../context/editor/useEditor";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedFurnitureAsset,
    getFurnitureAssets
} from "../../engine/furniture/FirebaseFurnitureLibrary";

import {
    furnitureInteraction
} from "../../scene/Furniture/FurnitureInteraction";

import type {
    Furniture
} from "../../engine/furniture/FurnitureTypes";

import type {
    Asset
} from "../../assets/Asset";

import {
    BackSide,
    DoubleSide,
    Group,
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
    // Asset unavailable
    //--------------------------------------------------

    if (
        !asset
    ) {

        return null;

    }


    //--------------------------------------------------
    // Model URL unavailable
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
    // Only now render FurnitureModel.
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
    // Main furniture group
    //--------------------------------------------------

    const groupRef =
        useRef<Group>(
            null
        );


    //--------------------------------------------------
    // GLTF
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset.model
    );


    //==================================================
    // ACTUAL MODEL
    //==================================================

    const model =
        useMemo(

            () => {

                const clone =
                    scene.clone(
                        true
                    );


                clone.traverse(

                    child => {

                        child.userData = {

                            ...child.userData,

                            furnitureId:
                                id

                        };


                        child.castShadow =
                            true;

                        child.receiveShadow =
                            true;


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


    //==================================================
    // GRAY OUTLINE
    //==================================================

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


                        child.raycast =
                            () => null;


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


                        child.castShadow =
                            false;

                        child.receiveShadow =
                            false;

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


    //==================================================
    // SUBTLE HIGHLIGHT
    //==================================================

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


                        child.raycast =
                            () => null;


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


    //==================================================
    // RED ROTATION BLOCKED MODEL
    //==================================================

    const rotationBlockedModel =
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
                        // Visual only.
                        //--------------------------------------------------

                        child.raycast =
                            () => null;


                        child.material =

                            Array.isArray(
                                child.material
                            )

                                ? child.material.map(

                                    () =>
                                        new MeshBasicMaterial({

                                            color:
                                                "#D9534F",

                                            transparent:
                                                true,

                                            opacity:
                                                0.62,

                                            depthWrite:
                                                false,

                                            side:
                                                DoubleSide

                                        })

                                )

                                : new MeshBasicMaterial({

                                    color:
                                        "#D9534F",

                                    transparent:
                                        true,

                                    opacity:
                                        0.62,

                                    depthWrite:
                                        false,

                                    side:
                                        DoubleSide

                                });


                        child.castShadow =
                            false;

                        child.receiveShadow =
                            false;

                        child.renderOrder =
                            5;

                    }

                );


                clone.visible =
                    false;


                return clone;

            },

            [
                scene
            ]

        );


    //==================================================
    // SELECTED
    //==================================================

    const selected =
        state.selectedFurnitureId ===
        id;


    //==================================================
    // NORMAL HIGHLIGHT
    //==================================================

    const showHighlight =

        !state.walkthroughMode &&

        (
            hovered ||
            selected
        );


    //==================================================
    // LIVE ROTATION PREVIEW
    //==================================================

    useFrame(

        () => {

            if (
                !groupRef.current
            ) {
                return;
            }


            const isRotating =
                furnitureInteraction
                    .rotatingFurnitureId ===
                id;


            const previewRotation =
                furnitureInteraction
                    .rotationPreviewY;


            if (

                isRotating &&

                previewRotation !== null

            ) {

                //--------------------------------------------------
                // Rotate actual visible furniture visually.
                // This is preview only until pointer release.
                //--------------------------------------------------

                groupRef.current.rotation.y =
                    previewRotation;


                //--------------------------------------------------
                // Hide normal selection effects during rotation.
                //--------------------------------------------------

                outlineModel.visible =
                    false;

                highlightModel.visible =
                    false;


                //--------------------------------------------------
                // Show red overlay only when unsafe.
                //--------------------------------------------------

                rotationBlockedModel.visible =
                    !furnitureInteraction
                        .rotationPreviewValid;

            }

            else {

                //--------------------------------------------------
                // Return to committed editor rotation.
                //--------------------------------------------------

                groupRef.current.rotation.y =
                    rotationY;


                //--------------------------------------------------
                // Hide red blocked preview.
                //--------------------------------------------------

                rotationBlockedModel.visible =
                    false;


                //--------------------------------------------------
                // Restore normal selection appearance.
                //--------------------------------------------------

                outlineModel.visible =
                    showHighlight;

                highlightModel.visible =
                    showHighlight;

            }

        }

    );


    //==================================================
    // CLEAR HOVER WHEN MOVING
    //==================================================

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

        };


    //==================================================
    // RENDER
    //==================================================

    return (

        <group

            ref={
                groupRef
            }

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
                GRAY HIGHLIGHT
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
                RED UNSAFE ROTATION PREVIEW
            ==================================================*/}

            <primitive

                object={
                    rotationBlockedModel
                }

                position={[

                    modelOffset.x,
                    modelOffset.y,
                    modelOffset.z

                ]}

            />


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
    // Force render after Firebase catalog finishes.
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