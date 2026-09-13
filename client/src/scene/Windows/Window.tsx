import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import {
    Mesh,
    Material,
    Object3D
} from "three";

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


//==================================================
// PROPS
//==================================================

interface Props {

    window: WindowType;

}


//==================================================
// Check whether a material is likely glass
//==================================================

function isGlassMaterial(
    material: Material
): boolean {

    //--------------------------------------------------
    // Transparent material
    //--------------------------------------------------

    if (
        material.transparent
    ) {

        return true;
    }

    //--------------------------------------------------
    // Very low opacity
    //--------------------------------------------------

    if (
        typeof material.opacity === "number" &&
        material.opacity < 0.95
    ) {

        return true;
    }

    return false;
}


//==================================================
// Configure window shadows
//==================================================

function configureWindowShadows(
    model: Object3D
): void {

    model.traverse(
        child => {

            if (
                !(child instanceof Mesh)
            ) {

                return;
            }

            //--------------------------------------------------
            // Multiple materials
            //--------------------------------------------------

            if (
                Array.isArray(
                    child.material
                )
            ) {

                const hasGlass =
                    child.material.some(
                        material =>
                            isGlassMaterial(
                                material
                            )
                    );

                //--------------------------------------------------
                // If this mesh contains glass material,
                // don't let the whole mesh cast a shadow.
                //--------------------------------------------------

                child.castShadow =
                    !hasGlass;

                child.receiveShadow =
                    true;

                return;
            }

            //--------------------------------------------------
            // Single material
            //--------------------------------------------------

            const material =
                child.material;

            const glass =
                isGlassMaterial(
                    material
                );

            //--------------------------------------------------
            // Opaque frame/divisions cast shadows.
            //--------------------------------------------------

            child.castShadow =
                !glass;

            //--------------------------------------------------
            // Everything can receive shadows.
            //--------------------------------------------------

            child.receiveShadow =
                true;
        }
    );
}


//==================================================
// WINDOW
//==================================================

export default function Window({
    window
}: Props) {

    const asset =
        findAsset(
            window.assetId
        );

    //--------------------------------------------------
    // GLTF
    //
    // Always call the hook before conditional return.
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset?.model ?? ""
    );

    //--------------------------------------------------
    // Normalize window model
    //--------------------------------------------------

    const normalized =
        useMemo(
            () => {

                if (
                    !asset
                ) {

                    return null;
                }

                return normalizeWindowModel(
                    scene,
                    asset
                );

            },
            [
                scene,
                asset
            ]
        );

    //--------------------------------------------------
    // Configure shadows
    //--------------------------------------------------

    useMemo(
        () => {

            if (
                !normalized?.model
            ) {

                return;
            }

            configureWindowShadows(
                normalized.model
            );

        },
        [
            normalized
        ]
    );

    //--------------------------------------------------
    // No asset / normalized model
    //--------------------------------------------------

    if (
        !asset ||
        !normalized
    ) {

        return null;
    }

    //--------------------------------------------------
    // Hide only the window currently being moved
    //--------------------------------------------------

    const isMoving =
        buildInteraction
            .moveTarget
            ?.type ===
            "window" &&

        buildInteraction
            .moveTarget
            .id ===
            window.id;

    if (
        isMoving
    ) {

        return null;
    }

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