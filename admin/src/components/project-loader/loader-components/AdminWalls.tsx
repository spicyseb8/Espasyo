import {
    memo,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    Line
} from "@react-three/drei";

import {
    Vector3
} from "three";

import type {
    Material
} from "../engine/materials/MaterialTypes";

import {
    getWallMaterials
} from "../../../services/assets/wallsload";

import {
    solveRegions
} from "../engine/regions/RegionSolver";

import type {
    Region
} from "../engine/regions/Polygon";

import type {
    Wall
} from "../engine/walls/WallTypes";

import {
    buildAdminWallMeshes,
    type AdminDoorData,
    type AdminOpeningData,
    type AdminWindowData
} from "../engine/walls/AdminWallMeshBuilder";

import {
    getWallFinishSides
} from "../engine/walls/AdminWallFinishUtils";

import AdminWallPiece
    from "../engine/walls/AdminWallPiece";


interface AdminWallsProps {

    corners:
        {
            id:
                string;

            position:
                Vector3;

        }[];

    walls:
        Wall[];

    doors:
        AdminDoorData[];

    windows:
        AdminWindowData[];

    openings:
        AdminOpeningData[];

    wallHeight:
        number;

    wallThickness:
        number;

    wallFinishes:
        Record<
            string,
            Record<string, string>
        >;

}


//==================================================
// WALL OUTLINE
//==================================================

interface WallOutlineProps {

    start:
        Vector3;

    end:
        Vector3;

    height:
        number;

    thickness:
        number;

    connectedStart:
        boolean;

    connectedEnd:
        boolean;

}


function pointToSegmentDistanceXZ(
    point:
        Vector3,

    start:
        Vector3,

    end:
        Vector3
): number {

    const dx =
        end.x -
        start.x;

    const dz =
        end.z -
        start.z;


    const lengthSquared =
        dx * dx +
        dz * dz;


    if (
        lengthSquared <=
        0.000001
    ) {

        return Math.sqrt(

            (point.x - start.x) ** 2 +
            (point.z - start.z) ** 2

        );

    }


    let t =
        (
            (point.x - start.x) * dx +
            (point.z - start.z) * dz
        ) /
        lengthSquared;


    t =
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );


    const closestX =
        start.x +
        t * dx;

    const closestZ =
        start.z +
        t * dz;


    return Math.sqrt(

        (point.x - closestX) ** 2 +
        (point.z - closestZ) ** 2

    );

}


function isWallEndpointConnected(
    wallId:
        string,

    point:
        Vector3,

    walls:
        Wall[]
): boolean {

    const tolerance =
        0.05;


    return walls.some(
        otherWall => {

            if (
                otherWall.id ===
                wallId
            ) {

                return false;

            }


            return (

                pointToSegmentDistanceXZ(

                    point,

                    otherWall.start.position,

                    otherWall.end.position

                ) <=
                tolerance

            );

        }
    );

}


function WallOutline({
    start,
    end,
    height,
    thickness,
    connectedStart,
    connectedEnd
}: WallOutlineProps) {

    const direction =
        new Vector3()
            .subVectors(
                end,
                start
            );


    const length =
        direction.length();


    if (
        length <=
        0.001
    ) {

        return null;

    }


    direction.normalize();


    const center =
        start.clone()
            .add(

                direction
                    .clone()
                    .multiplyScalar(
                        length * 0.5
                    )

            );


    const rotationY =
        -Math.atan2(
            direction.z,
            direction.x
        );


    const halfLength =
        length * 0.5;


    const halfThickness =
        thickness * 0.5;


    return (

        <group

            position={
                center
            }

            rotation={[
                0,
                rotationY,
                0
            ]}

        >

            <Line

                points={[

                    new Vector3(
                        -halfLength,
                        height,
                        halfThickness
                    ),

                    new Vector3(
                        halfLength,
                        height,
                        halfThickness
                    )

                ]}

                color="#252525"

                lineWidth={
                    1
                }

            />


            <Line

                points={[

                    new Vector3(
                        -halfLength,
                        height,
                        -halfThickness
                    ),

                    new Vector3(
                        halfLength,
                        height,
                        -halfThickness
                    )

                ]}

                color="#252525"

                lineWidth={
                    1
                }

            />


            {
                !connectedStart && (

                    <>

                        <Line

                            points={[

                                new Vector3(
                                    -halfLength,
                                    0,
                                    halfThickness
                                ),

                                new Vector3(
                                    -halfLength,
                                    height,
                                    halfThickness
                                )

                            ]}

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />


                        <Line

                            points={[

                                new Vector3(
                                    -halfLength,
                                    0,
                                    -halfThickness
                                ),

                                new Vector3(
                                    -halfLength,
                                    height,
                                    -halfThickness
                                )

                            ]}

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />


                        <Line

                            points={[

                                new Vector3(
                                    -halfLength,
                                    height,
                                    -halfThickness
                                ),

                                new Vector3(
                                    -halfLength,
                                    height,
                                    halfThickness
                                )

                            ]}

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />

                    </>

                )
            }


            {
                !connectedEnd && (

                    <>

                        <Line

                            points={[

                                new Vector3(
                                    halfLength,
                                    0,
                                    halfThickness
                                ),

                                new Vector3(
                                    halfLength,
                                    height,
                                    halfThickness
                                )

                            ]}

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />


                        <Line

                            points={[

                                new Vector3(
                                    halfLength,
                                    0,
                                    -halfThickness
                                ),

                                new Vector3(
                                    halfLength,
                                    height,
                                    -halfThickness
                                )

                            ]}

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />


                        <Line

                            points={[

                                new Vector3(
                                    halfLength,
                                    height,
                                    -halfThickness
                                ),

                                new Vector3(
                                    halfLength,
                                    height,
                                    halfThickness
                                )

                            ]}

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />

                    </>

                )
            }

        </group>

    );

}


//==================================================
// ADMIN WALLS
//==================================================

function AdminWalls({
    corners,
    walls,
    doors,
    windows,
    openings,
    wallHeight,
    wallThickness,
    wallFinishes
}: AdminWallsProps) {

    const [
        wallMaterials,
        setWallMaterials
    ] = useState<Material[]>([]);


    //--------------------------------------------------
    // LOAD WALL MATERIALS
    //--------------------------------------------------

    useEffect(() => {

        let cancelled =
            false;


        async function loadMaterials() {

            try {

                const materials =
                    await getWallMaterials();


                if (
                    cancelled
                ) {

                    return;

                }


                setWallMaterials(
                    materials
                );

            } catch (error) {

                console.error(
                    "Failed to load admin wall materials:",
                    error
                );

            }

        }


        void loadMaterials();


        return () => {

            cancelled =
                true;

        };

    }, []);


    //--------------------------------------------------
    // SOLVE REGIONS
    //--------------------------------------------------

    const regions:
        Region[] =
        useMemo(

            () =>
                solveRegions(
                    corners,
                    walls
                ),

            [
                corners,
                walls
            ]

        );


    //--------------------------------------------------
    // RENDER
    //--------------------------------------------------

    return (

        <group>

            {
                walls.map(
                    wall => {

                        const pieces =
                            buildAdminWallMeshes(

                                wall,

                                wallHeight,

                                wallThickness,

                                doors,

                                openings,

                                windows

                            );


                        const finishSides =
                            getWallFinishSides(

                                wall,

                                regions,

                                wallFinishes

                            );


                        const connectedStart =
                            isWallEndpointConnected(

                                wall.id,

                                wall.start.position,

                                walls

                            );


                        const connectedEnd =
                            isWallEndpointConnected(

                                wall.id,

                                wall.end.position,

                                walls

                            );


                        return (

                            <group
                                key={
                                    wall.id
                                }
                            >

                                {
                                    pieces.map(
                                        (
                                            piece,
                                            index
                                        ) => (

                                            <AdminWallPiece

                                                key={
                                                    `${wall.id}-${index}`
                                                }

                                                wallId={
                                                    wall.id
                                                }

                                                physicalWall={
                                                    wall
                                                }

                                                piece={
                                                    piece
                                                }

                                                regions={
                                                    regions
                                                }

                                                finishSides={
                                                    finishSides
                                                }

                                            />

                                        )
                                    )
                                }


                                <WallOutline

                                    start={
                                        wall.start.position
                                    }

                                    end={
                                        wall.end.position
                                    }

                                    height={
                                        wallHeight
                                    }

                                    thickness={
                                        wallThickness
                                    }

                                    connectedStart={
                                        connectedStart
                                    }

                                    connectedEnd={
                                        connectedEnd
                                    }

                                />

                            </group>

                        );

                    }
                )
            }

        </group>

    );

}


export default memo(
    AdminWalls
);