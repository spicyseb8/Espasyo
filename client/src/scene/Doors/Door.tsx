import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import type {
    Door as DoorType
} from "../../engine/doors/DoorTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    buildInteraction
} from "../Build/BuildInteraction";


interface Props {
    door: DoorType;
}


export default function Door({
    door
}: Props) {

    const asset =
        findAsset(
            door.assetId
        );

    if (!asset) {
        return null;
    }

    //--------------------------------------------------
    // Hide only the door currently being moved
    //--------------------------------------------------

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

    //--------------------------------------------------
    // GLTF
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset.model
    );

    //--------------------------------------------------
    // Clone
    //--------------------------------------------------

    const model =
        useMemo(
            () =>
                scene.clone(),
            [
                scene
            ]
        );

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

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
                door.rotationY,
                0
            ]}
        >

            <group
                rotation={[
                    0,
                    Math.PI / 2,
                    0
                ]}
            >

                <primitive
                    object={
                        model
                    }
                />

            </group>

        </group>

    );
}