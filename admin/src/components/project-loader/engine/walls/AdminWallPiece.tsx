import { useMemo } from "react";
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

interface AdminWallPieceProps {
    wallId: string;
    physicalWall: Wall;
    piece: AdminWallPieceData;
    regions: Region[];
    finishSides: AdminWallFinishSide[];
}

const WALL_TRIM_HEIGHT = 0.12;
const WALL_TRIM_DEPTH = 0.008;
const WALL_TRIM_CAP_HEIGHT = 0.018;
const WALL_TRIM_CAP_DEPTH = 0.012;
const WALL_TRIM_COLOR = "#E9E5DE";
const WALL_FINISH_OUTER_OFFSET = 0.007;

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
    finishSides
}: AdminWallPieceProps) {
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

    const handleWallClick = (event: any) => {
        event.stopPropagation();

        emitAdminCommentTarget({
    targetType: "wall",
    targetId: wallId,
    targetLabel: "Wall"
});
    };

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
                    userData={{
                        wallId
                    }}
                >
                    <meshStandardMaterial
                        color="#D9D9D9"
                        roughness={0.82}
                    />
                </mesh>

                {finishSides.map(finish => (
                    <AdminWallFinishSurface
                        key={`${finish.regionId}-${finish.wallId}-${finish.side}`}
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
                rotation={[0, -piece.rotationY, 0]}
                castShadow
                receiveShadow
                onClick={handleWallClick}
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
                />
            </mesh>

            {touchesFloor &&
                trimSides.map(side => (
                    <WallTrim
                        key={`${wallId}-trim-${side}`}
                        piece={piece}
                        side={side}
                    />
                ))}

            {finishSides.map(finish => (
                <AdminWallFinishSurface
                    key={`${finish.regionId}-${finish.wallId}-${finish.side}`}
                    piece={piece}
                    finish={finish}
                />
            ))}
        </group>
    );
}