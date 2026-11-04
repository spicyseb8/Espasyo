import { useEffect, useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import {
    CanvasTexture,
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Path,
    Shape,
    ShapeGeometry,
    Texture,
    Vector3
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Region } from "../engine/regions/Polygon";
import type { Material } from "../engine/materials/MaterialTypes";
import {
    createFloorPatternLayout,
    getFloorPatternUV,
    isFloorPattern
} from "../../../../../shared/flooring/patterns";
import {
    DEFAULT_FLOOR_MATERIAL_ID,
    LOCAL_DEFAULT_FLOOR_TEXTURE,
    getCachedFloorPatternTexture,
    getCachedFloorTexture,
    preloadFloorPatternTexture,
    preloadFloorTexture
} from "../../../services/assets/floorsload";
import { emitAdminCommentTarget } from "../../../services/assets/adminCommentEvents";
import {
    clipFloorTriangleToSection,
    getWallPaintSections,
    type FloorPaintSeparatorMap,
    type WallPaintSection
} from "../../../../../shared/wallPaintSeparators";

interface AdminFloorProps {
    region: Region;
    floorId?: string;
    materials: Material[];
    floorFinishes: Record<string, string>;
    floorPaintSeparators?: FloorPaintSeparatorMap;
    selected: boolean;
    onSelect?: (regionId: string) => void;
    allowInteractionPropagation?: boolean;
    showAreaLabel?: boolean;
}

function useFloorTexture(
    url: string | undefined,
    material: Material
): Texture | null {
    const materialSettings = useMemo<Material>(() => ({
        id: material.id,
        name: material.name,
        category: material.category,
        pricePerSquareMeter: material.pricePerSquareMeter,
        floorMaterialMode: material.floorMaterialMode,
        floorPattern: material.floorPattern,
        length: material.length,
        width: material.width
    }), [
        material.id,
        material.name,
        material.category,
        material.pricePerSquareMeter,
        material.floorMaterialMode,
        material.floorPattern,
        material.length,
        material.width
    ]);
    const requestKey = url
        ? JSON.stringify([
            url,
            materialSettings.floorMaterialMode,
            materialSettings.floorPattern,
            materialSettings.length,
            materialSettings.width
        ])
        : "";
    const [loadedTexture, setLoadedTexture] =
        useState<{ key: string; texture: Texture | null } | null>(null);

    useEffect(() => {
        if (!url) return;

        let cancelled = false;

        const loadTexture =
            materialSettings.floorMaterialMode === "single-tile"
                ? preloadFloorPatternTexture(url, materialSettings)
                : preloadFloorTexture(url);
        loadTexture.then(texture => {
            if (!cancelled) {
                setLoadedTexture({ key: requestKey, texture });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        url,
        materialSettings,
        requestKey
    ]);

    if (!url) {
        return null;
    }

    return (
        (materialSettings.floorMaterialMode === "single-tile"
            ? getCachedFloorPatternTexture(url, materialSettings)
            : getCachedFloorTexture(url)) ??
        (loadedTexture?.key === requestKey ? loadedTexture.texture : null)
    );
}

interface FloorGeometryBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

function getGeometryBounds(geometry: BufferGeometry): FloorGeometryBounds {
    const position = geometry.getAttribute("position");
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };
    for (let index = 0; index < position.count; index += 1) {
        bounds.minX = Math.min(bounds.minX, position.getX(index));
        bounds.maxX = Math.max(bounds.maxX, position.getX(index));
        bounds.minY = Math.min(bounds.minY, position.getY(index));
        bounds.maxY = Math.max(bounds.maxY, position.getY(index));
    }
    return bounds;
}

function getSectionGeometry(
    source: BufferGeometry,
    section: WallPaintSection,
    bounds: FloorGeometryBounds,
    material: Material
): BufferGeometry {
    const sectionBounds = {
        xStart: bounds.minX + (bounds.maxX - bounds.minX) * section.xStart,
        xEnd: bounds.minX + (bounds.maxX - bounds.minX) * section.xEnd,
        yStart: bounds.minY + (bounds.maxY - bounds.minY) * section.yStart,
        yEnd: bounds.minY + (bounds.maxY - bounds.minY) * section.yEnd
    };
    const positions = source.getAttribute("position");
    const index = source.getIndex();
    const triangleCount = index ? index.count / 3 : positions.count / 3;
    const outputPositions: number[] = [];
    const outputUvs: number[] = [];
    const layout = material.floorMaterialMode === "single-tile" &&
        isFloorPattern(material.floorPattern) &&
        typeof material.length === "number" &&
        typeof material.width === "number"
        ? createFloorPatternLayout(material.floorPattern, material.length, material.width)
        : null;

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const vertices = [0, 1, 2].map(offset => {
            const vertex = triangle * 3 + offset;
            return index ? index.getX(vertex) : vertex;
        });
        const clipped = clipFloorTriangleToSection([
            { x: positions.getX(vertices[0]), y: positions.getY(vertices[0]) },
            { x: positions.getX(vertices[1]), y: positions.getY(vertices[1]) },
            { x: positions.getX(vertices[2]), y: positions.getY(vertices[2]) }
        ], sectionBounds);
        for (let pointIndex = 1; pointIndex < clipped.length - 1; pointIndex += 1) {
            for (const point of [clipped[0], clipped[pointIndex], clipped[pointIndex + 1]]) {
                outputPositions.push(point.x, point.y, 0);
                const uv = layout
                    ? getFloorPatternUV(point.x, point.y, layout)
                    : { x: point.x, y: point.y };
                outputUvs.push(uv.x, uv.y);
            }
        }
    }

    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(outputPositions, 3));
    result.setAttribute("uv", new Float32BufferAttribute(outputUvs, 2));
    result.computeVertexNormals();
    return result;
}

function AdminFloorSection({
    sourceGeometry,
    section,
    bounds,
    material,
    floorY,
    floorId,
    regionId,
    onClick,
    onPointerOver,
    onPointerOut
}: {
    sourceGeometry: BufferGeometry;
    section: WallPaintSection;
    bounds: FloorGeometryBounds;
    material: Material;
    floorY: number;
    floorId: string;
    regionId: string;
    onClick: (event: ThreeEvent<MouseEvent>) => void;
    onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
    onPointerOut: () => void;
}) {
    const geometry = useMemo(
        () => getSectionGeometry(sourceGeometry, section, bounds, material),
        [sourceGeometry, section, bounds, material]
    );
    const texture = useFloorTexture(material.texture, material);
    useEffect(() => () => geometry.dispose(), [geometry]);
    if (geometry.getAttribute("position").count === 0) return null;
    return (
        <mesh
            geometry={geometry}
            position={[0, floorY + 0.004, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            userData={{
                floorId,
                regionId,
                staircaseRaycastSurface: true
            }}
        >
            <meshStandardMaterial
                map={texture}
                color={material.color ?? (texture ? "#ffffff" : "#d9dde3")}
                roughness={material.roughness ?? 0.8}
                metalness={material.metalness ?? 0}
                side={DoubleSide}
            />
        </mesh>
    );
}

function getSeparatorLinePoints(
    geometry: BufferGeometry,
    orientation: "vertical" | "horizontal",
    positionValue: number,
    bounds: FloorGeometryBounds,
    floorY: number
): Vector3[] {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const triangleCount = index ? index.count / 3 : position.count / 3;
    const axis = orientation === "vertical" ? "x" : "y";
    const minimum = orientation === "vertical" ? bounds.minX : bounds.minY;
    const maximum = orientation === "vertical" ? bounds.maxX : bounds.maxY;
    const coordinate = minimum + (maximum - minimum) * positionValue;
    const points: Vector3[] = [];

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const vertices = [0, 1, 2].map(offset => {
            const vertex = triangle * 3 + offset;
            const sourceIndex = index ? index.getX(vertex) : vertex;
            return new Vector3(
                position.getX(sourceIndex),
                position.getY(sourceIndex),
                0
            );
        });
        const intersections: Vector3[] = [];
        for (let edge = 0; edge < 3; edge += 1) {
            const start = vertices[edge];
            const end = vertices[(edge + 1) % 3];
            const startDelta = start[axis] - coordinate;
            const endDelta = end[axis] - coordinate;
            if (startDelta * endDelta > 0 || Math.abs(startDelta - endDelta) < 1e-10) {
                continue;
            }
            const point = start.clone().lerp(
                end,
                startDelta / (startDelta - endDelta)
            );
            if (!intersections.some(existing => existing.distanceTo(point) < 1e-5)) {
                intersections.push(point);
            }
        }
        for (const point of intersections.slice(0, 2)) {
            points.push(new Vector3(point.x, floorY + 0.008, -point.y));
        }
    }

    return points;
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
    floorPaintSeparators = {},
    selected,
    onSelect,
    allowInteractionPropagation = false,
    showAreaLabel = true
}: AdminFloorProps) {
    const [hoveredSeparatorId, setHoveredSeparatorId] = useState<string | null>(null);
    const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
    const selectedMaterialId = floorFinishes[region.id];
    const face = floorPaintSeparators[region.id];
    const sections = getWallPaintSections(face);

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
        displayMaterial.texture,
        displayMaterial
    );

    const geometry = useMemo(() => {
        const loops = region.boundaryLoops ?? [];

        if (loops.length === 0) {
            return null;
        }

        const outer = loops[0].corners.filter(Boolean);

        if (outer.length < 3) {
            return null;
        }

        const shape = new Shape();

        shape.moveTo(
            outer[0].x,
            -outer[0].z
        );

        for (
            let i = 1;
            i < outer.length;
            i++
        ) {
            shape.lineTo(
                outer[i].x,
                -outer[i].z
            );
        }

        shape.closePath();

        const holes = loops
            .slice(1)
            .map(loop => {
                const points = loop.corners.filter(Boolean);

                if (points.length < 3) {
                    return null;
                }

                const hole = new Path();

                hole.moveTo(
                    points[0].x,
                    -points[0].z
                );

                for (
                    let i = 1;
                    i < points.length;
                    i++
                ) {
                    hole.lineTo(
                        points[i].x,
                        -points[i].z
                    );
                }

                hole.closePath();

                return hole;
            })
            .filter(
                (hole): hole is Path =>
                    hole !== null
            );

        shape.holes = holes;

        return new ShapeGeometry(shape);
    }, [region.boundaryLoops]);

    const floorGeometry = useMemo(() => {
        const length = displayMaterial.length;
        const width = displayMaterial.width;
        if (
            !geometry ||
            displayMaterial.floorMaterialMode !== "single-tile" ||
            !isFloorPattern(displayMaterial.floorPattern) ||
            typeof length !== "number" ||
            typeof width !== "number"
        ) {
            return geometry;
        }

        const layout = createFloorPatternLayout(
            displayMaterial.floorPattern,
            length,
            width
        );
        const patternedGeometry = geometry.clone();
        const positions = patternedGeometry.getAttribute("position");
        const uvValues = new Float32Array(positions.count * 2);

        for (let index = 0; index < positions.count; index += 1) {
            const uv = getFloorPatternUV(
                positions.getX(index),
                positions.getY(index),
                layout
            );
            uvValues[index * 2] = uv.x;
            uvValues[index * 2 + 1] = uv.y;
        }

        patternedGeometry.setAttribute(
            "uv",
            new Float32BufferAttribute(uvValues, 2)
        );
        return patternedGeometry;
    }, [
        geometry,
        displayMaterial.floorMaterialMode,
        displayMaterial.floorPattern,
        displayMaterial.length,
        displayMaterial.width
    ]);

    useEffect(() => {
        if (!floorGeometry || floorGeometry === geometry) return;
        return () => floorGeometry.dispose();
    }, [floorGeometry, geometry]);

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
    const geometryBounds = useMemo(
        () => geometry ? getGeometryBounds(geometry) : null,
        [geometry]
    );
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
            {face?.separators.length && geometryBounds ? (
                sections.map(section => {
                    const sectionMaterial = materials.find(
                        material => material.id === face.sectionMaterials[section.id]
                    ) ?? displayMaterial;
                    return (
                        <AdminFloorSection
                            key={section.id}
                            sourceGeometry={geometry}
                            section={section}
                            bounds={geometryBounds}
                            material={sectionMaterial}
                            floorY={floorY}
                            floorId={floorId ?? region.id}
                            regionId={region.id}
                            onClick={handleClick}
                            onPointerOver={event => {
                                if (event.intersections[0]?.object !== event.object) return;
                                event.stopPropagation();
                                setHoveredSectionId(section.id);
                            }}
                            onPointerOut={() => {
                                setHoveredSectionId(current =>
                                    current === section.id ? null : current
                                );
                            }}
                        />
                    );
                })
            ) : (
                <mesh
                    geometry={floorGeometry ?? geometry}
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
                        color={displayMaterial.color ?? (floorTexture ? "#ffffff" : "#d9dde3")}
                        roughness={displayMaterial.roughness ?? 0.8}
                        metalness={displayMaterial.metalness ?? 0}
                        side={DoubleSide}
                    />
                </mesh>
            )}
            {face?.separators.map(separator => {
                if (!geometryBounds) return null;
                const points = getSeparatorLinePoints(
                    geometry,
                    separator.orientation,
                    separator.position,
                    geometryBounds,
                    floorY
                );
                const visible = selected || hoveredSeparatorId === separator.id;
                const hoveredSection = sections.find(
                    section => section.id === hoveredSectionId
                );
                const boundsHoveredSection = hoveredSection &&
                    (separator.orientation === "vertical"
                        ? Math.abs(hoveredSection.xStart - separator.position) < 1e-6 ||
                            Math.abs(hoveredSection.xEnd - separator.position) < 1e-6
                        : Math.abs(hoveredSection.yStart - separator.position) < 1e-6 ||
                            Math.abs(hoveredSection.yEnd - separator.position) < 1e-6);
                const guideVisible = visible || Boolean(boundsHoveredSection);
                return points.length > 0 ? (
                    <Line
                        key={separator.id}
                        points={points}
                        segments
                        color={selected || boundsHoveredSection ? "#2563EB" : "#374151"}
                        lineWidth={guideVisible ? 2.5 : 8}
                        transparent
                        opacity={guideVisible ? 0.95 : 0}
                        depthTest
                        depthWrite={false}
                        renderOrder={13}
                        onPointerOver={event => {
                            if (event.intersections[0]?.object !== event.object) return;
                            event.stopPropagation();
                            setHoveredSeparatorId(separator.id);
                        }}
                        onPointerOut={() => {
                            setHoveredSeparatorId(current =>
                                current === separator.id ? null : current
                            );
                        }}
                    />
                ) : null;
            })}
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