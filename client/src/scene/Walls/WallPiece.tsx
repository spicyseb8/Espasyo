import {
    memo,
    useState
} from "react";

import {
    ExtrudeGeometry,
    Shape
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import type {
    WallPiece as WallPieceType
} from "../../engine/walls/WallPiece";

import WallFinishSurface
    from "./WallFinishSurface";

import type {
    WallFinishSide
} from "./WallFinishUtils";


interface Props {

    wallId: string;

    piece: WallPieceType;

    finishSides?: WallFinishSide[];

}


function WallPiece({

    wallId,

    piece,

    finishSides = []

}: Props) {

    const {
        state,
        dispatch
    } = useEditor();


    const [
        hovered,
        setHovered
    ] = useState(false);


    const selected =
        state.selectedWallId === wallId;


    //--------------------------------------------------
    // Walkthrough state
    //--------------------------------------------------

    const walkthroughMode =
        state.walkthroughMode;


    //--------------------------------------------------
    // During walkthrough:
    //
    // - Ignore hover
    // - Ignore selection
    // - Show normal wall color
    //--------------------------------------------------

    const showHovered =
        hovered &&
        !walkthroughMode;


    const showSelected =
        selected &&
        !walkthroughMode;


    // ==================================================
    // ARCH
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
                        piece.thickness,

                    bevelEnabled:
                        false,

                    steps:
                        1

                }
            );


        geometry.center();


        return (

            <group>

                {/* ------------------------------------------
                    Actual wall
                ------------------------------------------ */}

                <mesh

                    geometry={
                        geometry
                    }

                    position={
                        piece.position
                    }

                    rotation={[
                        0,
                        -piece.rotationY,
                        0
                    ]}

                    userData={{
                        wallId
                    }}

                    onPointerOver={
                        walkthroughMode
                            ? undefined
                            : (e) => {

                                e.stopPropagation();

                                setHovered(
                                    true
                                );

                            }
                    }

                    onPointerOut={
                        walkthroughMode
                            ? undefined
                            : () => {

                                setHovered(
                                    false
                                );

                            }
                    }

                    onClick={
                        walkthroughMode
                            ? undefined
                            : (e) => {

                                e.stopPropagation();

                                dispatch({

                                    type:
                                        "SELECT_WALL",

                                    payload:
                                        wallId

                                });

                            }
                    }

                >

                    <meshStandardMaterial

                        color={

                            showSelected

                                ? "#2196F3"

                                : showHovered

                                ? "#8CC8FF"

                                : "#D9D9D9"

                        }

                    />

                </mesh>


                {/* ------------------------------------------
                    Interior wall finish
                ------------------------------------------ */}

                {
                    finishSides.map(
                        finish => (

                            <WallFinishSurface

                                key={
                                    `${finish.regionId}-${finish.wallId}-arch`
                                }

                                piece={
                                    piece
                                }

                                finish={
                                    finish
                                }

                            />

                        )
                    )
                }

            </group>

        );

    }


    // ==================================================
    // NORMAL WALL
    // ==================================================

    return (

        <group>

            {/* ------------------------------------------
                Actual wall
            ------------------------------------------ */}

            <mesh

                position={
                    piece.position
                }

                rotation={[
                    0,
                    -piece.rotationY,
                    0
                ]}

                userData={{
                    wallId
                }}

                onPointerOver={
                    walkthroughMode
                        ? undefined
                        : (e) => {

                            e.stopPropagation();

                            setHovered(
                                true
                            );

                        }
                }

                onPointerOut={
                    walkthroughMode
                        ? undefined
                        : () => {

                            setHovered(
                                false
                            );

                        }
                }

                onClick={
                    walkthroughMode
                        ? undefined
                        : (e) => {

                            e.stopPropagation();

                            dispatch({

                                type:
                                    "SELECT_WALL",

                                payload:
                                    wallId

                            });

                        }
                }

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

                        showSelected

                            ? "#2196F3"

                            : showHovered

                            ? "#8CC8FF"

                            : "#D9D9D9"

                    }

                />

            </mesh>


            {/* ------------------------------------------
                Interior wall finish
            ------------------------------------------ */}

            {
                finishSides.map(
                    finish => (

                        <WallFinishSurface

                            key={
                                `${finish.regionId}-${finish.wallId}`
                            }

                            piece={
                                piece
                            }

                            finish={
                                finish
                            }

                        />

                    )
                )
            }

        </group>

    );

}


export default memo(
    WallPiece
);