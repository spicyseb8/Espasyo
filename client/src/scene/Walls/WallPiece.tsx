import { memo, useState } from "react";

import {
    ExtrudeGeometry,
    Shape
} from "three";

import useEditor from "../../context/editor/useEditor";

import type {
    WallPiece as WallPieceType
} from "../../engine/walls/WallPiece";

interface Props {

    wallId: string;

    piece: WallPieceType;

}

function WallPiece({

    wallId,

    piece

}: Props) {

    const { state, dispatch } = useEditor();

    const [hovered, setHovered] =
        useState(false);

    const selected =
        state.selectedWallId === wallId;


    // ==================================================
    // ARCH GEOMETRY
    // ==================================================

    if (
        piece.kind === "arch" &&
        piece.arch
    ) {

        const {

            openingWidth,

            openingHeight

        } = piece.arch;


        const radius =
            openingWidth * 0.5;


        /*
         * The arch is made from the wall material
         * ABOVE the opening.
         *
         * The opening itself is:
         *
         *       ______
         *     /        \
         *    /          \
         *   |            |
         *
         * So we create the area ABOVE that curve.
         */


        const shape =
            new Shape();


        // Start at bottom-left
        shape.moveTo(
            -openingWidth * 0.5,
            openingHeight
        );


        // Left side
        shape.lineTo(
            -openingWidth * 0.5,
            piece.height
        );


        // Top-left
        shape.lineTo(
            openingWidth * 0.5,
            piece.height
        );


        // Right side
        shape.lineTo(
            openingWidth * 0.5,
            openingHeight
        );


        // ----------------------------------------------
        // Curved underside
        // ----------------------------------------------

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
                    depth: piece.thickness,

                    bevelEnabled: false,

                    steps: 1
                }
            );


        geometry.center();


        return (

            <mesh

                geometry={geometry}

                position={piece.position}

                rotation={[
                    0,
                    -piece.rotationY,
                    0
                ]}

                userData={{
                    wallId
                }}

                onPointerOver={(e) => {

                    e.stopPropagation();

                    setHovered(true);

                }}

                onPointerOut={() => {

                    setHovered(false);

                }}

                onClick={(e) => {

                    e.stopPropagation();

                    dispatch({

                        type: "SELECT_WALL",

                        payload: wallId

                    });

                }}

            >

                <meshStandardMaterial

                    color={
                        selected
                            ? "#2196F3"
                            : hovered
                            ? "#8CC8FF"
                            : "#D9D9D9"
                    }

                />

            </mesh>

        );

    }


    // ==================================================
    // NORMAL RECTANGULAR WALL PIECE
    // ==================================================

    return (

        <mesh

            position={piece.position}

            rotation={[
                0,
                -piece.rotationY,
                0
            ]}

            userData={{
                wallId
            }}

            onPointerOver={(e) => {

                e.stopPropagation();

                setHovered(true);

            }}

            onPointerOut={() => {

                setHovered(false);

            }}

            onClick={(e) => {

                e.stopPropagation();

                dispatch({

                    type: "SELECT_WALL",

                    payload: wallId

                });

            }}

        >

            <boxGeometry

                args={[

                    piece.width,

                    piece.height,

                    piece.thickness

                ]}

            />

            <meshStandardMaterial

                color={

                    selected

                        ? "#2196F3"

                        : hovered

                        ? "#8CC8FF"

                        : "#D9D9D9"

                }

            />

        </mesh>

    );

}

export default memo(WallPiece);