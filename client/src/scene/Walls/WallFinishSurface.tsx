import {
    useMemo
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

import {
    MaterialLibrary
} from "../../engine/materials/MaterialLibrary";

import type {
    WallFinishSide
} from "./WallFinishUtils";

interface Props {

    piece: WallPiece;

    finish: WallFinishSide;
}

const FINISH_THICKNESS = 0.004;

const FINISH_GAP = 0.002;

const DEFAULT_TEXTURE =
    "/uploads/materials/walls/white-paint.jpg";

export default function WallFinishSurface({
    piece,
    finish
}: Props) {

    //--------------------------------------------------
    // Find selected material
    //--------------------------------------------------

    const material =
        MaterialLibrary.find(
            item =>
                item.id ===
                    finish.materialId &&

                item.category ===
                    "wallFinish"
        );

    //--------------------------------------------------
    // Always provide a texture URL so the hook is
    // called in the same order every render.
    //--------------------------------------------------

    const textureUrl =
        material?.texture ??
        DEFAULT_TEXTURE;

    const texture =
        useTexture(
            textureUrl
        );

    //--------------------------------------------------
    // Configure texture only when needed.
    //
    // Paint materials simply won't use it.
    //--------------------------------------------------

    useMemo(() => {

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

    //--------------------------------------------------
    // No material
    //--------------------------------------------------

    if (!material) {
        return null;
    }

    //--------------------------------------------------
    // Wall normal
    //--------------------------------------------------

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

    //--------------------------------------------------
    // Finish position
    //--------------------------------------------------

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

    //--------------------------------------------------
    // ARCH GEOMETRY
    //--------------------------------------------------

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
                openingWidth * 0.5;

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

            const segments = 24;

            for (
                let i = segments;
                i >= 0;
                i--
            ) {

                const angle =
                    Math.PI *
                    (i / segments);

                const x =
                    Math.cos(angle) *
                    radius;

                const y =
                    openingHeight +
                    Math.sin(angle) *
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

    //--------------------------------------------------
    // Material
    //--------------------------------------------------

    const finishMaterial =
        useMemo(() => {

            const isPaint =
                Boolean(
                    material.color
                );

            return new MeshStandardMaterial({

                //--------------------------------------------------
                // Only use texture for actual textured materials
                //--------------------------------------------------

                map:
                    isPaint
                        ? undefined
                        : texture,

                //--------------------------------------------------
                // Paint color / fallback
                //--------------------------------------------------

                color:
                    material.color ??
                    "#FFFFFF",

                roughness:
                    isPaint
                        ? 0.92
                        : 0.85,

                metalness:
                    0,

                polygonOffset:
                    true,

                polygonOffsetFactor:
                    -1,

                polygonOffsetUnits:
                    -1

            });

        }, [
            material.color,
            texture
        ]);

    //--------------------------------------------------
    // ARCH
    //--------------------------------------------------

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

                material={
                    finishMaterial
                }

            />

        );
    }

    //--------------------------------------------------
    // NORMAL WALL
    //--------------------------------------------------

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