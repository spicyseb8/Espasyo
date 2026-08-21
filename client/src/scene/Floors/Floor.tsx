import { useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";

import {
    CanvasTexture,
    Shape,
    Path,
    ShapeGeometry,
    DoubleSide,
    RepeatWrapping,
    Vector3,
} from "three";

import useEditor from "../../context/editor/useEditor";

import type { Region } from "../../engine/regions/Polygon";
import { pointInPolygon } from "../../engine/regions/Polygon";
import { MaterialLibrary } from "../../engine/materials/MaterialLibrary";
interface FloorProps {
    region: Region;
}

/**
 * Shortest distance from a point to a line segment (in the XZ ground
 * plane).
 */
function distanceToSegment(p: Vector3, a: Vector3, b: Vector3): number {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = p.x - a.x;
    const apz = p.z - a.z;

    const lengthSq = abx * abx + abz * abz;
    const t = lengthSq > 0
        ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / lengthSq))
        : 0;

    const cx = a.x + t * abx;
    const cz = a.z + t * abz;

    const dx = p.x - cx;
    const dz = p.z - cz;

    return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Shortest distance from a point to any edge of a (closed) polygon.
 */
function distanceToPolygonBoundary(point: Vector3, polygon: Vector3[]): number {
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
 * Finds a good label anchor for a region: the point inside the region's
 * outer boundary (and outside every hole) that sits as far as possible
 * from any boundary - outer edges AND hole edges.
 *
 * This matters for nested regions (e.g. a small room cut out of a big
 * room): centering purely on the outer boundary's bounding box would put
 * both the parent's and the child's labels in roughly the same spot.
 * Maximizing distance from hole edges naturally pushes the parent's
 * label into whichever open pocket of floor is roomiest, away from the
 * child - no special-casing required.
 *
 * Falls back to the outer bounding-box center if nothing better is
 * found (e.g. degenerate geometry).
 *
 * Returns the anchor point plus its clearance (distance to the nearest
 * boundary), so callers can shrink the label further only when the
 * available pocket of floor is genuinely tight.
 */
function computeLabelAnchor(region: Region): { point: Vector3; clearance: number } {
    const outer = (region.corners ?? []).filter(Boolean);

    if (outer.length < 3) {
        return { point: new Vector3(), clearance: 0.5 };
    }

    const holes = (region.boundaryLoops ?? [])
        .slice(1)
        .map(loop => loop.corners.filter(Boolean))
        .filter(hole => hole.length >= 3);

    const minX = Math.min(...outer.map(p => p.x));
    const maxX = Math.max(...outer.map(p => p.x));
    const minZ = Math.min(...outer.map(p => p.z));
    const maxZ = Math.max(...outer.map(p => p.z));

    const fallback = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);

    // Grid search for the point with the largest clearance. Regions are
    // small in number and this only needs to run when the region's
    // shape changes, so a modest grid is cheap and plenty accurate for
    // label placement.
    const resolution = 20;
    const stepX = (maxX - minX) / resolution;
    const stepZ = (maxZ - minZ) / resolution;

    let best: { point: Vector3; clearance: number } | null = null;

    for (let i = 0; i <= resolution; i++) {
        for (let j = 0; j <= resolution; j++) {
            const point = new Vector3(minX + i * stepX, 0, minZ + j * stepZ);

            if (!pointInPolygon(point, outer)) {
                continue;
            }

            if (holes.some(hole => pointInPolygon(point, hole))) {
                continue;
            }

            const clearance = Math.min(
                distanceToPolygonBoundary(point, outer),
                ...holes.map(hole => distanceToPolygonBoundary(point, hole))
            );

            if (!best || clearance > best.clearance) {
                best = { point, clearance };
            }
        }
    }

    return best ?? { point: fallback, clearance: 0.5 };
}

export default function Floor({
    region,
}: FloorProps) {

    const { state, dispatch } = useEditor();

    const isChildRegion =
        Boolean(region.parentRegionId);
    const isSelected = state.selectedRegionId === region.id;

    const selectedMaterialId =
    state.floorFinishes[region.id];

const selectedMaterial =
    MaterialLibrary.find(
        material =>
            material.id ===
            selectedMaterialId &&
            material.category === "flooring"
    );
    const defaultFloorMaterial =
    MaterialLibrary.find(
        material =>
            material.category === "flooring"
    );

const textureUrl =
    selectedMaterial?.texture ??
    defaultFloorMaterial?.texture;

    const floorTexture =
    useTexture(
        textureUrl ??
        "/uploads/materials/flooring/ceramic-white.jpg"
    );
    /*
     * ----------------------------------------
     * Configure floor textures once loaded.
     * ----------------------------------------
     */

    useEffect(() => {

    floorTexture.wrapS =
        RepeatWrapping;

    floorTexture.wrapT =
        RepeatWrapping;

    floorTexture.repeat.set(
        1,
        1
    );

    floorTexture.needsUpdate = true;

}, [floorTexture]);

    /*
     * ----------------------------------------
     * Build floor geometry.
     *
     * boundaryLoops[0]
     *      = outer boundary
     *
     * boundaryLoops[1+]
     *      = holes
     * ----------------------------------------
     */

    const geometry = useMemo(() => {

        const loops =
            region.boundaryLoops ?? [];

        if (loops.length === 0) {
            return null;
        }

        const outer =
            loops[0].corners
                .filter(Boolean);

        if (outer.length < 3) {
            return null;
        }

        const shape =
            new Shape();

        /*
         * Outer boundary
         */

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

        /*
         * Holes
         */

        const holes =
            loops
                .slice(1)
                .map(loop => {

                    const points =
                        loop.corners
                            .filter(Boolean);

                    if (
                        points.length < 3
                    ) {
                        return null;
                    }

                    const hole =
                        new Path();

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
                    (
                        hole
                    ): hole is Path =>
                        hole !== null
                );

        shape.holes = holes;

        return new ShapeGeometry(
            shape
        );

    }, [region.boundaryLoops]);

    /*
     * ----------------------------------------
     * Measurement label position
     * ----------------------------------------
     */

    const labelAnchor = useMemo(
        () => computeLabelAnchor(region),
        [region.corners, region.boundaryLoops]
    );

    const floorArea = Math.abs(region.area || 0);

    // Fixed, small label size in world units - does NOT scale with the
    // room's area. Only shrinks below that fixed size when the anchor's
    // clearance (distance to the nearest outer edge or hole edge) is
    // tight, so it still fits inside whatever pocket of floor it landed
    // in without overlapping a neighboring region's label.
    const FLOOR_LABEL_WIDTH = 0.9;
    const FLOOR_LABEL_HEIGHT = 0.45;

    const labelWidth = Math.min(FLOOR_LABEL_WIDTH, labelAnchor.clearance * 1.7);
    const labelHeight = Math.min(FLOOR_LABEL_HEIGHT, labelAnchor.clearance * 0.85);

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
        const fontSize = 140;
        ctx.font = `800 ${fontSize}px Arial`;

        // Dark outline first so the small text stays legible over any
        // floor material, then a bright fill on top - reads as if it
        // were painted straight onto the floor rather than sitting in a
        // card.
        ctx.lineWidth = fontSize * 0.1;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.strokeText(label, size / 2, 256);

        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.fillText(label, size / 2, 256);

        const texture = new CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }, [floorArea]);

    if (!geometry) {
        return null;
    }

    return (

        <group>

            <mesh
                geometry={geometry}
                userData={{ isFloor: true }}
                position={[
                    0,
                    isChildRegion
                        ? 0.02
                        : 0,
                    0,
                ]}
                rotation={[
                    -Math.PI / 2,
                    0,
                    0,
                ]}
                onClick={(e) => {
                    e.stopPropagation();

                    dispatch({
                        type: "SELECT_REGION",
                        payload: region.id
                    });

                    dispatch({
                        type: "SELECT_WALL",
                        payload: null
                    });
                }}
            >

                <meshStandardMaterial
    map={floorTexture}
    metalness={0}
    roughness={0.8}
    side={DoubleSide}
    transparent={false}
    opacity={1}
    emissive={
        isSelected
            ? "#64b5f6"
            : "#000000"
    }
    emissiveIntensity={
        isSelected
            ? 0.45
            : 0
    }
/>

            </mesh>

            {measurementTexture && (
                <mesh
                    position={[
                        labelAnchor.point.x,
                        (isChildRegion ? 0.02 : 0) + 0.03,
                        labelAnchor.point.z,
                    ]}
                    rotation={[
                        -Math.PI / 2,
                        0,
                        0,
                    ]}
                >
                    <planeGeometry args={[labelWidth, labelHeight]} />
                    <meshBasicMaterial
                        map={measurementTexture}
                        transparent
                        depthWrite={false}
                        alphaTest={0.05}
                        side={DoubleSide}
                    />
                </mesh>
            )}

        </group>
    );
}