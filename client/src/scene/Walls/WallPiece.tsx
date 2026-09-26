import {
    memo,
    useMemo,
    useState
} from "react";

import {
    ExtrudeGeometry,
    Shape,
    Vector3
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

import {
    getRegionWallSide
} from "./WallFinishUtils";


//======================================================
// PROPS
//======================================================

interface Props {

    wallId:
        string;

    piece:
        WallPieceType;

    finishSides?:
        WallFinishSide[];

}


//======================================================
// DEFAULT WALL TRIM SETTINGS
//======================================================

const WALL_TRIM_HEIGHT =
    0.12;

const WALL_TRIM_DEPTH =
    0.018;

const WALL_TRIM_CAP_HEIGHT =
    0.018;

const WALL_TRIM_CAP_DEPTH =
    0.030;

const WALL_TRIM_COLOR =
    "#E9E5DE";


//======================================================
// WALL TRIM PROPS
//======================================================

interface WallTrimProps {

    piece:
        WallPieceType;

    side:
        1 | -1;

}


//======================================================
// WALL TRIM
//======================================================
//
// IMPORTANT:
//
// The trim is generated only for a wall piece that
// actually reaches the floor.
//
// This prevents trim from appearing at the bottom of
// upper wall pieces created around:
// 
// - doors
// - windows
// - openings
//
//======================================================

function WallTrim({

    piece,

    side

}: WallTrimProps) {

    //--------------------------------------------------
    // Arch pieces are not treated as floor-level
    // rectangular wall pieces.
    //--------------------------------------------------

    if (
        piece.kind ===
        "arch"
    ) {

        return null;

    }


    //--------------------------------------------------
    // Trim height
    //--------------------------------------------------

    const trimHeight =
        Math.min(

            WALL_TRIM_HEIGHT,

            Math.max(
                0.02,
                piece.height * 0.25
            )

        );


    const capHeight =
        Math.min(

            WALL_TRIM_CAP_HEIGHT,

            trimHeight * 0.35

        );


    //--------------------------------------------------
    // Local wall coordinates
    //
    // X = along wall
    // Y = vertical
    // Z = wall thickness
    //--------------------------------------------------

    const halfThickness =
        piece.thickness *
        0.5;


    //--------------------------------------------------
    // Main baseboard vertical position
    //--------------------------------------------------

    const trimY =

        -piece.height *
            0.5 +

        trimHeight *
            0.5;


    //--------------------------------------------------
    // Small cap above baseboard
    //--------------------------------------------------

    const capY =

        -piece.height *
            0.5 +

        trimHeight -

        capHeight *
            0.5;


    //--------------------------------------------------
    // Positive side = +Z
    // Negative side = -Z
    //--------------------------------------------------

    const trimZ =

        side *
        (
            halfThickness +
            WALL_TRIM_DEPTH *
            0.5
        );


    const capZ =

        side *
        (
            halfThickness +
            WALL_TRIM_CAP_DEPTH *
            0.5
        );


    return (

        <group

            position={
                piece.position
            }

            rotation={[

                0,

                -piece.rotationY,

                0

            ]}

        >

            {/*==================================================
                MAIN BASEBOARD
            ==================================================*/}

            <mesh

                position={[

                    0,

                    trimY,

                    trimZ

                ]}

                castShadow

                receiveShadow

                raycast={
                    () => null
                }

            >

                <boxGeometry

                    args={[

                        piece.width +
                            0.004,

                        trimHeight,

                        WALL_TRIM_DEPTH

                    ]}

                />

                <meshStandardMaterial

                    color={
                        WALL_TRIM_COLOR
                    }

                    roughness={
                        0.82
                    }

                    metalness={
                        0
                    }

                />

            </mesh>


            {/*==================================================
                SMALL TOP CAP
            ==================================================*/}

            <mesh

                position={[

                    0,

                    capY,

                    capZ

                ]}

                castShadow

                receiveShadow

                raycast={
                    () => null
                }

            >

                <boxGeometry

                    args={[

                        piece.width +
                            0.008,

                        capHeight,

                        WALL_TRIM_CAP_DEPTH

                    ]}

                />

                <meshStandardMaterial

                    color={
                        WALL_TRIM_COLOR
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


//======================================================
// WALL PIECE
//======================================================

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
    ] = useState(
        false
    );


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
    // GET PHYSICAL WALL
    //==================================================

    const physicalWall =

        state.walls.find(

            wall =>

                wall.id ===
                wallId

        ) ?? null;


    //==================================================
    // DETERMINE WHETHER THIS PIECE TOUCHES FLOOR
    //==================================================
    //
    // WallPiece positions are centered vertically.
    //
    // Therefore:
    //
    // bottom =
    //     piece.position.y
    //     - piece.height / 2
    //
    // A normal floor-level wall will have a bottom
    // very close to Y = 0.
    //
    // Upper pieces created above:
    //
    // - doors
    // - windows
    // - openings
    //
    // will have a bottom greater than 0.
    //
    // Those pieces MUST NOT receive a baseboard.
    //==================================================

    const pieceBottom =

        piece.position.y -

        piece.height *
        0.5;


    const touchesFloor =

        pieceBottom <=
            0.02;


    //==================================================
    // DETERMINE WHICH SIDES NEED TRIM
    //==================================================
    //
    // Trim follows the room-facing side of the wall.
    //
    // Single room wall:
    //     one side
    //
    // Shared wall:
    //     two sides
    //
    //==================================================

    const trimSides =

        useMemo(

            () => {

                if (
                    !physicalWall ||
                    !touchesFloor
                ) {

                    return [] as (
                        1 | -1
                    )[];

                }


                const sides =
                    new Set<
                        1 | -1
                    >();


                for (
                    const region
                    of regions
                ) {

                    //--------------------------------------------------
                    // Is this wall part of this region?
                    //--------------------------------------------------

                    const belongsToRegion =

                        region.walls.some(

                            regionWall =>

                                regionWall.id ===
                                wallId

                        );


                    if (
                        !belongsToRegion
                    ) {

                        continue;

                    }


                    //--------------------------------------------------
                    // Which physical side faces the room?
                    //--------------------------------------------------

                    const side =

                        getRegionWallSide(

                            physicalWall,

                            region

                        );


                    if (
                        side !==
                        null
                    ) {

                        sides.add(
                            side
                        );

                    }

                }


                return Array.from(
                    sides
                );

            },

            [

                physicalWall,

                regions,

                wallId,

                touchesFloor

            ]

        );


    //==================================================
    // DETERMINE CLICKED WALL SIDE
    //==================================================

    const getClickedWallSide =

        (

            clickPoint:
                Vector3

        ): 1 | -1 | null => {


            if (
                !physicalWall
            ) {

                return null;

            }


            const start =

                physicalWall.start.position;


            const end =

                physicalWall.end.position;


            //--------------------------------------------------
            // Wall direction
            //--------------------------------------------------

            const direction =

                new Vector3()

                    .subVectors(

                        end,

                        start

                    );


            const length =

                direction.length();


            if (
                length <=
                0.001
            ) {

                return null;

            }


            direction.normalize();


            //--------------------------------------------------
            // Same normal convention used by
            // getRegionWallSide().
            //--------------------------------------------------

            const normal =

                new Vector3(

                    -direction.z,

                    0,

                    direction.x

                ).normalize();


            //--------------------------------------------------
            // Wall center
            //--------------------------------------------------

            const center =

                start.clone()

                    .add(

                        direction

                            .clone()

                            .multiplyScalar(

                                length * 0.5

                            )

                    );


            //--------------------------------------------------
            // Vector from wall center to click point
            //--------------------------------------------------

            const toClick =

                clickPoint

                    .clone()

                    .sub(

                        center

                    );


            //--------------------------------------------------
            // Only use X/Z
            //--------------------------------------------------

            const sideValue =

                toClick.x *

                    normal.x +

                toClick.z *

                    normal.z;


            //--------------------------------------------------
            // Click too close to center
            //--------------------------------------------------

            if (

                Math.abs(

                    sideValue

                ) < 0.0001

            ) {

                return null;

            }


            return sideValue > 0

                ? 1

                : -1;

        };


    //==================================================
    // FIND REGION FOR CLICKED SIDE
    //==================================================

    const getRegionForWallClick =

        (

            clickPoint:
                Vector3

        ) => {


            if (
                !physicalWall
            ) {

                return null;

            }


            //--------------------------------------------------
            // Determine clicked side
            //--------------------------------------------------

            const clickedSide =

                getClickedWallSide(

                    clickPoint

                );


            //--------------------------------------------------
            // Find matching room side
            //--------------------------------------------------

            if (
                clickedSide !==
                null
            ) {

                const matchingRegion =

                    regions.find(

                        region => {


                            const belongsToRegion =

                                region.walls.some(

                                    regionWall =>

                                        regionWall.id ===
                                        wallId

                                );


                            if (
                                !belongsToRegion
                            ) {

                                return false;

                            }


                            const regionSide =

                                getRegionWallSide(

                                    physicalWall,

                                    region

                                );


                            return (

                                regionSide ===
                                clickedSide

                            );

                        }

                    );


                if (
                    matchingRegion
                ) {

                    return matchingRegion;

                }

            }


            //--------------------------------------------------
            // Fallback: selected room
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

                        regionWall =>

                            regionWall.id ===
                            wallId

                    )
                ) {

                    return selectedRegion;

                }

            }


            //--------------------------------------------------
            // Final fallback
            //--------------------------------------------------

            const owningRegions =

                regions.filter(

                    region =>

                        region.walls.some(

                            regionWall =>

                                regionWall.id ===
                                wallId

                        )

                );


            if (
                owningRegions.length ===
                1
            ) {

                return owningRegions[0];

            }


            return null;

        };


    //==================================================
    // WALL CLICK
    //==================================================

    const handleWallClick =

        (

            e:
                any

        ) => {


            if (
                walkthroughMode
            ) {

                return;

            }


            e.stopPropagation();


            //--------------------------------------------------
            // Need actual raycast point
            //--------------------------------------------------

            if (
                !e.point
            ) {

                return;

            }


            const clickPoint =

                e.point.clone();


            //--------------------------------------------------
            // Determine room side
            //--------------------------------------------------

            const region =

                getRegionForWallClick(

                    clickPoint

                );


            //--------------------------------------------------
            // Shared wall unresolved
            //--------------------------------------------------

            if (
                !region
            ) {

                return;

            }


            //--------------------------------------------------
            // Select room
            //--------------------------------------------------

            dispatch({

                type:
                    "SELECT_REGION",

                payload:
                    region.id

            });


            //--------------------------------------------------
            // Select wall
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

            e:
                any

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
    // COMMON MATERIAL COLOR
    //==================================================

    const wallColor =

        showSelected

            ? "#2196F3"

            : showHovered

            ? "#8CC8FF"

            : "#D9D9D9";


    //==================================================
    // ARCH WALL
    //==================================================

    if (

        piece.kind ===
            "arch" &&

        piece.arch

    ) {

        const {

            openingWidth,

            openingHeight

        } = piece.arch;


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

            let i =
                segments;

            i >=
            0;

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
                            wallColor
                        }

                    />

                </mesh>


                {/*==================================================
                    INTERIOR WALL FINISH
                ==================================================*/}

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
                        wallColor
                    }

                />

            </mesh>


            {/*==================================================
                DEFAULT WALL TRIM
                ==================================================
                
                IMPORTANT:

                Only floor-touching wall pieces receive
                the trim.

                Upper pieces above doors/windows/openings
                do NOT receive trim.
            ==================================================*/}

            {
                touchesFloor &&
                trimSides.map(

                    side => (

                        <WallTrim

                            key={

                                `${wallId}-${side}`

                            }

                            piece={
                                piece
                            }

                            side={
                                side
                            }

                        />

                    )

                )
            }


            {/*==================================================
                INTERIOR WALL FINISH
            ==================================================*/}

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