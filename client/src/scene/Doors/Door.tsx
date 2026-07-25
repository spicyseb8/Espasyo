import { useMemo } from "react";

import { useGLTF } from "@react-three/drei";

import type { Door as DoorType } from "../../engine/doors/DoorTypes";

import { findAsset } from "../../assets/AssetLibrary";

interface Props {

    door: DoorType;

}

export default function Door({

    door

}: Props) {

    //--------------------------------------------------
    // Find asset
    //--------------------------------------------------

    const asset = findAsset(door.assetId);
    if (!asset)
        return null;

    //--------------------------------------------------
    // Load model
    //--------------------------------------------------

    const { scene } = useGLTF(

        asset.model

    );

    //--------------------------------------------------
    // Clone model
    //--------------------------------------------------

    const model = useMemo(

        () => scene.clone(),

        [scene]

    );

    return (

        <group

            position={door.position}

            rotation={[

                0,

                door.rotationY,

                0

            ]}

        >

            {/*
                Same correction used in AssetPreview.
                Later this can become part of the asset metadata.
            */}

            <group rotation={[

                0,

                Math.PI / 2,

                0

            ]}>

                <primitive object={model} />

            </group>

        </group>

    );

}