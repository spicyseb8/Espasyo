import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import type {
    Window as WindowType
} from "../../engine/windows/WindowTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    normalizeWindowModel
} from "../../engine/windows/normalizeWindowModel";


interface Props {
    window: WindowType;
}


export default function Window({
    window
}: Props) {

    // --------------------------------------------------
    // Find asset
    // --------------------------------------------------

    const asset =
        findAsset(window.assetId);

    if (!asset) {
        return null;
    }


    // --------------------------------------------------
    // Load GLB
    // --------------------------------------------------

    const { scene } =
        useGLTF(asset.model);


    // --------------------------------------------------
    // Normalize model
    // --------------------------------------------------

    const normalized =
        useMemo(
            () =>
                normalizeWindowModel(
                    scene,
                    asset
                ),
            [
                scene,
                asset
            ]
        );


    // --------------------------------------------------
    // Final rotation
    //
    // window.rotationY = wall orientation
    // asset.rotationOffsetY = GLB correction
    // --------------------------------------------------

    const finalRotationY =
        window.rotationY +
        (asset.rotationOffsetY ?? 0);


    // --------------------------------------------------
    // Render
    // --------------------------------------------------

    return (

        <group

            position={[
                window.position.x,
                window.position.y,
                window.position.z
            ]}

            rotation={[
                0,
                finalRotationY,
                0
            ]}

        >

            <primitive
                object={normalized.model}
            />

        </group>

    );
}