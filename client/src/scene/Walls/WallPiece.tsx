
import {
    memo,
    useEffect,
    useMemo,
    useState
} from "react";

import type {
    ThreeEvent
} from "@react-three/fiber";
import { Line } from "@react-three/drei";

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
} from "../../engine/walls/WallFinishUtils";

import {
    solveRegions
} from "../../engine/regions/RegionSolver";

import {
    getRegionWallSide
} from "../../engine/walls/WallFinishUtils";
import {
    addWallPaintSeparator,
    getWallPaintFaceKey,
    getWallPaintSectionAt,
    getWallPaintSections,
    isValidWallPaintSeparatorPosition,
    type WallPaintSection,
    type WallPaintSeparator
} from "../../../../shared/wallPaintSeparators";
import { getWallFinishSides } from "../../engine/walls/WallFinishUtils";

interface Props {
    wallId: string;
    piece: WallPieceType;
    finishSides?: WallFinishSide[];
}

const WALL_TRIM_HEIGHT = 0.20;
const WALL_TRIM_DEPTH = 0.045;
const WALL_TRIM_COLOR = "#E9E5DE";
const WALL_FINISH_OUTER_OFFSET = 0.007;

function getSectionPiece(
    piece: WallPieceType,
    section: WallPaintSection,
    wallStart: Vector3,
    wallLength: number,
    wallHeight: number
): WallPieceType | null {
    const direction = new Vector3(
        Math.cos(piece.rotationY),
        0,
        Math.sin(piece.rotationY)
    );
    const pieceCenter = piece.position.clone().sub(wallStart).dot(direction);
    const left = Math.max(
        pieceCenter - piece.width * 0.5,
        section.xStart * wallLength
    );
    const right = Math.min(
        pieceCenter + piece.width * 0.5,
        section.xEnd * wallLength
    );
    const bottom = Math.max(
        piece.position.y - piece.height * 0.5,
        section.yStart * wallHeight
    );
    const top = Math.min(
        piece.position.y + piece.height * 0.5,
        section.yEnd * wallHeight
    );

    if (right <= left || top <= bottom) {
        return null;
    }

    return {
        ...piece,
        width: right - left,
        height: top - bottom,
        position: piece.position.clone()
            .add(direction.multiplyScalar((left + right) * 0.5 - pieceCenter))
            .add(new Vector3(0, (bottom + top) * 0.5 - piece.position.y, 0))
    };
}

function SeparatorSurface({
    piece,
    wallStart,
    wallLength,
    wallHeight,
    separator,
    side,
    selected,
    preview = false,
    invalid = false,
    visible = true,
    disableInteraction = false,
    onClick,
    onPointerOver,
    onPointerOut
}: {
    piece: WallPieceType;
    wallStart: Vector3;
    wallLength: number;
    wallHeight: number;
    separator: WallPaintSeparator;
    side: 1 | -1;
    selected?: boolean;
    preview?: boolean;
    invalid?: boolean;
    visible?: boolean;
    disableInteraction?: boolean;
    onClick?: (event: ThreeEvent<MouseEvent>) => void;
    onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
    onPointerOut?: () => void;
}) {
    const direction = new Vector3(
        Math.cos(piece.rotationY),
        0,
        Math.sin(piece.rotationY)
    );
    const normal = new Vector3(-direction.z, 0, direction.x);
    const centerDistance = piece.position.clone().sub(wallStart).dot(direction);
    const left = centerDistance - piece.width * 0.5;
    const right = centerDistance + piece.width * 0.5;
    const bottom = piece.position.y - piece.height * 0.5;
    const top = piece.position.y + piece.height * 0.5;
    const coordinate = separator.position * (
        separator.orientation === "vertical" ? wallLength : wallHeight
    );
    const isInPiece = separator.orientation === "vertical"
        ? coordinate >= left && coordinate < right
        : coordinate >= bottom && coordinate < top;

    if (!isInPiece) {
        return null;
    }

    const surfaceOffset = normal.multiplyScalar(
        side * (piece.thickness * 0.5 + WALL_FINISH_OUTER_OFFSET + 0.006)
    );
    const points = separator.orientation === "vertical"
        ? [
            wallStart.clone()
                .add(direction.clone().multiplyScalar(coordinate))
                .add(new Vector3(0, bottom, 0))
                .add(surfaceOffset),
            wallStart.clone()
                .add(direction.clone().multiplyScalar(coordinate))
                .add(new Vector3(0, top, 0))
                .add(surfaceOffset)
        ]
        : [
            piece.position.clone()
                .add(direction.clone().multiplyScalar(-piece.width * 0.5))
                .add(new Vector3(0, coordinate - piece.position.y, 0))
                .add(surfaceOffset),
            piece.position.clone()
                .add(direction.clone().multiplyScalar(piece.width * 0.5))
                .add(new Vector3(0, coordinate - piece.position.y, 0))
                .add(surfaceOffset)
        ];

    return (
        <Line
            points={points}
            lineWidth={preview ? 3 : visible ? selected ? 3.5 : 2.5 : 8}
            color={preview
                ? invalid ? "#DC2626" : "#F59E0B"
                : selected ? "#2563EB" : "#374151"}
            transparent
            opacity={preview ? 0.95 : visible ? 0.95 : 0}
            depthTest
            depthWrite={false}
            renderOrder={13}
            raycast={preview || disableInteraction ? () => {} : undefined}
            onPointerOver={event => {
                if (
                    !preview &&
                    event.intersections[0]?.object === event.object
                ) {
                    onPointerOver?.(event);
                }
            }}
            onPointerOut={() => {
                if (!preview) onPointerOut?.();
            }}
            onClick={event => {
                if (!onClick) return;
                if (event.intersections[0]?.object !== event.object) return;
                event.stopPropagation();
                onClick(event);
            }}
        />
    );
}

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
    const [previewPosition, setPreviewPosition] = useState<{
        position: number;
        side: 1 | -1;
        version: number;
    } | null>(null);
    const [hoveredSeparatorKey, setHoveredSeparatorKey] = useState<string | null>(null);

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
        selected &&
        !walkthroughMode &&
        state.selectedWallSectionId === null &&
        state.selectedWallSeparatorId === null;

    const physicalWall =
        state.walls.find(
            wall => wall.id === wallId
        ) ?? null;
    const wallLength = physicalWall
        ? physicalWall.start.position.distanceTo(physicalWall.end.position)
        : 0;
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

    const getSeparatorPosition = (
        point: Vector3,
        orientation: "vertical" | "horizontal"
    ) => {
        if (!physicalWall || wallLength <= 0) {
            return null;
        }
        if (orientation === "horizontal") {
            return Math.max(0, Math.min(1, point.y / state.wallHeight));
        }
        const direction = physicalWall.end.position.clone()
            .sub(physicalWall.start.position)
            .normalize();
        return Math.max(0, Math.min(
            1,
            point.clone().sub(physicalWall.start.position).dot(direction) / wallLength
        ));
    };

    const handleWallPointerMove = (event: ThreeEvent<PointerEvent>) => {
        if (!state.wallSeparatorPlacement || !physicalWall) {
            setPreviewPosition(null);
            return;
        }
        event.stopPropagation();
        const side = getClickedWallSide(event.point);
        if (side === null) {
            setPreviewPosition(null);
            return;
        }
        const position = getSeparatorPosition(
            event.point,
            state.wallSeparatorPlacement
        );
        if (position !== null) {
            setPreviewPosition({
                position,
                side,
                version: state.wallSeparatorPlacementVersion
            });
        }
    };

    const placeSeparatorAtPoint = (
        point: Vector3,
        side: 1 | -1 | null = physicalWall
            ? getClickedWallSide(point)
            : null
    ) => {
        if (
            !state.wallSeparatorPlacement ||
            !physicalWall ||
            side === null
        ) {
            return;
        }
        const faceKey = getWallPaintFaceKey(wallId, side);
        const faceAtPoint = state.wallPaintSeparators[faceKey];

        const position = getSeparatorPosition(
            point,
            state.wallSeparatorPlacement
        );
        if (
            position === null ||
            !isValidWallPaintSeparatorPosition(
                faceAtPoint?.separators ?? [],
                state.wallSeparatorPlacement,
                position
            )
        ) {
            return;
        }

        const baseMaterial = getWallFinishSides(
            physicalWall,
            regions,
            state.wallFinishes
        ).find(finish => finish.side === side)?.materialId;
        const addedFace = addWallPaintSeparator(
            faceAtPoint,
            {
                id: crypto.randomUUID(),
                orientation: state.wallSeparatorPlacement,
                position
            },
            baseMaterial
        );
        if (!addedFace) {
            return;
        }
        const face = {
            ...addedFace,
            floorId: state.activeFloorId,
            surfaceType: "wall" as const,
            surfaceId: wallId,
            wallSide: side
        };
        dispatch({
            type: "SET_WALL_PAINT_FACE",
            payload: { faceKey, face }
        });
        dispatch({
            type: "SET_WALL_SEPARATOR_PLACEMENT",
            payload: null
        });
    };

    const handleWallClick = (
        event: ThreeEvent<MouseEvent>
    ) => {
        if (state.walkthroughMode) {
            return;
        }

        event.stopPropagation();
        event.nativeEvent.preventDefault();

        const clickPoint = event.point;

        if (state.wallSeparatorPlacement) {
            placeSeparatorAtPoint(
                clickPoint,
                getClickedWallSide(clickPoint)
            );
            return;
        }

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

        const face = state.wallPaintSeparators[
            getWallPaintFaceKey(wallId, side)
        ];
        if (face?.separators.length) {
            const direction = physicalWall?.end.position.clone()
                .sub(physicalWall.start.position)
                .normalize();
            const section = direction && physicalWall && wallLength > 0
                ? getWallPaintSectionAt(
                    getWallPaintSections(face),
                    clickPoint.clone().sub(physicalWall.start.position).dot(direction) / wallLength,
                    Math.max(0, Math.min(1, clickPoint.y / state.wallHeight))
                )
                : undefined;
            if (section) {
                dispatch({
                    type: "SELECT_WALL_SECTION",
                    payload: {
                        wallId,
                        side,
                        sectionId: section.id,
                        regionId: region?.id ?? null
                    }
                });
                return;
            }
        }

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
        setPreviewPosition(null);
    };

    void hovered;

    const wallColor =
        showSelected
            ? "#2196F3"
            : "#D9D9D9";

    const renderFinishSurfaces = () => finishSides.map(finish => {
        const surfacePiece = finish.section && physicalWall
            ? getSectionPiece(
                piece,
                finish.section,
                physicalWall.start.position,
                wallLength,
                state.wallHeight
            )
            : piece;
        if (!surfacePiece) {
            return null;
        }

        return (
            <group key={`${finish.regionId}-${finish.wallId}-${finish.side}-${finish.section?.id ?? "whole"}`}>
                <WallFinishSurface
                    piece={surfacePiece}
                    finish={finish}
                />
            </group>
        );
    });

    const renderSelectedSection = () => {
        if (
            !physicalWall ||
            wallLength <= 0 ||
            state.selectedWallId !== wallId ||
            state.selectedWallSide === null ||
            !state.selectedWallSectionId
        ) {
            return null;
        }
        const face = state.wallPaintSeparators[
            getWallPaintFaceKey(wallId, state.selectedWallSide)
        ];
        const section = getWallPaintSections(face).find(
            item => item.id === state.selectedWallSectionId
        );
        if (!section) {
            return null;
        }
        const surfacePiece = getSectionPiece(
            piece,
            section,
            physicalWall.start.position,
            wallLength,
            state.wallHeight
        );
        if (!surfacePiece) {
            return null;
        }
        const direction = new Vector3(
            Math.cos(surfacePiece.rotationY),
            0,
            Math.sin(surfacePiece.rotationY)
        );
        const normal = new Vector3(-direction.z, 0, direction.x);
        const position = surfacePiece.position.clone().add(
            normal.multiplyScalar(
                state.selectedWallSide * (
                    surfacePiece.thickness * 0.5 +
                    WALL_FINISH_OUTER_OFFSET +
                    0.012
                )
            )
        );
        return (
            <mesh
                position={position}
                rotation={[0, -surfacePiece.rotationY, 0]}
                raycast={() => {}}
                renderOrder={4}
            >
                <boxGeometry args={[
                    surfacePiece.width,
                    surfacePiece.height,
                    0.002
                ]} />
                <meshBasicMaterial
                    color="#3B82F6"
                    transparent
                    opacity={0.22}
                    depthWrite={false}
                />
            </mesh>
        );
    };

    const renderSeparators = () => {
        if (!physicalWall || wallLength <= 0) {
            return null;
        }

        return ([1, -1] as const).flatMap(side => {
            const face = state.wallPaintSeparators[
                getWallPaintFaceKey(wallId, side)
            ];
            const sections = getWallPaintSections(face);
            return (face?.separators ?? []).map(separator => {
                const selectedSection = state.selectedWallId === wallId &&
                    state.selectedWallSide === side
                    ? sections.find(section =>
                        section.id === state.selectedWallSectionId
                    )
                    : undefined;
                const touchesSelectedSection = selectedSection &&
                    (separator.orientation === "vertical"
                        ? Math.abs(selectedSection.xStart - separator.position) < 1e-6 ||
                            Math.abs(selectedSection.xEnd - separator.position) < 1e-6
                        : Math.abs(selectedSection.yStart - separator.position) < 1e-6 ||
                            Math.abs(selectedSection.yEnd - separator.position) < 1e-6);
                const selected = (
                    state.selectedWallSide === side &&
                    state.selectedWallSeparatorId === separator.id
                ) || Boolean(touchesSelectedSection);
                const separatorKey = `${side}:${separator.id}`;
                return (
                    <SeparatorSurface
                        key={`${wallId}-${separatorKey}-${piece.kind}-${piece.position.x}-${piece.position.y}-${piece.position.z}`}
                        piece={piece}
                        wallStart={physicalWall.start.position}
                        wallLength={wallLength}
                        wallHeight={state.wallHeight}
                        separator={separator}
                        side={side}
                        selected={selected}
                        visible={selected || hoveredSeparatorKey === separatorKey}
                        disableInteraction={Boolean(state.wallSeparatorPlacement)}
                        onPointerOver={event => {
                            event.stopPropagation();
                            setHoveredSeparatorKey(separatorKey);
                        }}
                        onPointerOut={() => {
                            setHoveredSeparatorKey(current =>
                                current === separatorKey ? null : current
                            );
                        }}
                        onClick={event => {
                            if (state.wallSeparatorPlacement) {
                                placeSeparatorAtPoint(
                                    event.point,
                                    side
                                );
                                return;
                            }
                            dispatch({
                                type: "SELECT_WALL_SEPARATOR",
                                payload: {
                                    wallId,
                                    side,
                                    separatorId: separator.id,
                                    regionId: getRegionForWallClick(side)?.id ?? null
                                }
                            });
                        }}
                    />
                );
            });
        });
    };

    const renderPreviewSeparator = () => {
        if (
            !physicalWall ||
            !state.wallSeparatorPlacement ||
            previewPosition === null ||
            previewPosition.version !== state.wallSeparatorPlacementVersion
        ) {
            return null;
        }

        const valid = isValidWallPaintSeparatorPosition(
            state.wallPaintSeparators[
                getWallPaintFaceKey(wallId, previewPosition.side)
            ]?.separators ?? [],
            state.wallSeparatorPlacement,
            previewPosition.position
        );
        return (
            <SeparatorSurface
                piece={piece}
                wallStart={physicalWall.start.position}
                wallLength={wallLength}
                wallHeight={state.wallHeight}
                separator={{
                    id: "preview",
                    orientation: state.wallSeparatorPlacement,
                    position: previewPosition.position
                }}
                side={previewPosition.side}
                preview
                invalid={!valid}
            />
        );
    };

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
                    onPointerMove={handleWallPointerMove}
                    onClick={handleWallClick}
                >
                    <meshStandardMaterial
                        color={wallColor}
                    />
                </mesh>

                {renderFinishSurfaces()}
                {renderSelectedSection()}
                {renderSeparators()}
                {renderPreviewSeparator()}
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
                onPointerMove={handleWallPointerMove}
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

            {renderFinishSurfaces()}
            {renderSelectedSection()}
            {renderSeparators()}
            {renderPreviewSeparator()}
        </group>
    );
}

export default memo(WallPiece);
