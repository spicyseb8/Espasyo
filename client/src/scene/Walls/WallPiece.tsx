import { memo, useMemo, useState } from "react";
import { ExtrudeGeometry, Shape, Vector3 } from "three";
import useEditor from "../../context/editor/useEditor";
import type { WallPiece as WallPieceType } from "../../engine/walls/WallPiece";
import WallFinishSurface from "./WallFinishSurface";
import type { WallFinishSide } from "./WallFinishUtils";
import { solveRegions } from "../../engine/regions/RegionSolver";
import { getRegionWallSide } from "./WallFinishUtils";

interface Props {
    wallId: string;
    piece: WallPieceType;
    finishSides?: WallFinishSide[];
}

const WALL_TRIM_HEIGHT = 0.12;
const WALL_TRIM_DEPTH = 0.008;
const WALL_TRIM_CAP_HEIGHT = 0.018;
const WALL_TRIM_CAP_DEPTH = 0.012;
const WALL_TRIM_COLOR = "#E9E5DE";
const WALL_FINISH_OUTER_OFFSET = 0.007;

interface WallTrimProps {
    piece: WallPieceType;
    side: 1 | -1;
}

function WallTrim({
    piece,
    side
}: WallTrimProps) {
    if (piece.kind === "arch") {
        return null;
    }

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

    const halfThickness =
        piece.thickness * 0.5;

    const trimY =
        -piece.height * 0.5 +
        trimHeight * 0.5;

    const capY =
        -piece.height * 0.5 +
        trimHeight -
        capHeight * 0.5;

    const trimZ =
        side *
        (
            halfThickness +
            WALL_FINISH_OUTER_OFFSET -
            WALL_TRIM_DEPTH * 0.5
        );

    const capZ =
        side *
        (
            halfThickness +
            WALL_FINISH_OUTER_OFFSET +
            0.001 -
            WALL_TRIM_CAP_DEPTH * 0.5
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
            <mesh
                position={[
                    0,
                    trimY,
                    trimZ
                ]}
                castShadow
                receiveShadow
                raycast={() => null}
                renderOrder={3}
            >
                <boxGeometry
                    args={[
                        piece.width + 0.004,
                        trimHeight,
                        WALL_TRIM_DEPTH
                    ]}
                />
                <meshStandardMaterial
                    color={
                        WALL_TRIM_COLOR
                    }
                    roughness={0.82}
                    metalness={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                />
            </mesh>

            <mesh
                position={[
                    0,
                    capY,
                    capZ
                ]}
                castShadow
                receiveShadow
                raycast={() => null}
                renderOrder={4}
            >
                <boxGeometry
                    args={[
                        piece.width + 0.008,
                        capHeight,
                        WALL_TRIM_CAP_DEPTH
                    ]}
                />
                <meshStandardMaterial
                    color={
                        WALL_TRIM_COLOR
                    }
                    roughness={0.78}
                    metalness={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                />
            </mesh>
        </group>
    );
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

    const selected =
        state.selectedWallId ===
        wallId;

    const walkthroughMode =
        state.walkthroughMode;

    const showSelected =
        selected &&
        !walkthroughMode;

    const physicalWall =
        state.walls.find(
            wall =>
                wall.id ===
                wallId
        ) ?? null;

    const pieceBottom =
        piece.position.y -
        piece.height * 0.5;

    const touchesFloor =
        pieceBottom <= 0.02;

    const trimSides =
        useMemo(() => {
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
                const region of
                regions
            ) {
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
        }, [
            physicalWall,
            regions,
            wallId,
            touchesFloor
        ]);

    const getClickedWallSide =
        (
            clickPoint: Vector3
        ):
            1 | -1 | null => {
            if (
                !physicalWall
            ) {
                return null;
            }

            const start =
                physicalWall.start.position;

            const end =
                physicalWall.end.position;

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

            const normal =
                new Vector3(
                    -direction.z,
                    0,
                    direction.x
                ).normalize();

            const center =
                start
                    .clone()
                    .add(
                        direction
                            .clone()
                            .multiplyScalar(
                                length * 0.5
                            )
                    );

            const toClick =
                clickPoint
                    .clone()
                    .sub(
                        center
                    );

            const sideValue =
                toClick.x *
                    normal.x +
                toClick.z *
                    normal.z;

            if (
                Math.abs(
                    sideValue
                ) < 0.0001
            ) {
                return null;
            }

            return sideValue >
                0
                ? 1
                : -1;
        };

    const getRegionForWallClick =
        (
            clickPoint: Vector3
        ) => {
            if (
                !physicalWall
            ) {
                return null;
            }

            const clickedSide =
                getClickedWallSide(
                    clickPoint
                );

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

            if (
                !e.point
            ) {
                return;
            }

            const clickPoint =
                e.point.clone();

            const region =
                getRegionForWallClick(
                    clickPoint
                );

            if (
                !region
            ) {
                return;
            }

            dispatch({
                type:
                    "SELECT_REGION",
                payload:
                    region.id
            });

            dispatch({
                type:
                    "SELECT_WALL",
                payload:
                    wallId
            });
        };

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

    void hovered;

    const wallColor =
        showSelected
            ? "#2196F3"
            : "#D9D9D9";

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
                Math.cos(
                    angle
                ) * radius;

            const y =
                openingHeight +
                Math.sin(
                    angle
                ) * radius;

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