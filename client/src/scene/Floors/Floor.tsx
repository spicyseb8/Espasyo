import {
    useMemo,
    useEffect,
    useState
} from "react";

import {
    CanvasTexture,
    Shape,
    Path,
    ShapeGeometry,
    DoubleSide,
    Vector3
} from "three";

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
    DEFAULT_FLOOR_MATERIAL_ID,
    getCachedFloorTexture,
    preloadFloorTexture
} from "../../engine/materials/floors";

interface FloorProps {

    region: Region;

    materials: Material[];

}


//==================================================
// DEFAULT FLOOR
//==================================================
//
// Firebase document:
//
// id: A-26015
// name: Terrazo Tiles
// category: tiles
//
// DEFAULT_FLOOR_MATERIAL_ID is imported from
// floors.ts so the ID only exists in ONE place.
//
// This material will be used automatically for a
// newly created room when no floor has been selected.
//==================================================


//==================================================
// SHORT DISTANCE TO LINE SEGMENT
//==================================================

function distanceToSegment(
    p: Vector3,
    a: Vector3,
    b: Vector3
): number {

    const abx =
        b.x - a.x;

    const abz =
        b.z - a.z;

    const apx =
        p.x - a.x;

    const apz =
        p.z - a.z;

    const lengthSq =
        abx * abx +
        abz * abz;

    const t =
        lengthSq > 0

            ? Math.max(
                0,
                Math.min(
                    1,
                    (
                        apx * abx +
                        apz * abz
                    ) / lengthSq
                )
            )

            : 0;

    const cx =
        a.x +
        t * abx;

    const cz =
        a.z +
        t * abz;

    const dx =
        p.x - cx;

    const dz =
        p.z - cz;

    return Math.sqrt(
        dx * dx +
        dz * dz
    );
}


//==================================================
// SHORT DISTANCE TO POLYGON BOUNDARY
//==================================================

function distanceToPolygonBoundary(
    point: Vector3,
    polygon: Vector3[]
): number {

    let minDist =
        Infinity;

    for (
        let i = 0;
        i < polygon.length;
        i++
    ) {

        const a =
            polygon[i];

        const b =
            polygon[
                (i + 1) %
                polygon.length
            ];

        const dist =
            distanceToSegment(
                point,
                a,
                b
            );

        if (
            dist < minDist
        ) {

            minDist =
                dist;
        }
    }

    return minDist;
}


//==================================================
// FLOOR LABEL ANCHOR
//==================================================

function computeLabelAnchor(
    region: Region
): {
    point: Vector3;
    clearance: number;
} {

    const outer =
        (region.corners ?? [])
            .filter(Boolean);

    if (
        outer.length < 3
    ) {

        return {
            point:
                new Vector3(),

            clearance:
                0.5
        };
    }

    const holes =
        (region.boundaryLoops ?? [])

            .slice(1)

            .map(
                loop =>
                    loop.corners
                        .filter(Boolean)
            )

            .filter(
                hole =>
                    hole.length >= 3
            );

    const minX =
        Math.min(
            ...outer.map(
                p => p.x
            )
        );

    const maxX =
        Math.max(
            ...outer.map(
                p => p.x
            )
        );

    const minZ =
        Math.min(
            ...outer.map(
                p => p.z
            )
        );

    const maxZ =
        Math.max(
            ...outer.map(
                p => p.z
            )
        );

    const fallback =
        new Vector3(
            (minX + maxX) / 2,
            0,
            (minZ + maxZ) / 2
        );

    const resolution =
        20;

    const stepX =
        (
            maxX - minX
        ) / resolution;

    const stepZ =
        (
            maxZ - minZ
        ) / resolution;

    let best:
        {
            point: Vector3;
            clearance: number;
        } | null =
        null;

    for (
        let i = 0;
        i <= resolution;
        i++
    ) {

        for (
            let j = 0;
            j <= resolution;
            j++
        ) {

            const point =
                new Vector3(
                    minX +
                    i * stepX,

                    0,

                    minZ +
                    j * stepZ
                );

            if (
                !pointInPolygon(
                    point,
                    outer
                )
            ) {

                continue;
            }

            if (
                holes.some(
                    hole =>
                        pointInPolygon(
                            point,
                            hole
                        )
                )
            ) {

                continue;
            }

            const clearance =
                Math.min(

                    distanceToPolygonBoundary(
                        point,
                        outer
                    ),

                    ...holes.map(
                        hole =>
                            distanceToPolygonBoundary(
                                point,
                                hole
                            )
                    )

                );

            if (
                !best ||
                clearance >
                best.clearance
            ) {

                best = {

                    point,

                    clearance

                };
            }
        }
    }

    return (
        best ?? {
            point:
                fallback,

            clearance:
                0.5
        }
    );
}


//==================================================
// FLOOR TEXTURE HOOK
//==================================================
//
// Replaces Drei's useTexture().
//
// useTexture() suspends the Canvas while loading and
// keeps its OWN cache, so the texture that Floors.tsx
// already preloaded through floors.ts was never
// reused. This hook reads floors.ts's shared cache
// instead:
//
// - Already preloaded  -> returned immediately.
// - Not loaded yet     -> loaded in the background.
//                         The PREVIOUS texture stays
//                         visible until the new one is
//                         ready (no blank flash).
// - Failed to load     -> null.
//
// Wrap, repeat and color space are already configured
// by preloadFloorTexture(), so nothing is set here.
//==================================================

function useFloorTexture(
    url?: string
): Texture | null {

    const [
        loadedTexture,
        setLoadedTexture
    ] = useState<Texture | null>(
        null
    );


    useEffect(() => {

        if (
            !url
        ) {

            return;
        }


        let cancelled =
            false;


        preloadFloorTexture(
            url
        ).then(
            texture => {

                if (
                    !cancelled
                ) {

                    setLoadedTexture(
                        texture
                    );
                }

            }
        );


        return () => {

            cancelled =
                true;

        };

    }, [
        url
    ]);


    if (
        !url
    ) {

        return null;
    }


    return (
        getCachedFloorTexture(
            url
        ) ??
        loadedTexture
    );
}


//==================================================
// FLOOR
//==================================================

export default function Floor({
    region,
    materials
}: FloorProps) {

    const {
        state,
        dispatch
    } = useEditor();


    const isChildRegion =
        Boolean(
            region.parentRegionId
        );


    const isSelected =
        state.selectedRegionId ===
        region.id;


    //==================================================
    // SELECTED FLOOR MATERIAL
    //==================================================

    const selectedMaterialId =
        state.floorFinishes[
            region.id
        ];


    const selectedMaterial =
        materials.find(
            material =>
                material.id ===
                selectedMaterialId
        );


    //==================================================
    // DEFAULT FLOOR MATERIAL
    //==================================================
    //
    // When the room has no manually selected flooring,
    // use Terrazo Tiles (A-26015).
    //
    // If that Firebase material is temporarily unavailable
    // (or has no diffuse PNG), use the first loaded
    // Firebase material as a fallback.
    //==================================================

    const defaultFloorMaterial =
        materials.find(
            material =>
                material.id ===
                DEFAULT_FLOOR_MATERIAL_ID
        ) ??
        materials[0];


    //==================================================
    // FINAL MATERIAL
    //
    // Priority:
    //
    // 1. User-selected floor
    // 2. Terrazo Tiles (A-26015)
    // 3. First Firebase floor as fallback
    //==================================================

    const displayMaterial =
        selectedMaterial ??
        defaultFloorMaterial;


    //==================================================
    // TEXTURE
    //==================================================
    //
    // Every Firebase floor is a diffuse PNG now, so
    // displayMaterial.texture is always set once a
    // material exists. It is only undefined while the
    // materials are still loading.
    //==================================================

    const textureUrl =
        displayMaterial?.texture;


    const floorTexture =
        useFloorTexture(
            textureUrl
        );


    //==================================================
    // BUILD FLOOR GEOMETRY
    //==================================================

    const geometry =
        useMemo(() => {

            const loops =
                region.boundaryLoops ??
                [];

            if (
                loops.length === 0
            ) {

                return null;
            }

            const outer =
                loops[0].corners
                    .filter(Boolean);

            if (
                outer.length < 3
            ) {

                return null;
            }

            const shape =
                new Shape();


            //==================================================
            // OUTER BOUNDARY
            //==================================================

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


            //==================================================
            // HOLES
            //==================================================

            const holes =
                loops

                    .slice(1)

                    .map(
                        loop => {

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

                        }
                    )

                    .filter(
                        (
                            hole
                        ): hole is Path =>
                            hole !== null
                    );


            shape.holes =
                holes;


            return new ShapeGeometry(
                shape
            );

        }, [
            region.boundaryLoops
        ]);


    //==================================================
    // LABEL POSITION
    //==================================================

    const labelAnchor =
        useMemo(
            () =>
                computeLabelAnchor(
                    region
                ),

            [
                region.corners,
                region.boundaryLoops
            ]
        );


    const floorArea =
        Math.abs(
            region.area || 0
        );


    const FLOOR_LABEL_WIDTH =
        0.9;


    const FLOOR_LABEL_HEIGHT =
        0.45;


    const labelWidth =
        Math.min(
            FLOOR_LABEL_WIDTH,
            labelAnchor.clearance *
            1.7
        );


    const labelHeight =
        Math.min(
            FLOOR_LABEL_HEIGHT,
            labelAnchor.clearance *
            0.85
        );


    //==================================================
    // MEASUREMENT LABEL
    //==================================================

    const measurementTexture =
        useMemo(() => {

            const canvas =
                document.createElement(
                    "canvas"
                );

            const size =
                1024;

            canvas.width =
                size;

            canvas.height =
                512;


            const ctx =
                canvas.getContext(
                    "2d"
                );

            if (
                !ctx
            ) {

                return null;
            }


            ctx.clearRect(
                0,
                0,
                size,
                512
            );


            ctx.textAlign =
                "center";

            ctx.textBaseline =
                "middle";

            ctx.lineJoin =
                "round";


            const label =
                `${floorArea.toFixed(2)} m²`;


            const fontSize =
                140;


            ctx.font =
                `800 ${fontSize}px Arial`;


            ctx.lineWidth =
                fontSize * 0.1;


            ctx.strokeStyle =
                "rgba(0, 0, 0, 0.45)";


            ctx.strokeText(
                label,
                size / 2,
                256
            );


            ctx.fillStyle =
                "rgba(255, 255, 255, 0.96)";


            ctx.fillText(
                label,
                size / 2,
                256
            );


            const texture =
                new CanvasTexture(
                    canvas
                );

            texture.needsUpdate =
                true;


            return texture;

        }, [
            floorArea
        ]);


    if (
        !geometry
    ) {

        return null;
    }


    //==================================================
    // RENDER
    //==================================================

    return (

        <group>

            {/* ------------------------------------------
                ACTUAL FLOOR
            ------------------------------------------ */}

            <mesh

                geometry={
                    geometry
                }

                userData={{
                    isFloor: true
                }}

                position={[
                    0,

                    isChildRegion
                        ? 0.02
                        : 0,

                    0
                ]}

                rotation={[
                    -Math.PI / 2,
                    0,
                    0
                ]}

                receiveShadow

                onClick={(e) => {

                    e.stopPropagation();

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
                            null

                    });

                }}

            >

                {/*
                    key: three.js does NOT recompile a material
                    when its "map" changes between null and a
                    texture, so the floor could stay untextured
                    after the image finishes loading. Changing
                    the key creates a fresh material at that
                    moment.

                    color: the color is MULTIPLIED with the
                    diffuse image, so a textured floor uses
                    white (true PNG colors). The old default
                    "#d9dde3" would have tinted every PNG
                    gray-blue. The gray color is only used
                    while no texture is available.
                */}

                <meshStandardMaterial

                    key={
                        floorTexture
                            ? "textured"
                            : "untextured"
                    }

                    map={
                        floorTexture
                    }

                    color={
                        displayMaterial?.color ??
                        (
                            floorTexture
                                ? "#ffffff"
                                : "#d9dde3"
                        )
                    }

                    metalness={
                        displayMaterial?.metalness ??
                        0
                    }

                    roughness={
                        displayMaterial?.roughness ??
                        0.8
                    }

                    side={
                        DoubleSide
                    }

                    transparent={
                        false
                    }

                    opacity={
                        1
                    }

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


            {/* ------------------------------------------
                FLOOR MEASUREMENT LABEL

                No shadows.
            ------------------------------------------ */}

            {measurementTexture && (

                <mesh

                    position={[
                        labelAnchor.point.x,

                        (
                            isChildRegion
                                ? 0.02
                                : 0
                        ) + 0.03,

                        labelAnchor.point.z
                    ]}

                    rotation={[
                        -Math.PI / 2,
                        0,
                        0
                    ]}

                >

                    <planeGeometry

                        args={[
                            labelWidth,
                            labelHeight
                        ]}

                    />

                    <meshBasicMaterial

                        map={
                            measurementTexture
                        }

                        transparent

                        depthWrite={
                            false
                        }

                        alphaTest={
                            0.05
                        }

                        side={
                            DoubleSide
                        }

                    />

                </mesh>

            )}

        </group>
    );
}