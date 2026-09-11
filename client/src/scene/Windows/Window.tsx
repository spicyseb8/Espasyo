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

import {
    buildInteraction
} from "../Build/BuildInteraction";


interface Props {
    window: WindowType;
}


export default function Window({
    window
}: Props) {

    const asset =
        findAsset(
            window.assetId
        );

    if (!asset) {
        return null;
    }

    //--------------------------------------------------
    // Hide only the window currently being moved
    //--------------------------------------------------

    const isMoving =
        buildInteraction.moveTarget?.type ===
            "window" &&

        buildInteraction.moveTarget.id ===
            window.id;

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
    // Normalize window
    //--------------------------------------------------

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

    //--------------------------------------------------
    // Final rotation
    //--------------------------------------------------

    const finalRotationY =
        window.rotationY +
        (
            asset.rotationOffsetY ??
            0
        );

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <group
            userData={{
                windowId:
                    window.id
            }}

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
                object={
                    normalized.model
                }
            />

        </group>

    );
}