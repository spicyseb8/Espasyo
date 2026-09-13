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
    // GET PHYSICAL WALL
    //==================================================

    const physicalWall =
        state.walls.find(
            wall =>
                wall.id ===
                wallId
        ) ?? null;


    //==================================================
    // DETERMINE CLICKED WALL SIDE
    //==================================================
    //
    // A shared wall belongs to two rooms.
    //
    // We determine which physical side of the wall
    // the user clicked by comparing the pointer hit
    // point with the wall's center and normal.
    //
    // +1 = normal side
    // -1 = opposite side
    //==================================================

    const getClickedWallSide =
        (
            clickPoint: Vector3
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
            // Only use X/Z.
            //
            // Y is irrelevant because the wall has height.
            //--------------------------------------------------

            const sideValue =
                toClick.x *
                    normal.x +

                toClick.z *
                    normal.z;


            //--------------------------------------------------
            // The click may land very close to the center
            // because of geometry/raycast precision.
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
    //
    // This is the important part for shared walls.
    //==================================================

    const getRegionForWallClick =
        (
            clickPoint: Vector3
        ) => {

            if (
                !physicalWall
            ) {

                return null;
            }


            //--------------------------------------------------
            // Determine which side was clicked.
            //--------------------------------------------------

            const clickedSide =
                getClickedWallSide(
                    clickPoint
                );


            //--------------------------------------------------
            // If we can determine the side, find the
            // region whose interior faces that side.
            //--------------------------------------------------

            if (
                clickedSide !== null
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
            // Fallback:
            //
            // If the click is too close to the wall center,
            // preserve the currently selected room if it
            // owns this wall.
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
            // Final fallback for a wall belonging to only
            // one room.
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
                owningRegions.length === 1
            ) {

                return owningRegions[0];
            }


            //--------------------------------------------------
            // Shared wall but no reliable side detected.
            //
            // Don't guess.
            //--------------------------------------------------

            return null;
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
            // We need the actual raycast point.
            //--------------------------------------------------

            if (
                !e.point
            ) {

                return;
            }


            const clickPoint =
                e.point.clone();


            //--------------------------------------------------
            // Determine which room side was clicked.
            //--------------------------------------------------

            const region =
                getRegionForWallClick(
                    clickPoint
                );


            //--------------------------------------------------
            // If this is a shared wall and we couldn't
            // safely determine the side, don't switch
            // the selected room.
            //--------------------------------------------------

            if (
                !region
            ) {

                return;
            }


            //--------------------------------------------------
            // Select the room side first.
            //
            // This is what makes DesignPanel know which
            // side of the wall is being edited.
            //--------------------------------------------------

            dispatch({

                type:
                    "SELECT_REGION",

                payload:
                    region.id

            });


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