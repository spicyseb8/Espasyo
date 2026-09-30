import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import {
    Box3,
    Group,
    Mesh,
    Vector3
} from "three";

import type {
    Asset
} from "../engine/assets/Asset";

import type {
    SavedWindow
} from "../ProjectTypes";


interface AdminWindowProps {

    window:
        SavedWindow;

    asset:
        Asset;

    wallThickness:
        number;

}


//==================================================
// CASING SETTINGS
//==================================================

const WINDOW_CASING_WIDTH =
    0.060;

const WINDOW_CASING_DEPTH =
    0.025;

const WINDOW_CASING_GAP =
    0.004;

const WINDOW_CASING_COLOR =
    "#E9E5DE";


//==================================================
// WINDOW CASING
//==================================================

function WindowCasing({
    windowId,
    width,
    height,
    wallThickness
}: {
    windowId:
        string;

    width:
        number;

    height:
        number;

    wallThickness:
        number;
}) {

    const sideOffset =
        wallThickness *
        0.5 +

        WINDOW_CASING_DEPTH *
        0.5 +

        WINDOW_CASING_GAP;


    const halfWidth =
        width *
        0.5;


    const halfHeight =
        height *
        0.5;


    const leftX =
        -halfWidth -
        WINDOW_CASING_WIDTH * 0.5;


    const rightX =
        halfWidth +
        WINDOW_CASING_WIDTH * 0.5;


    const topY =
        halfHeight +
        WINDOW_CASING_WIDTH * 0.5;


    const bottomY =
        -halfHeight -
        WINDOW_CASING_WIDTH * 0.5;


    const horizontalWidth =
        width +
        WINDOW_CASING_WIDTH * 2;


    const sides = [
        -1,
        1
    ] as const;


    return (

        <group>

            {
                sides.map(
                    side => {

                        const z =
                            side *
                            sideOffset;


                        return (

                            <group

                                key={
                                    `admin-window-casing-${windowId}-${side}`
                                }

                            >

                                {/* LEFT */}

                                <mesh

                                    position={[
                                        leftX,
                                        0,
                                        z
                                    ]}

                                    castShadow

                                    receiveShadow

                                    raycast={
                                        () => {}
                                    }

                                >

                                    <boxGeometry

                                        args={[
                                            WINDOW_CASING_WIDTH,
                                            height,
                                            WINDOW_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/* RIGHT */}

                                <mesh

                                    position={[
                                        rightX,
                                        0,
                                        z
                                    ]}

                                    castShadow

                                    receiveShadow

                                    raycast={
                                        () => {}
                                    }

                                >

                                    <boxGeometry

                                        args={[
                                            WINDOW_CASING_WIDTH,
                                            height,
                                            WINDOW_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/* BOTTOM */}

                                <mesh

                                    position={[
                                        0,
                                        bottomY,
                                        z
                                    ]}

                                    castShadow

                                    receiveShadow

                                    raycast={
                                        () => {}
                                    }

                                >

                                    <boxGeometry

                                        args={[
                                            horizontalWidth,
                                            WINDOW_CASING_WIDTH,
                                            WINDOW_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/* TOP */}

                                <mesh

                                    position={[
                                        0,
                                        topY,
                                        z
                                    ]}

                                    castShadow

                                    receiveShadow

                                    raycast={
                                        () => {}
                                    }

                                >

                                    <boxGeometry

                                        args={[
                                            horizontalWidth,
                                            WINDOW_CASING_WIDTH,
                                            WINDOW_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            WINDOW_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>

                            </group>

                        );

                    }
                )
            }

        </group>

    );

}


//==================================================
// NORMALIZE WINDOW MODEL
//==================================================

function normalizeWindowModel(
    source:
        Group,

    asset:
        Asset
): Group {

    const model =
        source.clone(
            true
        );


    const scale =
        asset.scale ??
        1;


    model.scale.set(
        scale,
        scale,
        scale
    );


    model.updateMatrixWorld(
        true
    );


    const box =
        new Box3()
            .setFromObject(
                model
            );


    const center =
        new Vector3();


    box.getCenter(
        center
    );


    model.position.x -=
        center.x;

    model.position.y -=
        center.y;

    model.position.z -=
        center.z;


    model.updateMatrixWorld(
        true
    );


    return model;

}


//==================================================
// ADMIN WINDOW
//==================================================

export default function AdminWindow({
    window,
    asset,
    wallThickness
}: AdminWindowProps) {

    if (
        typeof asset.model !==
            "string" ||
        asset.model.trim() === ""
    ) {

        console.warn(
            "Admin window has no valid model URL:",
            window.assetId
        );

        return null;

    }


    return (

        <AdminWindowModel

            window={
                window
            }

            asset={
                asset
            }

            wallThickness={
                wallThickness
            }

        />

    );

}


//==================================================
// WINDOW MODEL
//==================================================

function AdminWindowModel({
    window,
    asset,
    wallThickness
}: AdminWindowProps) {

    const {
        scene
    } = useGLTF(
        asset.model
    );


    const model =
        useMemo(() => {

            const normalized =
                normalizeWindowModel(
                    scene,
                    asset
                );


            normalized.traverse(
                child => {

                    child.userData = {

                        ...child.userData,

                        windowId:
                            window.id

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

                        } else if (
                            child.material
                        ) {

                            child.material =
                                child.material.clone();

                        }


                        const materials =
                            Array.isArray(
                                child.material
                            )
                                ? child.material
                                : [
                                    child.material
                                ];


                        const hasGlass =
                            materials.some(
                                material =>
                                    material.transparent ||
                                    (
                                        typeof material.opacity ===
                                        "number" &&
                                        material.opacity <
                                        0.95
                                    )
                            );


                        child.castShadow =
                            !hasGlass;

                        child.receiveShadow =
                            true;

                    }

                }
            );


            return normalized;

        }, [
            scene,
            asset,
            window.id
        ]);


    const finalRotationY =
        window.rotationY +
        (
            asset.rotationOffsetY ??
            0
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
                finalRotationY,
                0
            ]}

            userData={{
                windowId:
                    window.id
            }}

        >

            <WindowCasing

                windowId={
                    window.id
                }

                width={
                    window.width
                }

                height={
                    window.height
                }

                wallThickness={
                    wallThickness
                }

            />


            <primitive
                object={
                    model
                }
            />

        </group>

    );

}