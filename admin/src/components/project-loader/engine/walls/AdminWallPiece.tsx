import { useMemo, useState } from "react";
import { Line } from "@react-three/drei";
import { ExtrudeGeometry, Shape } from "three";
import type { Wall } from "./WallTypes";
import type { Region } from "../regions/Polygon";
import {
    getRegionWallSide
} from "./AdminWallFinishUtils";
import type {
    AdminWallFinishSide
} from "./AdminWallFinishUtils";
import AdminWallFinishSurface from "./AdminWallFinishSurface";
import type { AdminWallPieceData } from "./AdminWallMeshBuilder";
import { emitAdminCommentTarget } from "../../../../services/assets/adminCommentEvents";
import { DoubleSide, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import {
    getWallPaintFaceKey,
    getWallPaintSectionAt,
    getWallPaintSections,
    type WallPaintSection,
    type WallPaintSeparatorMap
} from "../../../../../../shared/wallPaintSeparators.ts";

interface AdminWallPieceProps {
    wallId: string;
    physicalWall: Wall;
    piece: AdminWallPieceData;
    regions: Region[];
    finishSides: AdminWallFinishSide[];
    wallHeight: number;
    wallPaintSeparators: WallPaintSeparatorMap;
    onWallClick?: (wallId: string, position: Vector3, event: ThreeEvent<MouseEvent>) => void;
    onWallPointerMove?: (wallId: string, position: Vector3, event: ThreeEvent<PointerEvent>) => void;
    selected: boolean;
}

const WALL_TRIM_HEIGHT = 0.12;
const WALL_TRIM_DEPTH = 0.008;
const WALL_TRIM_CAP_HEIGHT = 0.018;
const WALL_TRIM_CAP_DEPTH = 0.012;
const WALL_TRIM_COLOR = "#E9E5DE";
const WALL_FINISH_OUTER_OFFSET = 0.007;

function getSectionPiece(
    piece: AdminWallPieceData,
    section: WallPaintSection,
    wallStart: Vector3,
    wallLength: number,
    wallHeight: number
): AdminWallPieceData | null {
    const direction = new Vector3(
        Math.cos(piece.rotationY),
        0,
        Math.sin(piece.rotationY)
    );
    const centerDistance = piece.position.clone().sub(wallStart).dot(direction);
    const left = Math.max(
        centerDistance - piece.width * 0.5,
        section.xStart * wallLength
    );
    const right = Math.min(
        centerDistance + piece.width * 0.5,
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
            .add(direction.multiplyScalar((left + right) * 0.5 - centerDistance))
            .add(new Vector3(0, (bottom + top) * 0.5 - piece.position.y, 0))
    };
}

function WallTrim({
    piece,
    side
}: {
    piece: AdminWallPieceData;
    side: 1 | -1;
}) {
    if (piece.kind === "arch") {
        return null;
    }

    const trimHeight = Math.min(
        WALL_TRIM_HEIGHT,
        Math.max(
            0.02,
            piece.height * 0.25
        )
    );

    const capHeight = Math.min(
        WALL_TRIM_CAP_HEIGHT,
        trimHeight * 0.35
    );

    const halfThickness = piece.thickness * 0.5;

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
            position={piece.position}
            rotation={[0, -piece.rotationY, 0]}
        >
            <mesh
                position={[0, trimY, trimZ]}
                castShadow
                receiveShadow
                raycast={() => {}}
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
                    color={WALL_TRIM_COLOR}
                    roughness={0.82}
                    metalness={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                />
            </mesh>

            <mesh
                position={[0, capY, capZ]}
                castShadow
                receiveShadow
                raycast={() => {}}
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
                    color={WALL_TRIM_COLOR}
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

export default function AdminWallPiece({
    wallId,
    physicalWall,
    piece,
    regions,
    finishSides,
    wallHeight,
    wallPaintSeparators,
    onWallClick,
    onWallPointerMove,
    selected
}: AdminWallPieceProps) {
    const [hoveredSeparatorKey, setHoveredSeparatorKey] = useState<string | null>(null);
    const [hoveredSection, setHoveredSection] = useState<{
        side: 1 | -1;
        sectionId: string;
    } | null>(null);
    const pieceBottom =
        piece.position.y -
        piece.height * 0.5;

    const touchesFloor =
        pieceBottom <= 0.02;

    const trimSides = useMemo(() => {
        if (!touchesFloor) {
            return [] as (1 | -1)[];
        }

        const sides = new Set<1 | -1>();

        for (const region of regions) {
            const belongsToRegion = region.walls.some(
                regionWall => regionWall.id === wallId
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

    const archGeometry = useMemo(() => {
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
                Math.PI *
                (i / segments);

            shape.lineTo(
                Math.cos(angle) * radius,
                openingHeight +
                    Math.sin(angle) * radius
            );
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

        return geometry;
    }, [piece]);
    const highlightArchGeometry = useMemo(
        () => selected && archGeometry ? archGeometry.clone() : null,
        [archGeometry, selected]
    );
    const wallLength = physicalWall.start.position.distanceTo(
        physicalWall.end.position
    );
    const renderFinishes = () => finishSides.map(finish => {
        const surfacePiece = finish.section
            ? getSectionPiece(
                piece,
                finish.section,
                physicalWall.start.position,
                wallLength,
                wallHeight
            )
            : piece;
        if (!surfacePiece) {
            return null;
        }
        return (
            <AdminWallFinishSurface
                key={`${finish.regionId}-${finish.wallId}-${finish.side}-${finish.section?.id ?? "whole"}`}
                piece={surfacePiece}
                finish={finish}
            />
        );
    });
    const renderSeparators = () => {
        if (wallLength <= 0.001) {
            return null;
        }
        const direction = new Vector3(
            Math.cos(piece.rotationY),
            0,
            Math.sin(piece.rotationY)
        );
        const normal = new Vector3(-direction.z, 0, direction.x);
        const centerDistance = piece.position.clone()
            .sub(physicalWall.start.position)
            .dot(direction);
        const left = centerDistance - piece.width * 0.5;
        const right = centerDistance + piece.width * 0.5;
        const bottom = piece.position.y - piece.height * 0.5;
        const top = piece.position.y + piece.height * 0.5;
        return ([1, -1] as const).flatMap(side => {
            const face = wallPaintSeparators[
                getWallPaintFaceKey(wallId, side)
            ];
            return (face?.separators ?? []).map(separator => {
                const coordinate = separator.position *
                    (separator.orientation === "vertical" ? wallLength : wallHeight);
                const intersectsPiece = separator.orientation === "vertical"
                    ? coordinate >= left && coordinate < right
                    : coordinate >= bottom && coordinate < top;
                if (!intersectsPiece) {
                    return null;
                }
                const surfaceOffset = normal.clone().multiplyScalar(
                    side * (piece.thickness * 0.5 + WALL_FINISH_OUTER_OFFSET + 0.006)
                );
                const points = separator.orientation === "vertical"
                    ? [
                        physicalWall.start.position.clone()
                            .add(direction.clone().multiplyScalar(coordinate))
                            .add(new Vector3(0, bottom, 0))
                            .add(surfaceOffset),
                        physicalWall.start.position.clone()
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
                const separatorKey = `${side}:${separator.id}`;
                const hoveredSectionForSide = hoveredSection?.side === side
                    ? getWallPaintSections(face).find(
                        section => section.id === hoveredSection.sectionId
                    )
                    : undefined;
                const sectionTouchesSeparator = hoveredSectionForSide &&
                    (separator.orientation === "vertical"
                        ? Math.abs(hoveredSectionForSide.xStart - separator.position) < 1e-6 ||
                            Math.abs(hoveredSectionForSide.xEnd - separator.position) < 1e-6
                        : Math.abs(hoveredSectionForSide.yStart - separator.position) < 1e-6 ||
                            Math.abs(hoveredSectionForSide.yEnd - separator.position) < 1e-6);
                const guideSelected = selected || Boolean(sectionTouchesSeparator);
                const guideVisible = guideSelected || hoveredSeparatorKey === separatorKey;
                return (
                    <Line
                        key={`${wallId}-${side}-${separator.id}-${piece.position.x}-${piece.position.y}-${piece.position.z}`}
                        points={points}
                        lineWidth={guideVisible ? 2.5 : 8}
                        color={guideSelected ? "#2563EB" : "#374151"}
                        transparent
                        opacity={guideVisible ? 0.95 : 0}
                        depthTest
                        depthWrite={false}
                        renderOrder={13}
                        onPointerOver={event => {
                            if (event.intersections[0]?.object !== event.object) return;
                            event.stopPropagation();
                            setHoveredSeparatorKey(separatorKey);
                        }}
                        onPointerOut={() => {
                            setHoveredSeparatorKey(current =>
                                current === separatorKey ? null : current
                            );
                        }}
                    />
                );
            });
        });
    };

    const handleWallClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();

        if (onWallClick) {
            onWallClick(wallId, event.point, event);
            return;
        }

        emitAdminCommentTarget({
            targetType: "wall",
            targetId: wallId,
            targetLabel: "Wall"
        });
    };

    const handleWallPointerMove = (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        const direction = physicalWall.end.position.clone()
            .sub(physicalWall.start.position)
            .normalize();
        const normal = new Vector3(-direction.z, 0, direction.x);
        const center = physicalWall.start.position.clone()
            .add(physicalWall.end.position)
            .multiplyScalar(0.5);
        const side: 1 | -1 = event.point.clone().sub(center).dot(normal) >= 0
            ? 1
            : -1;
        const horizontalPosition = Math.max(0, Math.min(
            1,
            event.point.clone().sub(physicalWall.start.position).dot(direction) /
                Math.max(wallLength, 1e-6)
        ));
        const verticalPosition = Math.max(0, Math.min(1, event.point.y / wallHeight));
        const face = wallPaintSeparators[getWallPaintFaceKey(wallId, side)];
        const section = getWallPaintSectionAt(
            getWallPaintSections(face),
            horizontalPosition,
            verticalPosition
        );
        setHoveredSection(section ? { side, sectionId: section.id } : null);
        onWallPointerMove?.(wallId, event.point, event);
    };

    const clearHoveredSection = () => setHoveredSection(null);

    if (
        piece.kind === "arch" &&
        archGeometry
    ) {
        return (
            <group>
                <mesh
                    geometry={archGeometry}
                    position={piece.position}
                    rotation={[0, -piece.rotationY, 0]}
                    castShadow
                    receiveShadow
                    onClick={handleWallClick}
                    onPointerMove={handleWallPointerMove}
                    onPointerOut={clearHoveredSection}
                    userData={{
                        wallId
                    }}
                >
                    <meshStandardMaterial
                        color="#D9D9D9"
                        roughness={0.82}
                        side={DoubleSide}
                    />
                </mesh>
                {highlightArchGeometry && (
                    <mesh
                        geometry={highlightArchGeometry}
                        position={piece.position}
                        rotation={[0, -piece.rotationY, 0]}
                        scale={[1, 1, 1.03]}
                        raycast={() => null}
                        renderOrder={2}
                    >
                        <meshBasicMaterial
                            color="#3b82f6"
                            transparent
                            opacity={0.2}
                            depthWrite={false}
                            side={DoubleSide}
                            polygonOffset
                            polygonOffsetFactor={-1}
                            polygonOffsetUnits={-1}
                        />
                    </mesh>
                )}

                {renderFinishes()}
                {renderSeparators()}
            </group>
        );
    }

    return (
        <group>
            <mesh
                position={piece.position}
                rotation={[0, -piece.rotationY, 0]}
                castShadow
                receiveShadow
                onClick={handleWallClick}
                onPointerMove={handleWallPointerMove}
                onPointerOut={clearHoveredSection}
                userData={{
                    wallId
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
                    color="#D9D9D9"
                    roughness={0.82}
                    side={DoubleSide}
                />
            </mesh>
            {selected && (
                <mesh
                    position={piece.position}
                    rotation={[0, -piece.rotationY, 0]}
                    raycast={() => null}
                    renderOrder={2}
                >
                    <boxGeometry
                        args={[
                            piece.width + 0.002,
                            piece.height + 0.002,
                            piece.thickness + 0.006
                        ]}
                    />
                    <meshBasicMaterial
                        color="#3b82f6"
                        transparent
                        opacity={0.2}
                        depthWrite={false}
                        side={DoubleSide}
                        polygonOffset
                        polygonOffsetFactor={-1}
                        polygonOffsetUnits={-1}
                    />
                </mesh>
            )}

            {touchesFloor &&
                trimSides.map(side => (
                    <WallTrim
                        key={`${wallId}-trim-${side}`}
                        piece={piece}
                        side={side}
                    />
                ))}

            {renderFinishes()}
            {renderSeparators()}
        </group>
    );
}