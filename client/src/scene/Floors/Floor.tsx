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

import {
    Line
} from "@react-three/drei";

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
    LOCAL_DEFAULT_FLOOR_TEXTURE,
    getCachedFloorTexture,
    preloadFloorTexture
} from "../../engine/materials/floors";


interface FloorProps {

    region:
        Region;

    materials:
        Material[];

}


//==================================================
// DISTANCE TO SEGMENT
//==================================================

function distanceToSegment(

    p:
        Vector3,

    a:
        Vector3,

    b:
        Vector3

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
                    ) /
                    lengthSq
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
// DISTANCE TO POLYGON BOUNDARY
//==================================================

function distanceToPolygonBoundary(

    point:
        Vector3,

    polygon:
        Vector3[]

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
            dist <
            minDist
        ) {

            minDist =
                dist;

        }

    }


    return minDist;

}


//==================================================
// COMPUTE LABEL ANCHOR
//==================================================

function computeLabelAnchor(
    region:
        Region
): {
    point:
        Vector3;

    clearance:
        number;
} {

    const outer =
        (region.corners ?? [])
            .filter(Boolean);


    if (
        outer.length <
        3
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
                p =>
                    p.x
            )
        );


    const maxX =
        Math.max(
            ...outer.map(
                p =>
                    p.x
            )
        );


    const minZ =
        Math.min(
            ...outer.map(
                p =>
                    p.z
            )
        );


    const maxZ =
        Math.max(
            ...outer.map(
                p =>
                    p.z
            )
        );


    const fallback =
        new Vector3(

            (minX + maxX) /
                2,

            0,

            (minZ + maxZ) /
                2

        );


    const resolution =
        20;


    const stepX =
        (
            maxX -
            minX
        ) /
        resolution;


    const stepZ =
        (
            maxZ -
            minZ
        ) /
        resolution;


    let best:
        {
            point:
                Vector3;

            clearance:
                number;
        } |
        null =
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

        best ??

        {

            point:
                fallback,

            clearance:
                0.5

        }

    );

}


//==================================================
// FLOOR TEXTURE
//==================================================

function useFloorTexture(
    url?:
        string
): Texture | null {

    const [
        loadedTexture,
        setLoadedTexture
    ] =
        useState<Texture | null>(
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
// FLOOR SELECTION OUTLINE
//==================================================
//
// Creates the gray boundary lines for the selected floor.
//
// The points are created in the same local coordinate
// system as the ShapeGeometry:
//     X = world X
//     Y = -world Z
//     Z = tiny elevation above floor
//
// The group is then rotated exactly like the floor mesh.
//==================================================

//==================================================
// FLOOR SELECTION OUTLINE
//==================================================
//
// The floor mesh itself is rotated -90° on X because
// its ShapeGeometry is created in the XY plane.
//
// The Line, however, is created directly in world space,
// so its points must be:
//
//     X = world X
//     Y = floor height
//     Z = world Z
//
// This keeps the outline flat on the floor instead of
// appearing vertically around the walls.
//==================================================

//==================================================
// FLOOR SELECTION OUTLINE
//==================================================
//
// The outline is slightly inset from the actual floor
// boundary so a thick line does not spill outside the
// walls.
//
// `inset` is measured in world units.
//==================================================

function useFloorOutlineLoops(

    region:
        Region,

    floorY:
        number,

    inset:
        number = 0.03

): Vector3[][] {

    return useMemo(() => {

        const loops =
            region.boundaryLoops ??
            [];


        return loops

            .map(
                loop => {

                    const corners =
                        loop.corners
                            .filter(Boolean);


                    if (
                        corners.length <
                        2
                    ) {

                        return [];

                    }


                    //--------------------------------------------------
                    // Calculate polygon center.
                    //--------------------------------------------------

                    const center =
                        corners.reduce(

                            (
                                result,
                                corner
                            ) => {

                                result.x +=
                                    corner.x;

                                result.z +=
                                    corner.z;

                                return result;

                            },

                            new Vector3()

                        );


                    center.x /=
                        corners.length;

                    center.z /=
                        corners.length;


                    //--------------------------------------------------
                    // Move each boundary point slightly toward
                    // the center of the floor.
                    //--------------------------------------------------

                    return corners.map(

                        corner => {

                            const direction =
                                new Vector3(

                                    center.x -
                                        corner.x,

                                    0,

                                    center.z -
                                        corner.z

                                );


                            const distance =
                                Math.sqrt(

                                    direction.x *
                                        direction.x +

                                    direction.z *
                                        direction.z

                                );


                            if (
                                distance <
                                0.0001
                            ) {

                                return new Vector3(

                                    corner.x,

                                    floorY +
                                        0.006,

                                    corner.z

                                );

                            }


                            direction.x /=
                                distance;

                            direction.z /=
                                distance;


                            return new Vector3(

                                corner.x +
                                    direction.x *
                                    inset,

                                floorY +
                                    0.006,

                                corner.z +
                                    direction.z *
                                    inset

                            );

                        }

                    );

                }
            )

            .filter(
                points =>
                    points.length >=
                    2
            );

    }, [
        region.boundaryLoops,
        floorY,
        inset
    ]);

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


    //==================================================
    // CHILD REGION
    //==================================================

    const isChildRegion =
        Boolean(
            region.parentRegionId
        );


    //==================================================
    // SELECTED
    //==================================================

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
    // DEFAULT FIREBASE MATERIAL
    //==================================================

    const firebaseDefaultMaterial =
        materials.find(
            material =>
                material.id ===
                DEFAULT_FLOOR_MATERIAL_ID
        );


    const defaultFloorMaterial =
        firebaseDefaultMaterial

            ? {

                ...firebaseDefaultMaterial,

                texture:
                    LOCAL_DEFAULT_FLOOR_TEXTURE,

                thumbnail:
                    firebaseDefaultMaterial.thumbnail ??
                    LOCAL_DEFAULT_FLOOR_TEXTURE

            }

            : {

                id:
                    DEFAULT_FLOOR_MATERIAL_ID,

                name:
                    "Terrazo Tiles",

                category:
                    "flooring",

                pricePerSquareMeter:
                    0,

                thumbnail:
                    LOCAL_DEFAULT_FLOOR_TEXTURE,

                texture:
                    LOCAL_DEFAULT_FLOOR_TEXTURE,

                color:
                    "#ffffff",

                roughness:
                    0.8,

                metalness:
                    0

            };


    const displayMaterial =
        selectedMaterial ??
        defaultFloorMaterial;


    const textureUrl =
        displayMaterial?.texture;


    const floorTexture =
        useFloorTexture(
            textureUrl
        );


    //==================================================
    // FLOOR GEOMETRY
    //==================================================

    const geometry =
        useMemo(() => {

            const loops =
                region.boundaryLoops ??
                [];


            if (
                loops.length ===
                0
            ) {

                return null;

            }


            const outer =
                loops[0].corners
                    .filter(Boolean);


            if (
                outer.length <
                3
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
                                points.length <
                                3
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

                            hole !==
                            null

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


    //==================================================
    // FLOOR AREA
    //==================================================

    const floorArea =
        Math.abs(
            region.area ||
            0
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
                fontSize *
                0.1;


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


    //==================================================
    // FLOOR OUTLINE
    //==================================================

const floorY =
    isChildRegion
        ? 0.02
        : 0;

const floorOutlineLoops =
    useFloorOutlineLoops(
        region,
        floorY,
        0.1
    );


    //==================================================
    // NO GEOMETRY
    //==================================================

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

            {/* ==========================================
                ACTUAL FLOOR
            ========================================== */}

            <mesh

                geometry={
                    geometry
                }

                userData={{
                    isFloor:
                        true
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

                    The floor material itself does NOT change
                    when selected.

                    Selection is shown only with the gray
                    boundary outline below.

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
                        "#000000"
                    }

                    emissiveIntensity={
                        0
                    }

                />

            </mesh>
                {/* ==========================================
    SELECTED FLOOR HIGHLIGHT
========================================== */}

{
    isSelected && (

        <mesh

            geometry={
                geometry
            }

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

        >

            <meshBasicMaterial

                color="#808080"

                transparent

                opacity={0.25}

                depthWrite={false}

                side={DoubleSide}

            />

        </mesh>

    )
}

            {/* ==========================================
                SELECTED FLOOR OUTLINE
            ========================================== */}

            {
                isSelected &&

                floorOutlineLoops.map(

                    (
                        points,

                        index

                    ) => (

                        <Line

                            key={
                                `floor-outline-${index}`
                            }

                            points={
                                [
                                    ...points,
                                    points[0]
                                ]
                            }

                            color={
                                "#7e7d7d"
                            }

                            lineWidth={
                                10
                            }

                            transparent={
                                true
                            }

                            opacity={
                                0.95
                            }

                        />

                    )

                )
            }


            {/* ==========================================
                FLOOR MEASUREMENT LABEL

                No shadows.
            ========================================== */}

            {
                measurementTexture && (

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

                )

            }

        </group>

    );

}