import {
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
    getFurnitureScale
} from "./FurnitureSizing";

import type {
    Furniture
} from "../../engine/furniture/FurnitureTypes";

import {
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";


//==================================================
// PROPS
//==================================================

interface FurnitureItemProps {

    id: string;

    assetId: string;

    position:
        Furniture["position"];

    rotationY: number;

    modelOffset:
        Furniture["modelOffset"];
}


//==================================================
// HIGHLIGHT SETTINGS
//==================================================

const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


//==================================================
// APPLY HOVER HIGHLIGHT
//==================================================

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
                            | MeshStandardMaterial
                            | MeshPhysicalMaterial;


                    //--------------------------------------------------
                    // Standard / Physical material
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

                        }

                        else {

                            standard.emissive.set(
                                0x000000
                            );

                            standard.emissiveIntensity =
                                0;

                        }

                        return;
                    }


                    //--------------------------------------------------
                    // Fallback
                    //--------------------------------------------------

                    if (
                        "color" in material &&
                        material.color
                    ) {

                        if (
                            highlighted
                        ) {

                            material.color.offsetHSL(
                                0,
                                0,
                                0.12
                            );

                        }

                    }

                }
            );

        }
    );

}


//==================================================
// FURNITURE ITEM
//==================================================

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


    const [
        hovered,
        setHovered
    ] = useState(
        false
    );


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

    const asset =
        findAsset(
            assetId
        );


    //==================================================
    // GLTF
    //==================================================

    const {
        scene
    } = useGLTF(
        asset?.model ?? ""
    );


    //==================================================
    // Hide original while furniture is being moved
    //==================================================

    if (
        !asset ||
        state.movingFurnitureId === id
    ) {

        return null;
    }


    //==================================================
    // CLONE AND CONFIGURE MODEL
    //==================================================

    const model =
        useMemo(
            () => {

                const clone =
                    scene.clone(
                        true
                    );


                //==================================================
                // SCALE
                //==================================================

                if (
                    asset.furnitureDimensions
                ) {

                    const scale =
                        getFurnitureScale(
                            clone,
                            asset.furnitureDimensions
                        );

                    clone.scale.copy(
                        scale
                    );

                }


                //==================================================
                // FURNITURE ID + SHADOWS
                //==================================================

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


                        //--------------------------------------------------
                        // Clone materials so hover highlighting does
                        // not modify other furniture using the same GLTF.
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
                asset.furnitureDimensions,
                id
            ]
        );


    //==================================================
    // HOVER
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


            setFurnitureHighlight(
                model,
                true
            );

        };


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


    //==================================================
    // RENDER
    //==================================================

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


//==================================================
// FURNITURE SCENE
//==================================================

export default function FurnitureScene() {

    const {
        state
    } = useEditor();


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