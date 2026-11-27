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
    Vector3
} from "three";

import type {
    Material
} from "../materials/MaterialTypes";

import {
    findCachedWallMaterial,
    getCachedWallTexture,
    getWallMaterials,
    preloadWallTexture
} from "../../../../services/assets/wallsload";
import {
    getCachedFloorPatternTexture,
    preloadFloorPatternTexture
} from "../../../../services/assets/floorsload";
import {
    createFloorPatternLayout,
    getFloorPatternCellSize,
    isFloorPattern
} from "../../../../../../shared/flooring/patterns";

import type {
    AdminWallFinishSide
} from "./AdminWallFinishUtils";

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
    material:
        Material | null,
    width:
        number,
    height:
        number
): Texture | null {

    const [
        loadedTexture,
        setTexture
    ] = useState<{
        url: string;
        texture: Texture;
    } | null>(
        null
    );

    const cachedTexture = getCachedWallTexture(url ?? "");
    const patternCellSize = useMemo(() => {
        if (
            material?.floorMaterialMode !== "single-tile" ||
            !isFloorPattern(material.floorPattern) ||
            typeof material.length !== "number" ||
            !Number.isFinite(material.length) ||
            material.length <= 0 ||
            typeof material.width !== "number" ||
            !Number.isFinite(material.width) ||
            material.width <= 0
        ) {
            return null;
        }

        return getFloorPatternCellSize(
            createFloorPatternLayout(
                material.floorPattern,
                material.length,
                material.width
            )
        );
    }, [material]);
    const cachedPatternTexture =
        url && patternCellSize && material
            ? getCachedFloorPatternTexture(url, material)
            : undefined;
    const readyTexture = useMemo(() => {
        const source = cachedPatternTexture ?? (
            patternCellSize ? undefined : cachedTexture
        );
        if (!source) {
            return null;
        }

        const texture = source.clone();
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        if (patternCellSize) {
            texture.repeat.set(
                width / patternCellSize.widthM,
                height / patternCellSize.heightM
            );
        } else {
            texture.repeat.set(
                Math.max(1, width),
                Math.max(1, height)
            );
        }
        texture.needsUpdate = true;
        return texture;
    }, [
        cachedPatternTexture,
        cachedTexture,
        patternCellSize,
        width,
        height
    ]);

    useEffect(() => {
        return () => readyTexture?.dispose();
    }, [readyTexture]);


    useEffect(() => {

        if (!url || readyTexture) {
            return;
        }


        let cancelled =
            false;
        let createdTexture: Texture | null = null;


        const texturePromise = patternCellSize && material
            ? preloadFloorPatternTexture(url, material)
            : preloadWallTexture(url);
        void texturePromise
            .then(async sourceTexture => {
                if (cancelled) {
                    return;
                }

                const patternGenerated = Boolean(sourceTexture && patternCellSize);
                const source = sourceTexture ??
                    await preloadWallTexture(url);
                if (cancelled) {
                    return;
                }
                createdTexture = source.clone();
                createdTexture.wrapS = RepeatWrapping;
                createdTexture.wrapT = RepeatWrapping;
                if (patternGenerated && patternCellSize) {
                    createdTexture.repeat.set(
                        width / patternCellSize.widthM,
                        height / patternCellSize.heightM
                    );
                } else if (
                    patternCellSize &&
                    material?.length &&
                    material.width
                ) {
                    createdTexture.repeat.set(
                        width / material.length,
                        height / material.width
                    );
                } else {
                    createdTexture.repeat.set(
                        Math.max(1, width),
                        Math.max(1, height)
                    );
                }
                createdTexture.needsUpdate = true;
                setTexture({
                    url,
                    texture: createdTexture
                });
            })
            .catch(error => {
                console.error(
                    "Failed to load admin wall finish texture.",
                    {
                        error: error instanceof Error
                            ? error.name
                            : "TextureLoadError"
                    }
                );

                if (!cancelled) {
                    setTexture(null);
                }
            });


        return () => {

            cancelled =
                true;
            createdTexture?.dispose();

        };

    }, [
        url,
        width,
        height,
        readyTexture,
        material,
        patternCellSize
    ]);


    return readyTexture ?? (
        loadedTexture && loadedTexture.url === url
            ? loadedTexture.texture
            : null
    );

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

            material,

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

                ...(texture ? { map: texture } : {}),

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