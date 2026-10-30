import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import {
    CanvasTexture,
    DoubleSide,
    Texture,
    Vector3
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Region } from "../engine/regions/Polygon";
import type { Material } from "../engine/materials/MaterialTypes";
import {
    DEFAULT_FLOOR_MATERIAL_ID,
    LOCAL_DEFAULT_FLOOR_TEXTURE,
    getCachedFloorTexture,
    preloadFloorTexture
} from "../../../services/assets/floorsload";
import { emitAdminCommentTarget } from "../../../services/assets/adminCommentEvents";
import { createAdminFloorGeometry } from "./floorGeometry";

interface AdminFloorProps {
    region: Region;
    floorId?: string;
    materials: Material[];
    floorFinishes: Record<string, string>;
    selected: boolean;
    onSelect?: (regionId: string) => void;
    allowInteractionPropagation?: boolean;
    showAreaLabel?: boolean;
}

function useFloorTexture(
    url?: string
): Texture | null {
    const [loadedTexture, setLoadedTexture] = useState<Texture | null>(null);

    useEffect(() => {
        if (!url) {
            setLoadedTexture(null);
            return;
        }

        let cancelled = false;

        preloadFloorTexture(url).then(texture => {
            if (!cancelled) {
                setLoadedTexture(texture);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [url]);

    if (!url) {
        return null;
    }

    return getCachedFloorTexture(url) ?? loadedTexture;
}

function distanceToSegment(point: Vector3, start: Vector3, end: Vector3): number {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared <= 0.000001) {
        return Math.hypot(point.x - start.x, point.z - start.z);
    }

    const t = Math.max(0, Math.min(1,
        ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
    ));
    return Math.hypot(
        point.x - (start.x + t * dx),
        point.z - (start.z + t * dz)
    );
}

function distanceToPolygonBoundary(point: Vector3, polygon: Vector3[]): number {
    let minimum = Infinity;
    for (let i = 0; i < polygon.length; i++) {
        minimum = Math.min(
            minimum,
            distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length])
        );
    }
    return minimum;
}

function pointInPolygon(point: Vector3, polygon: Vector3[]): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const intersects =
            (a.z > point.z) !== (b.z > point.z) &&
            point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
        if (intersects) inside = !inside;
    }
    return inside;
}

function computeLabelAnchor(region: Region): { point: Vector3; clearance: number } {
    const outer = (region.corners ?? []).filter(Boolean);
    if (outer.length < 3) {
        return { point: new Vector3(), clearance: 0.5 };
    }

    const holes = (region.boundaryLoops ?? [])
        .slice(1)
        .map(loop => loop.corners.filter(Boolean))
        .filter(hole => hole.length >= 3);
    const minX = Math.min(...outer.map(point => point.x));
    const maxX = Math.max(...outer.map(point => point.x));
    const minZ = Math.min(...outer.map(point => point.z));
    const maxZ = Math.max(...outer.map(point => point.z));
    const fallback = new Vector3((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);
    const resolution = 20;
    const stepX = (maxX - minX) / resolution;
    const stepZ = (maxZ - minZ) / resolution;
    let best: { point: Vector3; clearance: number } | null = null;

    for (let i = 0; i <= resolution; i++) {
        for (let j = 0; j <= resolution; j++) {
            const point = new Vector3(minX + i * stepX, 0, minZ + j * stepZ);
            if (!pointInPolygon(point, outer) || holes.some(hole => pointInPolygon(point, hole))) {
                continue;
            }
            const clearance = Math.min(
                distanceToPolygonBoundary(point, outer),
                ...holes.map(hole => distanceToPolygonBoundary(point, hole))
            );
            if (!best || clearance > best.clearance) best = { point, clearance };
        }
    }

    return best ?? { point: fallback, clearance: 0.5 };
}

export default function AdminFloor({
    region,
    floorId,
    materials,
    floorFinishes,
    selected,
    onSelect,
    allowInteractionPropagation = false,
    showAreaLabel = true
}: AdminFloorProps) {
    const selectedMaterialId = floorFinishes[region.id];

    const selectedMaterial = materials.find(
        material => material.id === selectedMaterialId
    );

    const firebaseDefaultMaterial = materials.find(
        material => material.id === DEFAULT_FLOOR_MATERIAL_ID
    );

    const defaultMaterial: Material =
        firebaseDefaultMaterial
            ? {
                ...firebaseDefaultMaterial,
                texture: LOCAL_DEFAULT_FLOOR_TEXTURE,
                thumbnail:
                    firebaseDefaultMaterial.thumbnail ??
                    LOCAL_DEFAULT_FLOOR_TEXTURE
            }
            : {
                id: DEFAULT_FLOOR_MATERIAL_ID,
                name: "Terrazo Tiles",
                category: "flooring",
                pricePerSquareMeter: 0,
                thumbnail: LOCAL_DEFAULT_FLOOR_TEXTURE,
                texture: LOCAL_DEFAULT_FLOOR_TEXTURE,
                color: "#ffffff",
                roughness: 0.8,
                metalness: 0
            };

    const displayMaterial =
        selectedMaterial ?? defaultMaterial;

    const floorTexture = useFloorTexture(
        displayMaterial.texture
    );

    const geometry = useMemo(
        () => createAdminFloorGeometry(region.boundaryLoops),
        [region.boundaryLoops]
    );

    const highlightGeometry = useMemo(
        () => selected ? geometry?.clone() ?? null : null,
        [geometry, selected]
    );

    const floorArea = Math.abs(region.area || 0);
    const labelAnchor = useMemo(
        () => showAreaLabel ? computeLabelAnchor(region) : null,
        [region, showAreaLabel]
    );
    const labelTexture = useMemo(() => {
        if (!showAreaLabel) return null;
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        const context = canvas.getContext("2d");
        if (!context) return null;

        const label = `${floorArea.toFixed(2)} m²`;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineJoin = "round";
        context.font = "800 140px Arial";
        context.lineWidth = 14;
        context.strokeStyle = "rgba(0,0,0,0.45)";
        context.strokeText(label, canvas.width / 2, canvas.height / 2);
        context.fillStyle = "rgba(255,255,255,0.96)";
        context.fillText(label, canvas.width / 2, canvas.height / 2);

        const texture = new CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }, [floorArea, showAreaLabel]);

    useEffect(() => () => labelTexture?.dispose(), [labelTexture]);

    const floorY = region.parentRegionId
        ? 0.02
        : 0;
    const selectedAreaAnchor = useMemo(
        () => selected ? computeLabelAnchor(region) : null,
        [region, selected]
    );

    if (!geometry) {
        return null;
    }

    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        emitAdminCommentTarget({
            targetType: "floor",
            targetId: region.id,
            targetLabel: `Floor`,
            regionId: region.id
        });
        if (onSelect) {
            event.stopPropagation();
            onSelect(region.id);
        } else if (!allowInteractionPropagation) {
            event.stopPropagation();
        }
    };

    return (
        <group>
            <mesh
                geometry={geometry}
                position={[0, floorY, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
                onClick={handleClick}
                userData={{
                    floorId: floorId ?? region.id,
                    regionId: region.id,
                    staircaseRaycastSurface: true
                }}
            >
                <meshStandardMaterial
                    map={floorTexture}
                    color={
                        displayMaterial.color ??
                        (
                            floorTexture
                                ? "#ffffff"
                                : "#d9dde3"
                        )
                    }
                    roughness={displayMaterial.roughness ?? 0.8}
                    metalness={displayMaterial.metalness ?? 0}
                    side={DoubleSide}
                />
            </mesh>
            {showAreaLabel && labelTexture && labelAnchor && (
                <mesh
                    position={[
                        labelAnchor.point.x,
                        floorY + 0.03,
                        labelAnchor.point.z
                    ]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <planeGeometry
                        args={[
                            Math.min(0.9, labelAnchor.clearance * 1.7),
                            Math.min(0.45, labelAnchor.clearance * 0.85)
                        ]}
                    />
                    <meshBasicMaterial
                        map={labelTexture}
                        transparent
                        depthWrite={false}
                        alphaTest={0.05}
                        side={DoubleSide}
                    />
                </mesh>
            )}
            {selected && selectedAreaAnchor && (
                <Html
                    position={[
                        selectedAreaAnchor.point.x,
                        floorY + 0.06,
                        selectedAreaAnchor.point.z
                    ]}
                    center
                    zIndexRange={[1000, 0]}
                    style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
                >
                    <span className="admin-structure-area-label">
                        {`${Math.abs(region.area).toFixed(2)} m²`}
                    </span>
                </Html>
            )}
            {highlightGeometry && (
                <mesh
                    geometry={highlightGeometry}
                    position={[0, floorY + 0.008, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    raycast={() => null}
                    renderOrder={2}
                >
                    <meshBasicMaterial
                        color="#3b82f6"
                        transparent
                        opacity={0.18}
                        depthWrite={false}
                        side={DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}