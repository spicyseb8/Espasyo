import { useMemo } from "react";

import { useGLTF } from "@react-three/drei";

import type {
    Window as WindowType
} from "../../engine/windows/WindowTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

interface Props {
    window: WindowType;
}

export default function Window({
    window
}: Props) {

    const asset =
        findAsset(window.assetId);

    if (!asset)
        return null;

    const { scene } =
        useGLTF(asset.model);

    const model =
        useMemo(
            () => scene.clone(),
            [scene]
        );

   return (
    <group
        position={[
            window.position.x,
            window.position.y,
            window.position.z
        ]}
        rotation={[
            0,
            window.rotationY,
            0
        ]}
    >
        <group
            rotation={[
                0,
                -Math.PI / 2,
                0
            ]}
        >
            <primitive object={model} />
        </group>
    </group>
);
}