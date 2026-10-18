
import {
    memo,
    useMemo,
    useState,
    useEffect
} from "react";

import type {
    ThreeEvent
} from "@react-three/fiber";

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

const WALL_TRIM_HEIGHT = 0.20;
const WALL_TRIM_DEPTH = 0.045;
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
    const trimHeight = Math.min(
        WALL_TRIM_HEIGHT,
        Math.max(0.02, piece.height * 0.25)
    );

    const profileScale =
        trimHeight / WALL_TRIM_HEIGHT;

    const baseY =
        -piece.height * 0.5;

    const trimLength =
        piece.width + 0.008;

    const mountZ =
        side * (
            piece.thickness * 0.5 +
            WALL_FINISH_OUTER_OFFSET
        );

    const geometry = useMemo(() => {
        const shape = new Shape();

        const profileDepth = (ratio: number) =>
            -side * WALL_TRIM_DEPTH * ratio * profileScale;

        const profileY = (height: number) =>
            baseY + height * profileScale;

        shape.moveTo(
            profileDepth(0),
            profileY(0)
        );

        shape.lineTo(
            profileDepth(0),
            profileY(WALL_TRIM_HEIGHT)
        );

        shape.lineTo(
            profileDepth(0.20),
            profileY(WALL_TRIM_HEIGHT)
        );

        shape.bezierCurveTo(
            profileDepth(0.35),
            profileY(0.20),
            profileDepth(0.48),
            profileY(0.194),
            profileDepth(0.48),
            profileY(0.182)
        );

        shape.bezierCurveTo(
            profileDepth(0.48),
            profileY(0.171),
            profileDepth(0.37),
            profileY(0.166),
            profileDepth(0.28),
            profileY(0.161)
        );

        shape.bezierCurveTo(
            profileDepth(0.23),
            profileY(0.157),
            profileDepth(0.24),
            profileY(0.149),
            profileDepth(0.34),
            profileY(0.145)
        );

        shape.bezierCurveTo(
            profileDepth(0.48),
            profileY(0.142),
            profileDepth(0.56),
            profileY(0.135),
            profileDepth(0.59),
            profileY(0.126)
        );

        shape.bezierCurveTo(
            profileDepth(0.63),
            profileY(0.115),
            profileDepth(0.78),
            profileY(0.110),
            profileDepth(0.90),
            profileY(0.095)
        );

        shape.bezierCurveTo(
            profileDepth(1.0),
            profileY(0.083),
            profileDepth(0.98),
            profileY(0.063),
            profileDepth(0.87),
            profileY(0.050)
        );

        shape.bezierCurveTo(
            profileDepth(0.78),
            profileY(0.040),
            profileDepth(0.68),
            profileY(0.036),
            profileDepth(0.72),
            profileY(0.027)
        );

        shape.lineTo(
            profileDepth(0.85),
            profileY(0.022)
        );

        shape.bezierCurveTo(
            profileDepth(0.88),
            profileY(0.012),
            profileDepth(0.81),
            profileY(0.004),
            profileDepth(0.65),
            profileY(0)
        );

        shape.lineTo(
            profileDepth(0),
            profileY(0)
        );

        shape.closePath();

        const result = new ExtrudeGeometry(
            shape,
            {
                depth: trimLength,
                bevelEnabled: false,
                steps: 1,
                curveSegments: 20
            }
        );

        result.rotateY(Math.PI / 2);

        result.translate(
            -trimLength * 0.5,
            0,
            mountZ
        );

        return result;
    }, [
        baseY,
        mountZ,
        profileScale,
        side,
        trimLength
    ]);

    useEffect(() => {
        return () => {
            geometry.dispose();
        };
    }, [geometry]);

    if (piece.kind === "arch") {
        return null;
    }

    return (
        <group
            position={piece.position}
            rotation={[
                0,
                -piece.rotationY,
                0
            ]}
        >
            <mesh
                geometry={geometry}
                castShadow
                receiveShadow
                raycast={() => null}
                renderOrder={3}
            >
                <meshStandardMaterial
                    color={WALL_TRIM_COLOR}
                    roughness={0.72}
                    metalness={0}
                    emissive="#8C8272"
                    emissiveIntensity={0.3}
                    toneMapped={false}
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

    const regions = useMemo(
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
        state.selectedWallId === wallId;

    const walkthroughMode =
        state.walkthroughMode;

    const showSelected =
        selected && !walkthroughMode;

    const physicalWall =
        state.walls.find(
            wall => wall.id === wallId
        ) ?? null;

    const pieceBottom =
        piece.position.y -
        piece.height * 0.5;

    const touchesFloor =
        pieceBottom <= 0.02;

    const trimSides = useMemo(() => {
        if (!physicalWall || !touchesFloor) {
            return [] as (1 | -1)[];
        }

        const sides = new Set<1 | -1>();

        for (const region of regions) {
            const belongsToRegion =
                region.walls.some(
                    regionWall =>
                        regionWall.id === wallId
                );

            if (!belongsToRegion) {
                continue;
            }

            const side = getRegionWallSide(
                physicalWall,
                region
            );

            if (side !== null) {
                sides.add(side);
            }
        }

        return Array.from(sides);
    }, [
        physicalWall,
        regions,
        wallId,
        touchesFloor
    ]);

    /**
     * Determines which physical face was clicked.
     *
     * +1 = normal side
     * -1 = opposite side
     *
     * This does not require the clicked side to belong to
     * an existing room region.
     */
    const getClickedWallSide = (
        clickPoint: Vector3
    ): 1 | -1 | null => {
        if (!physicalWall) {
            return null;
        }

        const start =
            physicalWall.start.position;

        const end =
            physicalWall.end.position;

        const direction =
            new Vector3().subVectors(
                end,
                start
            );

        const length =
            direction.length();

        if (length <= 0.001) {
            return null;
        }

        direction.normalize();

        const normal = new Vector3(
            -direction.z,
            0,
            direction.x
        ).normalize();

        const center = start.clone().add(
            direction.clone().multiplyScalar(
                length * 0.5
            )
        );

        const toClick =
            clickPoint.clone().sub(center);

        const sideValue =
            toClick.x * normal.x +
            toClick.z * normal.z;

        if (Math.abs(sideValue) < 0.0001) {
            return null;
        }

        return sideValue > 0 ? 1 : -1;
    };

    /**
     * Finds a room region only if it is on the face
     * that the user actually clicked.
     *
     * Returns null for an outside face with no room.
     * It never falls back to a room on the opposite side.
     */
    const getRegionForWallClick = (
        clickedSide: 1 | -1
    ) => {
        if (!physicalWall) {
            return null;
        }

        return (
            regions.find(region => {
                const belongsToRegion =
                    region.walls.some(
                        regionWall =>
                            regionWall.id === wallId
                    );

                if (!belongsToRegion) {
                    return false;
                }

                const regionSide =
                    getRegionWallSide(
                        physicalWall,
                        region
                    );

                return regionSide === clickedSide;
            }) ?? null
        );
    };

    const handleWallClick = (
        event: ThreeEvent<MouseEvent>
    ) => {
        if (state.walkthroughMode) {
            return;
        }

        event.stopPropagation();

        const clickPoint = event.point;

        const side =
            getClickedWallSide(clickPoint);

        if (side === null) {
            dispatch({
                type: "SELECT_WALL",
                payload: wallId
            });

            return;
        }

        const region =
            getRegionForWallClick(side);

        // Record the clicked side even when the outside
        // face does not belong to any room.
        dispatch({
            type: "SELECT_WALL_SIDE",
            payload: {
                wallId,
                regionId: region?.id ?? null,
                side
            }
        });
    };

    const handlePointerOver = (
        e: ThreeEvent<PointerEvent>
    ) => {
        if (walkthroughMode) {
            return;
        }

        e.stopPropagation();
        setHovered(true);
    };

    const handlePointerOut = () => {
        if (walkthroughMode) {
            return;
        }

        setHovered(false);
    };

    void hovered;

    const wallColor =
        showSelected
            ? "#2196F3"
            : "#D9D9D9";

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

        const shape = new Shape();

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
                Math.PI * (i / segments);

            const x =
                Math.cos(angle) * radius;

            const y =
                openingHeight +
                Math.sin(angle) * radius;

            shape.lineTo(x, y);
        }

        shape.closePath();

        const geometry = new ExtrudeGeometry(
            shape,
            {
                depth: piece.thickness,
                bevelEnabled: false,
                steps: 1
            }
        );

        geometry.center();

        return (
            <group>
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
                    castShadow
                    receiveShadow
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                    onClick={handleWallClick}
                >
                    <meshStandardMaterial
                        color={wallColor}
                    />
                </mesh>

                {finishSides.map(finish => (
                    <WallFinishSurface
                        key={`${finish.regionId}-${finish.wallId}-arch-${finish.side}`}
                        piece={piece}
                        finish={finish}
                    />
                ))}
            </group>
        );
    }

    return (
        <group>
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
                castShadow
                receiveShadow
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onClick={handleWallClick}
            >
                <boxGeometry
                    args={[
                        piece.width,
                        piece.height,
                        piece.thickness
                    ]}
                />

                <meshStandardMaterial
                    color={wallColor}
                />
            </mesh>

            {touchesFloor &&
                trimSides.map(side => (
                    <WallTrim
                        key={`${wallId}-${side}`}
                        piece={piece}
                        side={side}
                    />
                ))}

            {finishSides.map(finish => (
                <WallFinishSurface
                    key={`${finish.regionId}-${finish.wallId}-${finish.side}`}
                    piece={piece}
                    finish={finish}
                />
            ))}
        </group>
    );
}

export default memo(WallPiece);
