import {
    useMemo,
    useState
} from "react";

import {
    useCursor,
    useGLTF
} from "@react-three/drei";

import {
    Mesh,
    Material,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";

import type {
    Window as WindowType
} from "../../engine/windows/WindowTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedWindowAsset
} from "../../engine/build/FirebaseDoorWindowLibrary";

import {
    normalizeWindowModel
} from "../../engine/windows/normalizeWindowModel";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import useEditor
    from "../../context/editor/useEditor";


interface Props {

    window:
        WindowType;
}


const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


function isGlassMaterial(
    material:
        Material
): boolean {

    if (
        material.transparent
    ) {

        return true;
    }

    if (
        typeof material.opacity ===
            "number" &&
        material.opacity < 0.95
    ) {

        return true;
    }

    return false;
}


function configureWindowShadows(
    model:
        Object3D
): void {

    model.traverse(
        child => {

            if (
                !(child instanceof Mesh)
            ) {

                return;
            }

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

                child.castShadow =
                    !hasGlass;

                child.receiveShadow =
                    true;

                return;
            }

            const material =
                child.material;

            const glass =
                isGlassMaterial(
                    material
                );

            child.castShadow =
                !glass;

            child.receiveShadow =
                true;
        }
    );
}


function setWindowHighlight(
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
                    : [child.material];

            materials.forEach(
                material => {

                    if (
                        isGlassMaterial(
                            material
                        )
                    ) {

                        return;
                    }

                    const standard =
                        material as
                            | MeshStandardMaterial
                            | MeshPhysicalMaterial;

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


export default function Window({
    window
}: Props) {

    const {
        state
    } = useEditor();

    const [
        hovered,
        setHovered
    ] = useState(false);


    useCursor(
        hovered &&
        !state.walkthroughMode,
        'url("/cursors/hand.png") 16 16, pointer'
    );


    //--------------------------------------------------
    // Firebase first; local asset remains as fallback.
    //--------------------------------------------------

    const asset =
        getCachedWindowAsset(
            window.assetId
        ) ??
        findAsset(
            window.assetId
        );


    //--------------------------------------------------
    // GLTF
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

                const result =
                    normalizeWindowModel(
                        scene,
                        asset
                    );

                if (
                    result?.model
                ) {

                    result.model.traverse(
                        child => {

                            if (
                                !(child instanceof Mesh)
                            ) {

                                return;
                            }

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

                            } else if (
                                child.material
                            ) {

                                child.material =
                                    child.material.clone();

                            }
                        }
                    );
                }

                return result;
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


    if (
        !asset ||
        !normalized
    ) {

        return null;
    }


    //--------------------------------------------------
    // Hide only the window currently being moved.
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


    const finalRotationY =
        window.rotationY +
        (
            asset.rotationOffsetY ??
            0
        );


    const handlePointerEnter =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }

            event.stopPropagation();

            setHovered(true);

            setWindowHighlight(
                normalized.model,
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

            setHovered(false);

            setWindowHighlight(
                normalized.model,
                false
            );
        };


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
            onPointerEnter={
                handlePointerEnter
            }
            onPointerLeave={
                handlePointerLeave
            }
        >

            <primitive
                object={
                    normalized.model
                }
            />

        </group>
    );
}
