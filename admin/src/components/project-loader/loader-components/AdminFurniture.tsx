import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import {
    Mesh
} from "three";

import type {
    Asset
} from "../engine/assets/Asset";

import type {
    SavedFurniture
} from "../ProjectTypes";


//==================================================
// PROPS
//==================================================

interface AdminFurnitureProps {

    furniture:
        SavedFurniture;

    asset:
        Asset;

}


//==================================================
// ADMIN FURNITURE
//==================================================

export default function AdminFurniture({
    furniture,
    asset
}: AdminFurnitureProps) {

    //--------------------------------------------------
    // MODEL URL
    //--------------------------------------------------

    if (
        typeof asset.model !== "string" ||
        asset.model.trim() === ""
    ) {

        console.warn(
            "Admin furniture has no valid model URL:",
            {
                furnitureId:
                    furniture.id,

                assetId:
                    furniture.assetId
            }
        );

        return null;

    }


    return (

        <AdminFurnitureModel

            furniture={
                furniture
            }

            asset={
                asset
            }

        />

    );

}


//==================================================
// MODEL
//==================================================

function AdminFurnitureModel({
    furniture,
    asset
}: AdminFurnitureProps) {

    const {
        scene
    } = useGLTF(
        asset.model
    );


    const model =
        useMemo(() => {

            const clone =
                scene.clone(
                    true
                );


            clone.traverse(
                child => {

                    child.userData = {

                        ...child.userData,

                        furnitureId:
                            furniture.id

                    };


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


                        child.castShadow =
                            true;

                        child.receiveShadow =
                            true;

                    }

                }
            );


            return clone;

        }, [
            scene,
            furniture.id
        ]);


    //--------------------------------------------------
    // Saved model offset
    //--------------------------------------------------

    const modelOffset =
        furniture.modelOffset;


    //--------------------------------------------------
    // Rotation
    //--------------------------------------------------

    const finalRotationY =
        furniture.rotationY +
        (
            asset.rotationOffsetY ??
            0
        );


    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <group

            position={[

                furniture.position.x,
                furniture.position.y,
                furniture.position.z

            ]}

            rotation={[

                0,
                finalRotationY,
                0

            ]}

            userData={{
                furnitureId:
                    furniture.id
            }}

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