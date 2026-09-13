import {
    memo,
    useMemo,
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

import {
    solveRegions
} from "../../engine/regions/RegionSolver";


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


    //==================================================
    // REGIONS
    //==================================================

    const regions =
        useMemo(
            () =>
                solveRegions(
                    state.corners,
                    state.walls
                ),
            [
                state.corners,
                state.walls
            ]
        );


    //==================================================
    // SELECTED WALL
    //==================================================

    const selected =
        state.selectedWallId ===
        wallId;


    //==================================================
    // WALKTHROUGH
    //==================================================

    const walkthroughMode =
        state.walkthroughMode;


    //==================================================
    // VISUAL STATES
    //==================================================

    const showHovered =
        hovered &&
        !walkthroughMode;


    const showSelected =
        selected &&
        !walkthroughMode;


    //==================================================
    // FIND REGION FOR THIS WALL
    //==================================================
    //
    // Priority:
    //
    // 1. Keep the currently selected room if this wall
    //    belongs to it.
    //
    // 2. Otherwise use the first room containing
    //    this wall.
    //
    // This is especially useful for shared walls because
    // clicking a room first determines which side of the
    // shared wall the user is working on.
    //==================================================

    const getRegionForWall =
        () => {

            //--------------------------------------------------
            // Currently selected room
            //--------------------------------------------------

            if (
                state.selectedRegionId
            ) {

                const selectedRegion =
                    regions.find(
                        region =>
                            region.id ===
                            state.selectedRegionId
                    );

                if (
                    selectedRegion &&
                    selectedRegion.walls.some(
                        wall =>
                            wall.id ===
                            wallId
                    )
                ) {

                    return selectedRegion;
                }
            }

            //--------------------------------------------------
            // No suitable selected room.
            //
            // Find the first region containing this wall.
            //--------------------------------------------------

            return (
                regions.find(
                    region =>
                        region.walls.some(
                            wall =>
                                wall.id ===
                                wallId
                        )
                ) ?? null
            );
        };


    //==================================================
    // WALL CLICK
    //==================================================

    const handleWallClick =
        (
            e: any
        ) => {

            if (
                walkthroughMode
            ) {

                return;
            }

            e.stopPropagation();

            //--------------------------------------------------
            // Find the room this wall belongs to.
            //--------------------------------------------------

            const region =
                getRegionForWall();

            //--------------------------------------------------
            // Select room first.
            //
            // This guarantees DesignPanel has a valid
            // selectedRegionId.
            //--------------------------------------------------

            if (
                region
            ) {

                dispatch({

                    type:
                        "SELECT_REGION",

                    payload:
                        region.id

                });

            }

            //--------------------------------------------------
            // Then select the wall.
            //--------------------------------------------------

            dispatch({

                type:
                    "SELECT_WALL",

                payload:
                    wallId

            });
        };


    //==================================================
    // WALL HOVER
    //==================================================

    const handlePointerOver =
        (
            e: any
        ) => {

            if (
                walkthroughMode
            ) {

                return;
            }

            e.stopPropagation();

            setHovered(
                true
            );
        };


    const handlePointerOut =
        () => {

            if (
                walkthroughMode
            ) {

                return;
            }

            setHovered(
                false
            );
        };


    //==================================================
    // ARCH
    //==================================================

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

                {/* ==========================================
                    ACTUAL WALL
                ========================================== */}

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

                    castShadow

                    receiveShadow

                    onPointerOver={
                        handlePointerOver
                    }

                    onPointerOut={
                        handlePointerOut
                    }

                    onClick={
                        handleWallClick
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


                {/* ==========================================
                    INTERIOR WALL FINISH
                ========================================== */}

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


    //==================================================
    // NORMAL WALL
    //==================================================

    return (

        <group>

            {/* ==========================================
                ACTUAL WALL
            ========================================== */}

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

                castShadow

                receiveShadow

                onPointerOver={
                    handlePointerOver
                }

                onPointerOut={
                    handlePointerOut
                }

                onClick={
                    handleWallClick
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


            {/* ==========================================
                INTERIOR WALL FINISH
            ========================================== */}

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