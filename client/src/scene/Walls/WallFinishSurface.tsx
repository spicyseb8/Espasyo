import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useTexture
} from "@react-three/drei";

import {
    ExtrudeGeometry,
    MeshStandardMaterial,
    RepeatWrapping,
    Shape,
    Vector3
} from "three";

import type {
    WallPiece
} from "../../engine/walls/WallPiece";

import type {
    Material
} from "../../engine/materials/MaterialTypes";

import {
    findCachedWallMaterial,
    getWallMaterials
} from "../../assets/walls";

import type {
    WallFinishSide
} from "./WallFinishUtils";


interface Props {

    piece:
        WallPiece;

    finish:
        WallFinishSide;
}


const FINISH_THICKNESS =
    0.004;


const FINISH_GAP =
    0.002;


const DEFAULT_TEXTURE =
    "/uploads/materials/walls/white-paint.jpg";


export default function WallFinishSurface({
    piece,
    finish
}: Props) {

    //==================================================
    // MATERIAL
    //==================================================

    const [
        material,
        setMaterial
    ] = useState<Material | null>(
        () =>
            findCachedWallMaterial(
                finish.materialId
            ) ?? null
    );


    //==================================================
    // LOAD WALL MATERIAL DATA
    //==================================================

    useEffect(() => {

        let cancelled =
            false;


        async function loadMaterial() {

            try {

                const materials =
                    await getWallMaterials();


                if (
                    cancelled
                ) {

                    return;
                }


                const found =
                    materials.find(
                        item =>
                            item.id ===
                            finish.materialId
                    ) ?? null;


                setMaterial(
                    found
                );

            } catch (error) {

                console.error(
                    "Failed to load wall material:",
                    error
                );


                if (
                    !cancelled
                ) {

                    setMaterial(
                        null
                    );

                }
            }
        }


        loadMaterial();


        return () => {

            cancelled =
                true;

        };

    }, [
        finish.materialId
    ]);


    //==================================================
    // TEXTURE
    //==================================================

    const textureUrl =
        material?.texture ??
        DEFAULT_TEXTURE;


    const texture =
        useTexture(
            textureUrl
        );


    //==================================================
    // CONFIGURE TEXTURE
    //==================================================

    useEffect(() => {

        texture.wrapS =
            RepeatWrapping;

        texture.wrapT =
            RepeatWrapping;

        texture.repeat.set(

            Math.max(
                1,
                piece.width
            ),

            Math.max(
                1,
                piece.height
            )

        );

        texture.needsUpdate =
            true;

    }, [
        texture,
        piece.width,
        piece.height
    ]);


    //==================================================
    // WALL NORMAL
    //==================================================

    const normal =
        useMemo(() => {

            return new Vector3(

                -Math.sin(
                    piece.rotationY
                ),

                0,

                Math.cos(
                    piece.rotationY
                )

            ).normalize();

        }, [
            piece.rotationY
        ]);


    //==================================================
    // FINISH POSITION
    //==================================================

    const position =
        useMemo(() => {

            return piece.position
                .clone()
                .add(

                    normal
                        .clone()
                        .multiplyScalar(

                            finish.side *
                            (
                                piece.thickness *
                                0.5 +

                                FINISH_GAP +

                                FINISH_THICKNESS *
                                0.5
                            )

                        )

                );

        }, [
            piece.position,
            piece.thickness,
            finish.side,
            normal
        ]);


    //==================================================
    // ARCH GEOMETRY
    //==================================================

    const archGeometry =
        useMemo(() => {

            if (
                piece.kind !== "arch" ||
                !piece.arch
            ) {

                return null;
            }


            const openingWidth =
                piece.arch.openingWidth;


            const openingHeight =
                piece.arch.openingHeight;


            const radius =
                openingWidth *
                0.5;


            const shape =
                new Shape();


            shape.moveTo(
                -openingWidth *
                    0.5,

                openingHeight
            );


            shape.lineTo(
                -openingWidth *
                    0.5,

                piece.height
            );


            shape.lineTo(
                openingWidth *
                    0.5,

                piece.height
            );


            shape.lineTo(
                openingWidth *
                    0.5,

                openingHeight
            );


            const segments =
                24;


            for (
                let i = segments;
                i >= 0;
                i--
            ) {

                const angle =
                    Math.PI *
                    (
                        i /
                        segments
                    );


                const x =
                    Math.cos(
                        angle
                    ) *
                    radius;


                const y =
                    openingHeight +
                    Math.sin(
                        angle
                    ) *
                    radius;


                shape.lineTo(
                    x,
                    y
                );
            }


            shape.closePath();


            const geometry =
                new ExtrudeGeometry(
                    shape,
                    {

                        depth:
                            FINISH_THICKNESS,

                        bevelEnabled:
                            false,

                        steps:
                            1

                    }
                );


            geometry.center();


            return geometry;

        }, [
            piece.kind,
            piece.arch,
            piece.height
        ]);


    //==================================================
    // MATERIAL
    //==================================================

    const finishMaterial =
        useMemo(() => {

            const hasTexture =
                Boolean(
                    material?.texture
                );


            return new MeshStandardMaterial({

                map:
                    hasTexture
                        ? texture
                        : undefined,

                color:
                    material?.color ??
                    "#FFFFFF",

                roughness:
                    material?.roughness ??
                    0.92,

                metalness:
                    material?.metalness ??
                    0,

                polygonOffset:
                    true,

                polygonOffsetFactor:
                    -1,

                polygonOffsetUnits:
                    -1

            });

        }, [
            material,
            texture
        ]);


    //==================================================
    // CLEANUP
    //==================================================

    useEffect(() => {

        return () => {

            finishMaterial.dispose();

        };

    }, [
        finishMaterial
    ]);


    //==================================================
    // WAITING FOR MATERIAL
    //==================================================

    if (
        !material
    ) {

        return null;
    }


    //==================================================
    // ARCH
    //==================================================

    if (
        piece.kind === "arch" &&
        archGeometry
    ) {

        return (

            <mesh

                geometry={
                    archGeometry
                }

                position={
                    position
                }

                rotation={[
                    0,
                    -piece.rotationY,
                    0
                ]}

                userData={{
                    isWallFinish: true
                }}

                castShadow={
                    false
                }

                receiveShadow

                //==================================================
                // IMPORTANT:
                // Wall finish should NOT capture mouse clicks.
                // This allows the actual WallPiece underneath to
                // receive the click.
                //==================================================

                raycast={() => {}}

                material={
                    finishMaterial
                }

            />

        );
    }


    //==================================================
    // NORMAL WALL
    //==================================================

    return (

        <mesh

            position={
                position
            }

            rotation={[
                0,
                -piece.rotationY,
                0
            ]}

            userData={{
                isWallFinish: true
            }}

            castShadow={
                false
            }

            receiveShadow

            //==================================================
            // IMPORTANT:
            // Wall finish should NOT capture mouse clicks.
            //==================================================

            raycast={() => {}}

            material={
                finishMaterial
            }

        >

            <boxGeometry

                args={[
                    piece.width,
                    piece.height,
                    FINISH_THICKNESS
                ]}

            />

        </mesh>
    );
}