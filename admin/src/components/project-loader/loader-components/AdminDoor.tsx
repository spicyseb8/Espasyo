import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import {
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";

import type {
    Asset
} from "../engine/assets/Asset";

import type {
    SavedDoor
} from "../ProjectTypes";


interface AdminDoorProps {

    door:
        SavedDoor;

    asset:
        Asset;

    wallThickness:
        number;

}


//==================================================
// CASING SETTINGS
//==================================================

const DOOR_CASING_WIDTH =
    0.075;

const DOOR_CASING_DEPTH =
    0.028;

const DOOR_CASING_GAP =
    0.004;

const DOOR_CASING_COLOR =
    "#E9E5DE";


//==================================================
// DOOR CASING
//==================================================

function DoorCasing({
    doorId,
    width,
    height,
    wallThickness
}: {
    doorId:
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

        DOOR_CASING_DEPTH *
        0.5 +

        DOOR_CASING_GAP;


    const leftX =
        -(
            width * 0.5 +
            DOOR_CASING_WIDTH * 0.5
        );


    const rightX =
        width * 0.5 +
        DOOR_CASING_WIDTH * 0.5;


    const verticalY =
        height * 0.5;


    const headY =
        height +
        DOOR_CASING_WIDTH * 0.5;


    const headWidth =
        width +
        DOOR_CASING_WIDTH * 2;


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
                                    `admin-door-casing-${doorId}-${side}`
                                }

                            >

                                {/* LEFT JAMB */}

                                <mesh

                                    position={[
                                        leftX,
                                        verticalY,
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
                                            DOOR_CASING_WIDTH,
                                            height,
                                            DOOR_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            DOOR_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/* RIGHT JAMB */}

                                <mesh

                                    position={[
                                        rightX,
                                        verticalY,
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
                                            DOOR_CASING_WIDTH,
                                            height,
                                            DOOR_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            DOOR_CASING_COLOR
                                        }

                                        roughness={
                                            0.78
                                        }

                                        metalness={
                                            0
                                        }

                                    />

                                </mesh>


                                {/* HEAD */}

                                <mesh

                                    position={[
                                        0,
                                        headY,
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
                                            headWidth,
                                            DOOR_CASING_WIDTH,
                                            DOOR_CASING_DEPTH
                                        ]}

                                    />

                                    <meshStandardMaterial

                                        color={
                                            DOOR_CASING_COLOR
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
// ADMIN DOOR
//==================================================

export default function AdminDoor({
    door,
    asset,
    wallThickness
}: AdminDoorProps) {

    if (
        typeof asset.model !==
            "string" ||
        asset.model.trim() === ""
    ) {

        console.warn(
            "Admin door has no valid model URL:",
            door.assetId
        );

        return null;

    }


    return (

        <AdminDoorModel

            door={
                door
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
// DOOR MODEL
//==================================================

function AdminDoorModel({
    door,
    asset,
    wallThickness
}: AdminDoorProps) {

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


            const scale =
                asset.scale ??
                1;


            clone.scale.set(
                scale,
                scale,
                scale
            );


            clone.traverse(
                child => {

                    child.userData = {

                        ...child.userData,

                        doorId:
                            door.id

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
            asset.scale,
            door.id
        ]);


    const rotationOffsetY =
        asset.rotationOffsetY ??
        Math.PI / 2;


    const finalRotationY =
        door.rotationY +
        rotationOffsetY;


    return (

        <group

            position={[
                door.position.x,
                door.position.y,
                door.position.z
            ]}

            rotation={[
                0,
                finalRotationY,
                0
            ]}

            userData={{
                doorId:
                    door.id
            }}

        >

            <DoorCasing

                doorId={
                    door.id
                }

                width={
                    door.width
                }

                height={
                    door.height
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