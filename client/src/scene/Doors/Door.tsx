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
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";

import type {
    Door as DoorType
} from "../../engine/doors/DoorTypes";

import type {
    Asset
} from "../../assets/Asset";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedDoorAsset,
    getDoorWindowAssets
} from "../../engine/build/FirebaseDoorWindowLibrary";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import useEditor
    from "../../context/editor/useEditor";


//======================================================
// PROPS
//======================================================

interface Props {

    door:
        DoorType;
}


//======================================================
// HIGHLIGHT SETTINGS
//======================================================

const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


//======================================================
// HIGHLIGHT
//======================================================

function setDoorHighlight(
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
// DOOR
//======================================================
//
// IMPORTANT:
//
// This component does NOT call useGLTF() directly.
//
// It first waits for a usable Asset.
//
// This prevents:
//
//     useGLTF("")
//
// which was causing:
//
//     Unexpected token '<'
//
//======================================================

export default function Door({
    door
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
    // LOAD DOOR / WINDOW CATALOG
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
    // Intentionally read so the component rerenders
    // after the Firebase catalog finishes loading.
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
    //
    // Firebase asset is preferred.
    //
    // Existing local AssetLibrary remains as fallback.
    //==================================================

    const asset:
        Asset | undefined =

        getCachedDoorAsset(
            door.assetId
        ) ??
        findAsset(
            door.assetId
        );


    //==================================================
    // MOVING
    //==================================================

    const isMoving =
        buildInteraction.moveTarget?.type ===
            "door" &&

        buildInteraction.moveTarget.id ===
            door.id;


    if (
        isMoving
    ) {

        return null;
    }


    //==================================================
    // NO ASSET YET
    //==================================================
    //
    // Firebase catalog may still be loading.
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

            "Door asset has no valid model URL:",

            {
                doorId:
                    door.id,

                assetId:
                    door.assetId,

                asset
            }

        );

        return null;
    }


    //==================================================
    // ACTUAL GLTF MODEL
    //==================================================

    return (

        <DoorModel

            door={
                door
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
// DOOR MODEL
//======================================================

interface DoorModelProps {

    door:
        DoorType;

    asset:
        Asset;

    setHovered:
        (value: boolean) => void;
}


function DoorModel({

    door,

    asset,

    setHovered

}: DoorModelProps) {

    const {
        state
    } = useEditor();


    //==================================================
    // GLTF
    //==================================================
    //
    // At this point asset.model is guaranteed to be a
    // non-empty string.
    //==================================================

    const {
        scene
    } = useGLTF(
        asset.model
    );


    //==================================================
    // CLONE MODEL
    //==================================================

    const model =
        useMemo(

            () => {

                const clone =
                    scene.clone(
                        true
                    );


                //--------------------------------------------------
                // SCALE
                //--------------------------------------------------

                const scale =
                    asset.scale ??
                    1;


                clone.scale.set(
                    scale,
                    scale,
                    scale
                );


                //--------------------------------------------------
                // TRAVERSE
                //--------------------------------------------------

                clone.traverse(

                    child => {

                        child.userData = {

                            ...child.userData,

                            doorId:
                                door.id

                        };


                        //--------------------------------------------------
                        // MESH
                        //--------------------------------------------------

                        if (
                            child instanceof Mesh
                        ) {

                            //------------------------------------------------
                            // Clone array materials
                            //------------------------------------------------

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


                            //------------------------------------------------
                            // Clone single material
                            //------------------------------------------------

                            else if (
                                child.material
                            ) {

                                child.material =
                                    child.material.clone();

                            }


                            //------------------------------------------------
                            // Shadows
                            //------------------------------------------------

                            child.castShadow =
                                true;

                            child.receiveShadow =
                                true;

                        }

                    }

                );


                return clone;

            },

            [
                scene,
                door.id,
                asset.scale
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


            setDoorHighlight(
                model,
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


            setDoorHighlight(
                model,
                false
            );

        };


    //==================================================
    // ROTATION
    //==================================================

    const rotationOffsetY =
        asset.rotationOffsetY ??
        Math.PI / 2;


    const finalRotationY =
        door.rotationY +
        rotationOffsetY;


    //==================================================
    // RENDER
    //==================================================

    return (

        <group

            userData={{
                doorId:
                    door.id
            }}

            position={
                door.position
            }

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
                    model
                }
            />

        </group>

    );

}