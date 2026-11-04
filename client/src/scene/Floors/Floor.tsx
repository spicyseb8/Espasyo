
import {
    useMemo,
    useEffect,
    useState
} from "react";

import {
    CanvasTexture,
    Float32BufferAttribute,
    Shape,
    Path,
    ShapeGeometry,
    DoubleSide,
    BufferGeometry,
    Vector3,
    SRGBColorSpace
} from "three";

import {
    Line
} from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

import type {
    Texture
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import type {
    Region
} from "../../engine/regions/Polygon";

import {
    pointInPolygon
} from "../../engine/regions/Polygon";

import type {
    Material
} from "../../engine/materials/MaterialTypes";

import {
    createFloorPatternLayout,
    getFloorPatternUV,
    isFloorPattern
} from "../../../../shared/flooring/patterns";

import {
    DEFAULT_FLOOR_MATERIAL_ID,
    LOCAL_DEFAULT_FLOOR_TEXTURE,
    getCachedFloorPatternTexture,
    getCachedFloorTexture,
    preloadFloorPatternTexture,
    preloadFloorTexture
} from "../../engine/materials/floors";
import {
    addWallPaintSeparator,
    clipFloorTriangleToSection,
    getWallPaintSections,
    isValidWallPaintSeparatorPosition,
    type WallPaintSection,
    type WallPaintSeparator
} from "../../../../shared/wallPaintSeparators";

interface FloorProps {
    region: Region;
    materials: Material[];
}

function distanceToSegment(
    p: Vector3,
    a: Vector3,
    b: Vector3
): number {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = p.x - a.x;
    const apz = p.z - a.z;

    const lengthSq = abx * abx + abz * abz;

    const t = lengthSq > 0
        ? Math.max(
            0,
            Math.min(
                1,
                (apx * abx + apz * abz) / lengthSq
            )
        )
        : 0;

    const cx = a.x + t * abx;
    const cz = a.z + t * abz;
    const dx = p.x - cx;
    const dz = p.z - cz;

    return Math.sqrt(dx * dx + dz * dz);
}

function distanceToPolygonBoundary(
    point: Vector3,
    polygon: Vector3[]
): number {
    let minDist = Infinity;

    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];

        const dist = distanceToSegment(point, a, b);

        if (dist < minDist) {
            minDist = dist;
        }
    }

    return minDist;
}

/**
 * Calculates the geometric centroid of a polygon.
 */
function getPolygonCentroid(
    polygon: Vector3[]
): {
    point: Vector3;
    area: number;
} | null {
    if (polygon.length < 3) {
        return null;
    }

    let crossSum = 0;
    let centroidX = 0;
    let centroidZ = 0;

    for (let i = 0; i < polygon.length; i++) {
        const current = polygon[i];
        const next = polygon[(i + 1) % polygon.length];

        const cross =
            current.x * next.z -
            next.x * current.z;

        crossSum += cross;

        centroidX +=
            (current.x + next.x) * cross;

        centroidZ +=
            (current.z + next.z) * cross;
    }

    if (Math.abs(crossSum) < 0.000001) {
        return null;
    }

    return {
        point: new Vector3(
            centroidX / (3 * crossSum),
            0,
            centroidZ / (3 * crossSum)
        ),
        area: Math.abs(crossSum) / 2
    };
}

function computeLabelAnchor(
    region: Region
): {
    point: Vector3;
    clearance: number;
} {
    const outer = (region.corners ?? []).filter(Boolean);

    if (outer.length < 3) {
        return {
            point: new Vector3(),
            clearance: 0.5
        };
    }

    const holes = (region.boundaryLoops ?? [])
        .slice(1)
        .map(loop => loop.corners.filter(Boolean))
        .filter(hole => hole.length >= 3);

    const minX = Math.min(...outer.map(p => p.x));
    const maxX = Math.max(...outer.map(p => p.x));
    const minZ = Math.min(...outer.map(p => p.z));
    const maxZ = Math.max(...outer.map(p => p.z));

    const fallback = new Vector3(
        (minX + maxX) / 2,
        0,
        (minZ + maxZ) / 2
    );

    const resolution = 20;
    const stepX = (maxX - minX) / resolution;
    const stepZ = (maxZ - minZ) / resolution;

    let best: {
        point: Vector3;
        clearance: number;
    } | null = null;

    // Find a safe point inside the room, away from walls and openings.
    for (let i = 0; i <= resolution; i++) {
        for (let j = 0; j <= resolution; j++) {
            const point = new Vector3(
                minX + i * stepX,
                0,
                minZ + j * stepZ
            );

            if (!pointInPolygon(point, outer)) {
                continue;
            }

            if (
                holes.some(hole =>
                    pointInPolygon(point, hole)
                )
            ) {
                continue;
            }

            const clearance = Math.min(
                distanceToPolygonBoundary(point, outer),
                ...holes.map(hole =>
                    distanceToPolygonBoundary(point, hole)
                )
            );

            if (!best || clearance > best.clearance) {
                best = {
                    point,
                    clearance
                };
            }
        }
    }

    if (!best) {
        return {
            point: fallback,
            clearance: 0.5
        };
    }

    // Prefer the actual area centroid when it is inside the room
    // and reasonably far from the boundary.
    const outerCentroid = getPolygonCentroid(outer);

    if (outerCentroid) {
        let totalArea = outerCentroid.area;
        let centroidX =
            outerCentroid.point.x * outerCentroid.area;
        let centroidZ =
            outerCentroid.point.z * outerCentroid.area;

        for (const hole of holes) {
            const holeCentroid = getPolygonCentroid(hole);

            if (!holeCentroid) {
                continue;
            }

            totalArea -= holeCentroid.area;

            centroidX -=
                holeCentroid.point.x * holeCentroid.area;

            centroidZ -=
                holeCentroid.point.z * holeCentroid.area;
        }

        if (totalArea > 0.000001) {
            const center = new Vector3(
                centroidX / totalArea,
                0,
                centroidZ / totalArea
            );

            const centerIsInside =
                pointInPolygon(center, outer) &&
                !holes.some(hole =>
                    pointInPolygon(center, hole)
                );

            if (centerIsInside) {
                const clearance = Math.min(
                    distanceToPolygonBoundary(center, outer),
                    ...holes.map(hole =>
                        distanceToPolygonBoundary(center, hole)
                    )
                );

                // Keep the centered position when it is suitable
                // for the label; otherwise use the safer point.
                if (clearance >= best.clearance * 0.65) {
                    return {
                        point: center,
                        clearance
                    };
                }
            }
        }
    }

    return best;
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

function getFloorGeometryBounds(geometry: BufferGeometry): FloorGeometryBounds {
    const position = geometry.getAttribute("position");
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };
    for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index);
        const y = position.getY(index);
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
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
    const position = source.getAttribute("position");
    const index = source.getIndex();
    const triangleCount = index ? index.count / 3 : position.count / 3;
    const points: number[] = [];
    const uvs: number[] = [];
    const layout = material.floorMaterialMode === "single-tile" &&
        isFloorPattern(material.floorPattern) &&
        typeof material.length === "number" &&
        typeof material.width === "number"
        ? createFloorPatternLayout(material.floorPattern, material.length, material.width)
        : null;

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const indices = [0, 1, 2].map(offset => {
            const vertex = triangle * 3 + offset;
            return index ? index.getX(vertex) : vertex;
        });
        const clipped = clipFloorTriangleToSection(
            indices.map(vertex => ({
                x: position.getX(vertex),
                y: position.getY(vertex)
            })) as [ { x: number; y: number }, { x: number; y: number }, { x: number; y: number } ],
            sectionBounds
        );
        if (clipped.length < 3) continue;
        for (let pointIndex = 1; pointIndex < clipped.length - 1; pointIndex += 1) {
            for (const point of [clipped[0], clipped[pointIndex], clipped[pointIndex + 1]]) {
                points.push(point.x, point.y, 0);
                const uv = layout
                    ? getFloorPatternUV(point.x, point.y, layout)
                    : { x: point.x, y: point.y };
                uvs.push(uv.x, uv.y);
            }
        }
    }

    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(points, 3));
    result.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    result.computeVertexNormals();
    return result;
}

function getSeparatorLinePoints(
    geometry: BufferGeometry,
    separator: WallPaintSeparator,
    bounds: FloorGeometryBounds,
    floorY: number
): Vector3[] {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const triangleCount = index ? index.count / 3 : position.count / 3;
    const coordinate = separator.position * (
        separator.orientation === "vertical"
            ? bounds.maxX - bounds.minX
            : bounds.maxY - bounds.minY
    ) + (
        separator.orientation === "vertical"
            ? bounds.minX
            : bounds.minY
    );
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
        const axis = separator.orientation === "vertical" ? "x" : "y";
        const intersections: Vector3[] = [];
        for (let edge = 0; edge < 3; edge += 1) {
            const start = vertices[edge];
            const end = vertices[(edge + 1) % 3];
            const startDelta = start[axis] - coordinate;
            const endDelta = end[axis] - coordinate;
            if (startDelta * endDelta > 0 || Math.abs(startDelta - endDelta) < 1e-10) {
                continue;
            }
            const amount = startDelta / (startDelta - endDelta);
            const point = start.clone().lerp(end, amount);
            if (!intersections.some(existing => existing.distanceTo(point) < 1e-5)) {
                intersections.push(point);
            }
        }
        if (intersections.length >= 2) {
            for (const point of intersections.slice(0, 2)) {
                points.push(new Vector3(
                    point.x,
                    floorY + 0.008,
                    -point.y
                ));
            }
        }
    }
    return points;
}

function FloorSectionSurface({
    sourceGeometry,
    bounds,
    section,
    material,
    floorY,
    selected,
    onClick,
    onPointerMove,
    onPointerOut
}: {
    sourceGeometry: BufferGeometry;
    bounds: FloorGeometryBounds;
    section: WallPaintSection;
    material: Material;
    floorY: number;
    selected: boolean;
    onClick: (event: ThreeEvent<MouseEvent>) => void;
    onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
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
        <group>
            <mesh
                geometry={geometry}
                position={[0, floorY + 0.004, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                userData={{ isFloor: true }}
                receiveShadow
                onClick={onClick}
                onPointerMove={onPointerMove}
                onPointerOut={onPointerOut}
            >
                <meshStandardMaterial
                    map={texture}
                    color={material.color ?? (texture ? "#ffffff" : "#d9dde3")}
                    metalness={material.metalness ?? 0}
                    roughness={material.roughness ?? 0.8}
                    side={DoubleSide}
                />
            </mesh>
            {selected && (
                <mesh
                    geometry={geometry}
                    position={[0, floorY + 0.01, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    raycast={() => {}}
                    renderOrder={12}
                >
                    <meshBasicMaterial
                        color="#2563EB"
                        transparent
                        opacity={0.28}
                        depthWrite={false}
                        side={DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}

function useFloorOutlineLoops(
    region: Region,
    floorY: number,
    inset: number = 0.03
): Vector3[][] {
    return useMemo(() => {
        const loops = region.boundaryLoops ?? [];

        return loops
            .map(loop => {
                const corners = loop.corners.filter(Boolean);

                if (corners.length < 2) {
                    return [];
                }

                const center = corners.reduce(
                    (result, corner) => {
                        result.x += corner.x;
                        result.z += corner.z;
                        return result;
                    },
                    new Vector3()
                );

                center.x /= corners.length;
                center.z /= corners.length;

                return corners.map(corner => {
                    const direction = new Vector3(
                        center.x - corner.x,
                        0,
                        center.z - corner.z
                    );

                    const distance = Math.sqrt(
                        direction.x * direction.x +
                        direction.z * direction.z
                    );

                    if (distance < 0.0001) {
                        return new Vector3(
                            corner.x,
                            floorY + 0.006,
                            corner.z
                        );
                    }

                    direction.x /= distance;
                    direction.z /= distance;

                    return new Vector3(
                        corner.x + direction.x * inset,
                        floorY + 0.006,
                        corner.z + direction.z * inset
                    );
                });
            })
            .filter(points => points.length >= 2);
    }, [
        region.boundaryLoops,
        floorY,
        inset
    ]);
}

export default function Floor({
    region,
    materials
}: FloorProps) {
    const { state, dispatch } = useEditor();
    const [previewPosition, setPreviewPosition] = useState<number | null>(null);
    const [hoveredSeparatorId, setHoveredSeparatorId] = useState<string | null>(null);

    const isChildRegion = Boolean(region.parentRegionId);

    const selectedMaterialId =
        state.floorFinishes[region.id];
    const face = state.floorPaintSeparators[region.id];
    const sections = useMemo(
        () => getWallPaintSections(face),
        [face]
    );
    const selectedSection = sections.find(
        section => section.id === state.selectedFloorSectionId &&
            state.selectedRegionId === region.id
    );
    const isSelected =
        state.selectedRegionId === region.id && !selectedSection;

    const selectedMaterial = materials.find(
        material => material.id === selectedMaterialId
    );

    const firebaseDefaultMaterial = materials.find(
        material =>
            material.id === DEFAULT_FLOOR_MATERIAL_ID
    );

    const defaultFloorMaterial: Material = firebaseDefaultMaterial
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
        selectedMaterial ?? defaultFloorMaterial;

    const textureUrl = displayMaterial?.texture;

    const floorTexture = useFloorTexture(textureUrl, displayMaterial);

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

        shape.moveTo(outer[0].x, -outer[0].z);

        for (let i = 1; i < outer.length; i++) {
            shape.lineTo(outer[i].x, -outer[i].z);
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

                hole.moveTo(points[0].x, -points[0].z);

                for (let i = 1; i < points.length; i++) {
                    hole.lineTo(points[i].x, -points[i].z);
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

    const labelAnchor = useMemo(
        () => computeLabelAnchor(region),
        [
            region.corners,
            region.boundaryLoops
        ]
    );

    const floorArea = Math.abs(region.area || 0);

    // Larger label dimensions, limited by available room space.
    const FLOOR_LABEL_WIDTH = 1.4;
    const FLOOR_LABEL_HEIGHT = 0.62;

    const labelWidth = Math.min(
        FLOOR_LABEL_WIDTH,
        labelAnchor.clearance * 1.7
    );

    const labelHeight = Math.min(
        FLOOR_LABEL_HEIGHT,
        labelAnchor.clearance * 0.85
    );

    const measurementTexture = useMemo(() => {
        const canvas = document.createElement("canvas");
        const size = 1024;

        canvas.width = size;
        canvas.height = 512;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return null;
        }

        ctx.clearRect(0, 0, size, 512);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";

        const label = `${floorArea.toFixed(2)} m²`;
        const fontSize = 170;

        ctx.font = `900 ${fontSize}px Arial`;

        // Strong dark outline so the text stays clear over every finish.
        ctx.lineWidth = 22;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
        ctx.strokeText(label, size / 2, 256);

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(label, size / 2, 256);

        const texture = new CanvasTexture(canvas);

        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;

        return texture;
    }, [floorArea]);

    // Release the GPU texture when its displayed area changes or
    // this floor component unmounts.
    useEffect(() => {
        return () => {
            measurementTexture?.dispose();
        };
    }, [measurementTexture]);

    const floorY = isChildRegion ? 0.02 : 0;
    const geometryBounds = useMemo(
        () => geometry ? getFloorGeometryBounds(geometry) : null,
        [geometry]
    );

    const floorOutlineLoops = useFloorOutlineLoops(
        region,
        floorY,
        0.1
    );

    if (!geometry) {
        return null;
    }

    const getNormalizedPosition = (
        point: Vector3,
        orientation: "vertical" | "horizontal"
    ) => {
        if (!geometryBounds) return null;
        const range = orientation === "vertical"
            ? geometryBounds.maxX - geometryBounds.minX
            : geometryBounds.maxY - geometryBounds.minY;
        if (range <= 0.000001) return null;
        const coordinate = orientation === "vertical"
            ? point.x
            : -point.z;
        const minimum = orientation === "vertical"
            ? geometryBounds.minX
            : geometryBounds.minY;
        return Math.max(0, Math.min(1, (coordinate - minimum) / range));
    };

    const handleFloorPointerMove = (event: ThreeEvent<PointerEvent>) => {
        const orientation = state.wallSeparatorPlacement;
        if (!orientation) {
            setPreviewPosition(null);
            return;
        }
        event.stopPropagation();
        setPreviewPosition(getNormalizedPosition(event.point, orientation));
    };

    const placeFloorSeparator = (point: Vector3) => {
        const orientation = state.wallSeparatorPlacement;
        if (!orientation || !geometryBounds) return;
        const position = getNormalizedPosition(point, orientation);
        if (
            position === null ||
            !isValidWallPaintSeparatorPosition(
                face?.separators ?? [],
                orientation,
                position
            )
        ) {
            return;
        }
        const nextFace = addWallPaintSeparator(
            face,
            {
                id: crypto.randomUUID(),
                orientation,
                position
            },
            selectedMaterialId
        );
        if (!nextFace) return;
        dispatch({
            type: "SET_FLOOR_PAINT_FACE",
            payload: {
                regionId: region.id,
                face: {
                    ...nextFace,
                    floorId: state.activeFloorId,
                    surfaceType: "floor",
                    surfaceId: region.id
                }
            }
        });
        dispatch({
            type: "SET_WALL_SEPARATOR_PLACEMENT",
            payload: null
        });
    };

    const handleFloorSurfaceClick = (
        event: ThreeEvent<MouseEvent>,
        sectionId?: string
    ) => {
        event.stopPropagation();
        if (state.wallSeparatorPlacement) {
            placeFloorSeparator(event.point);
            return;
        }
        if (sectionId) {
            dispatch({
                type: "SELECT_FLOOR_SECTION",
                payload: { regionId: region.id, sectionId }
            });
        } else {
            dispatch({
                type: "SELECT_REGION",
                payload: region.id
            });
        }
    };

    const selectedMaterialForSection = (
        sectionId: string
    ) => materials.find(
        material => material.id === face?.sectionMaterials[sectionId]
    ) ?? displayMaterial;

    return (
        <group>
            {/* Actual floor and its applied material */}
            {geometryBounds && face?.separators.length ? (
                sections.map(section => (
                    <FloorSectionSurface
                        key={section.id}
                        sourceGeometry={geometry}
                        bounds={geometryBounds}
                        section={section}
                        material={selectedMaterialForSection(section.id)}
                        floorY={floorY}
                        selected={selectedSection?.id === section.id}
                        onPointerMove={handleFloorPointerMove}
                        onPointerOut={() => setPreviewPosition(null)}
                        onClick={event => handleFloorSurfaceClick(event, section.id)}
                    />
                ))
            ) : (
                <mesh
                    geometry={floorGeometry ?? geometry}
                    userData={{ isFloor: true }}
                    position={[0, floorY, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    receiveShadow
                    onPointerMove={handleFloorPointerMove}
                    onPointerOut={() => setPreviewPosition(null)}
                    onClick={event => handleFloorSurfaceClick(event)}
                >
                    <meshStandardMaterial
                        key={floorTexture ? "textured" : "untextured"}
                        map={floorTexture}
                        color={displayMaterial?.color ?? (floorTexture ? "#ffffff" : "#d9dde3")}
                        metalness={displayMaterial?.metalness ?? 0}
                        roughness={displayMaterial?.roughness ?? 0.8}
                        side={DoubleSide}
                    />
                </mesh>
            )}

            {geometryBounds && (face?.separators ?? []).map(separator => {
                const points = getSeparatorLinePoints(
                    geometry,
                    separator,
                    geometryBounds,
                    floorY
                );
                if (points.length === 0) return null;
                const selected = state.selectedRegionId === region.id &&
                    state.selectedFloorSeparatorId === separator.id;
                const boundsSelectedSection = selectedSection &&
                    (separator.orientation === "vertical"
                        ? Math.abs(selectedSection.xStart - separator.position) < 1e-6 ||
                            Math.abs(selectedSection.xEnd - separator.position) < 1e-6
                        : Math.abs(selectedSection.yStart - separator.position) < 1e-6 ||
                            Math.abs(selectedSection.yEnd - separator.position) < 1e-6);
                const guideVisible = selected || Boolean(boundsSelectedSection) ||
                    hoveredSeparatorId === separator.id;
                return (
                    <Line
                        key={separator.id}
                        points={points}
                        segments
                        color={selected || boundsSelectedSection ? "#2563EB" : "#374151"}
                        lineWidth={guideVisible
                            ? selected || boundsSelectedSection ? 3.5 : 2.5
                            : 8}
                        transparent
                        opacity={guideVisible ? 0.95 : 0}
                        depthTest
                        depthWrite={false}
                        renderOrder={13}
                        raycast={state.wallSeparatorPlacement ? () => {} : undefined}
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
                        onClick={event => {
                            if (event.intersections[0]?.object !== event.object) return;
                            event.stopPropagation();
                            if (state.wallSeparatorPlacement) {
                                placeFloorSeparator(event.point);
                                return;
                            }
                            dispatch({
                                type: "SELECT_FLOOR_SEPARATOR",
                                payload: {
                                    regionId: region.id,
                                    separatorId: separator.id
                                }
                            });
                        }}
                    />
                );
            })}

            {geometryBounds &&
                state.wallSeparatorPlacement &&
                previewPosition !== null &&
                getSeparatorLinePoints(
                    geometry,
                    {
                        id: "preview",
                        orientation: state.wallSeparatorPlacement,
                        position: previewPosition
                    },
                    geometryBounds,
                    floorY
                ).length > 0 && (
                    <Line
                        points={getSeparatorLinePoints(
                            geometry,
                            {
                                id: "preview",
                                orientation: state.wallSeparatorPlacement,
                                position: previewPosition
                            },
                            geometryBounds,
                            floorY
                        )}
                        segments
                        color={isValidWallPaintSeparatorPosition(
                            face?.separators ?? [],
                            state.wallSeparatorPlacement,
                            previewPosition
                        ) ? "#F59E0B" : "#DC2626"}
                        lineWidth={3}
                        depthTest
                        depthWrite={false}
                        renderOrder={13}
                        raycast={() => {}}
                    />
                )}

            {/* Selection tint */}
            {isSelected && (
                <mesh
                    geometry={geometry}
                    position={[
                        0,
                        floorY + 0.008,
                        0
                    ]}
                    rotation={[
                        -Math.PI / 2,
                        0,
                        0
                    ]}
                    renderOrder={10}
                >
                    <meshBasicMaterial
                        color="#808080"
                        transparent
                        opacity={0.25}
                        depthWrite={false}
                        side={DoubleSide}
                    />
                </mesh>
            )}

            {/* Selection outline */}
            {isSelected &&
                floorOutlineLoops.map((points, index) => (
                    <Line
                        key={`floor-outline-${index}`}
                        points={[
                            ...points,
                            points[0]
                        ]}
                        color="#7e7d7d"
                        lineWidth={10}
                        transparent
                        opacity={0.95}
                    />
                ))}

            {/* Area measurement: visible only for the selected floor */}
            {isSelected &&
                measurementTexture &&
                labelWidth > 0 &&
                labelHeight > 0 && (
                    <mesh
                        position={[
                            labelAnchor.point.x,
                            floorY + 0.035,
                            labelAnchor.point.z
                        ]}
                        rotation={[
                            -Math.PI / 2,
                            0,
                            0
                        ]}
                        renderOrder={1000}
                        frustumCulled={false}
                    >
                        <planeGeometry
                            args={[
                                labelWidth,
                                labelHeight
                            ]}
                        />

                        <meshBasicMaterial
                            map={measurementTexture}
                            transparent
                            depthTest
                            depthWrite={false}
                            toneMapped={false}
                            alphaTest={0.05}
                            side={DoubleSide}
                        />
                    </mesh>
                )}
        </group>
    );
}
