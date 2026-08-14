import { useMemo, useEffect } from "react";
import { Html, useTexture } from "@react-three/drei";

import {
    Shape,
    Path,
    ShapeGeometry,
    DoubleSide,
    RepeatWrapping,
    Vector3,
} from "three";

import type { Region } from "../../engine/regions/Polygon";

interface FloorProps {
    region: Region;
}

export default function Floor({
    region,
}: FloorProps) {

    const isChildRegion =
        Boolean(region.parentRegionId);

    const textures = useTexture({
        map: "/textures/floor/wood-color.png",
        normalMap: "/textures/floor/wood-normal.png",
        roughnessMap: "/textures/floor/wood-roughness.png",
    });

    /*
     * ----------------------------------------
     * Configure floor textures once loaded.
     * ----------------------------------------
     */

    useEffect(() => {

        Object.values(textures).forEach(texture => {

            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;

            texture.repeat.set(
                0.5,
                0.5
            );

            texture.needsUpdate = true;
        });

    }, [textures]);

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

    const floorCenter =
        useMemo(() => {

            const polygon =
                region.corners;

            if (
                !polygon ||
                polygon.length === 0
            ) {
                return new Vector3();
            }

            const sum =
                polygon.reduce(
                    (acc, point) => {

                        acc.x += point.x;
                        acc.z += point.z;

                        return acc;

                    },
                    {
                        x: 0,
                        z: 0,
                    }
                );

            return new Vector3(
                sum.x / polygon.length,
                0.05,
                sum.z / polygon.length
            );

        }, [region.corners]);

    /*
     * RegionSolver already calculated the
     * area after subtracting holes.
     *
     * Therefore DO NOT subtract child areas
     * again here.
     */

    const floorArea =
        Math.abs(
            region.area || 0
        );

    if (!geometry) {
        return null;
    }

    return (

        <group>

            <mesh
                geometry={geometry}
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
            >

                <meshStandardMaterial
                    map={textures.map}
                    normalMap={
                        textures.normalMap
                    }
                    roughnessMap={
                        textures.roughnessMap
                    }

                    metalness={0}

                    side={DoubleSide}

                    transparent={false}
opacity={1}
emissive="#000000"
emissiveIntensity={0}
                />

            </mesh>

            <Html
                position={floorCenter}
                center
                distanceFactor={10}
            >

                <div
                    style={{
                        background:
                            "rgba(255,255,255,0.92)",

                        border:
                            "1px solid #999",

                        borderRadius:
                            "6px",

                        padding:
                            "4px 8px",

                        fontSize:
                            "12px",

                        fontWeight:
                            700,

                        whiteSpace:
                            "nowrap",

                        pointerEvents:
                            "none",

                        userSelect:
                            "none",

                        boxShadow:
                            "0 2px 8px rgba(0,0,0,0.15)",

                        color:
                            "#111",
                    }}
                >

                    {floorArea.toFixed(2)} m²

                </div>

            </Html>

        </group>
    );
}