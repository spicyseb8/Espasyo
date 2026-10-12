import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    ExtrudeGeometry,
    MeshStandardMaterial,
    RepeatWrapping,
    Shape,
    Texture,
    TextureLoader,
    Vector3
} from "three";

import type {
    Material
} from "../materials/MaterialTypes";

import {
    findCachedWallMaterial,
    getWallMaterials
} from "../../../../services/assets/wallsload";

import type {
    AdminWallFinishSide
} from "../../loader-components/AdminCommentTargetUtils";

import type {
    AdminWallPieceData
} from "./AdminWallMeshBuilder";


interface AdminWallFinishSurfaceProps {

    piece:
        AdminWallPieceData;

    finish:
        AdminWallFinishSide;

}


const FINISH_THICKNESS =
    0.004;

const FINISH_GAP =
    0.002;


const DEFAULT_COLOR =
    "#FFFFFF";


function useWallTexture(
    url:
        string | undefined,
    width:
        number,
    height:
        number
): Texture | null {

    const [
        texture,
        setTexture
    ] = useState<Texture | null>(
        null
    );


    useEffect(() => {

        if (!url) {

            setTexture(null);

            return;

        }


        let cancelled =
            false;


        const loader =
            new TextureLoader();


        loader.load(

            url,

            loadedTexture => {

                if (cancelled) {

                    return;

                }


                loadedTexture.wrapS =
                    RepeatWrapping;

                loadedTexture.wrapT =
                    RepeatWrapping;


                loadedTexture.repeat.set(

                    Math.max(
                        1,
                        width
                    ),

                    Math.max(
                        1,
                        height
                    )

                );


                loadedTexture.needsUpdate =
                    true;


                setTexture(
                    loadedTexture
                );

            },

            undefined,

            error => {

                console.error(
                    "Failed to load admin wall finish texture:",
                    url,
                    error
                );


                if (!cancelled) {

                    setTexture(null);

                }

            }

        );


        return () => {

            cancelled =
                true;

        };

    }, [
        url,
        width,
        height
    ]);


    return texture;

}


export default function AdminWallFinishSurface({
    piece,
    finish
}: AdminWallFinishSurfaceProps) {

    const [
        material,
        setMaterial
    ] = useState<Material | null>(() =>
        findCachedWallMaterial(
            finish.materialId
        ) ?? null
    );


    useEffect(() => {

        let cancelled =
            false;


        async function loadMaterial() {

            try {

                const materials =
                    await getWallMaterials();


                if (cancelled) {

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
                    "Failed to load admin wall material:",
                    error
                );


                if (!cancelled) {

                    setMaterial(null);

                }

            }

        }


        void loadMaterial();


        return () => {

            cancelled =
                true;

        };

    }, [
        finish.materialId
    ]);


    const texture =
        useWallTexture(

            material?.texture,

            piece.width,

            piece.height

        );


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

                -openingWidth * 0.5,

                openingHeight

            );


            shape.lineTo(

                -openingWidth * 0.5,

                piece.height

            );


            shape.lineTo(

                openingWidth * 0.5,

                piece.height

            );


            shape.lineTo(

                openingWidth * 0.5,

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
            piece
        ]);


    const finishMaterial =
        useMemo(() => {

            return new MeshStandardMaterial({

                map:
                    texture ??
                    undefined,

                color:
                    material?.color ??
                    DEFAULT_COLOR,

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


    useEffect(() => {

        return () => {

            finishMaterial.dispose();

        };

    }, [
        finishMaterial
    ]);


    if (!material) {

        return null;

    }


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
                    isWallFinish:
                        true
                }}

                castShadow={
                    false
                }

                receiveShadow

                raycast={() => {}}

                material={
                    finishMaterial
                }

            />

        );

    }


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
                isWallFinish:
                    true
            }}

            castShadow={
                false
            }

            receiveShadow

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