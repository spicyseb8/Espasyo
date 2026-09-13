import {
    useMemo
} from "react";

import {
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


interface FurnitureItemProps {

    id: string;

    assetId: string;

    position:
        Furniture["position"];

    rotationY: number;

    modelOffset:
        Furniture["modelOffset"];
}


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


    const asset =
        findAsset(
            assetId
        );


    if (
        !asset
    ) {

        return null;
    }


    //==================================================
    // Hide original while furniture is being moved
    //==================================================

    if (
        state.movingFurnitureId === id
    ) {

        return null;
    }


    //==================================================
    // GLTF
    //==================================================

    const {
        scene
    } = useGLTF(
        asset.model
    );


    //==================================================
    // Clone and configure model
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
                // FURNITURE ID
                //==================================================

                clone.traverse(
                    child => {

                        child.userData =
                            {

                                ...child.userData,

                                furnitureId:
                                    id

                            };


                        //==================================================
                        // SHADOWS
                        //==================================================

                        child.castShadow =
                            true;

                        child.receiveShadow =
                            true;

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