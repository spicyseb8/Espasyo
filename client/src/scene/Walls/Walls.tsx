import {
    memo,
    useMemo
} from "react";

import {
    Line
} from "@react-three/drei";

import {
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import WallPiece
    from "./WallPiece";

import {
    buildWallMeshes
} from "../../engine/walls/WallMeshBuilder";

import {
    solveRegions
} from "../../engine/regions/RegionSolver";

import {
    getWallFinishSides
} from "./WallFinishUtils";

//======================================================
// TYPES
//======================================================

interface WallOutlineProps {

    start: Vector3;

    end: Vector3;

    height: number;

    thickness: number;

    connectedStart: boolean;

    connectedEnd: boolean;

}


//======================================================
// WALL OUTLINE
//======================================================

/**
 * Draws the outline of the ORIGINAL wall.
 *
 * Important:
 *
 * WallMeshBuilder can split one physical wall into
 * multiple WallPieces because of:
 *
 * - doors
 * - windows
 * - openings
 *
 * We do NOT draw outlines around those individual
 * pieces.
 *
 * Instead, this component draws the outline based
 * on the original Wall.
 */
function WallOutline({

    start,

    end,

    height,

    thickness,

    connectedStart,

    connectedEnd

}: WallOutlineProps) {


    //--------------------------------------------------
    // Wall direction
    //--------------------------------------------------

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


    //--------------------------------------------------
    // Normalize direction
    //--------------------------------------------------

    direction.normalize();


    //--------------------------------------------------
    // Original wall center
    //--------------------------------------------------

    const center =
        start.clone()
            .add(
                direction
                    .clone()
                    .multiplyScalar(
                        length * 0.5
                    )
            );


    //--------------------------------------------------
    // Same rotation convention used by WallPiece.
    //--------------------------------------------------

    const rotationY =
        -Math.atan2(
            direction.z,
            direction.x
        );


    //--------------------------------------------------
    // Local coordinates
    //
    // X = along wall
    // Y = height
    // Z = wall thickness
    //--------------------------------------------------

    const halfLength =
        length * 0.5;


    const halfThickness =
        thickness * 0.5;


    //--------------------------------------------------
    // Long edges
    //
    // Explicit Vector3 objects are used here because
    // Drei Line expects Vector3[].
    //--------------------------------------------------

    const longEdges: Vector3[][] = [

        // TOP FRONT
        [
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
        ],

        // TOP BACK
        [
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
        ],

        // BOTTOM FRONT
        [
            new Vector3(
                -halfLength,
                0,
                halfThickness
            ),
            new Vector3(
                halfLength,
                0,
                halfThickness
            )
        ],

        // BOTTOM BACK
        [
            new Vector3(
                -halfLength,
                0,
                -halfThickness
            ),
            new Vector3(
                halfLength,
                0,
                -halfThickness
            )
        ]

    ];


    //--------------------------------------------------
    // Render
    //--------------------------------------------------

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

            {
                longEdges.map(
                    (
                        edge,
                        index
                    ) => (

                        <Line

                            key={
                                `wall-long-edge-${index}`
                            }

                            points={
                                edge
                            }

                            color="#252525"

                            lineWidth={
                                1
                            }

                        />

                    )
                )
            }


            {/* ==========================================
                START END
            ========================================== */}

            {
                !connectedStart && (

                    <>

                        {/* START - FRONT */}

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


                        {/* START - BACK */}

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


                        {/* START - TOP */}

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


                        {/* START - BOTTOM */}

                        <Line

                            points={[

                                new Vector3(
                                    -halfLength,
                                    0,
                                    -halfThickness
                                ),

                                new Vector3(
                                    -halfLength,
                                    0,
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


            {/* ==========================================
                END END
            ========================================== */}

            {
                !connectedEnd && (

                    <>

                        {/* END - FRONT */}

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


                        {/* END - BACK */}

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


                        {/* END - TOP */}

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


                        {/* END - BOTTOM */}

                        <Line

                            points={[

                                new Vector3(
                                    halfLength,
                                    0,
                                    -halfThickness
                                ),

                                new Vector3(
                                    halfLength,
                                    0,
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


//======================================================
// POINT TO WALL SEGMENT DISTANCE
//======================================================

function pointToSegmentDistanceXZ(

    point: Vector3,

    start: Vector3,

    end: Vector3

): number {


    const px =
        point.x;

    const pz =
        point.z;


    const sx =
        start.x;

    const sz =
        start.z;


    const ex =
        end.x;

    const ez =
        end.z;


    const dx =
        ex -
        sx;


    const dz =
        ez -
        sz;


    const lengthSquared =
        dx * dx +
        dz * dz;


    if (
        lengthSquared <=
        0.000001
    ) {

        return Math.sqrt(

            (px - sx) ** 2 +
            (pz - sz) ** 2

        );

    }


    let t =
        (

            (px - sx) * dx +
            (pz - sz) * dz

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
        sx +
        t * dx;


    const closestZ =
        sz +
        t * dz;


    return Math.sqrt(

        (px - closestX) ** 2 +
        (pz - closestZ) ** 2

    );

}


//======================================================
// WALL-LIKE TYPE
//======================================================
//
// We intentionally do NOT import Wall from WallTypes.
// This avoids the TypeScript error:
//
// "Namespace WallTypes has no exported member Wall"
//
// We only need the data used by this function.
//

interface WallConnectionData {

    id: string;

    start: {

        position: Vector3;

    };

    end: {

        position: Vector3;

    };

}


//======================================================
// CHECK WALL CONNECTION
//======================================================
//
// Determine whether a wall endpoint is connected to
// another wall.
//
// This also handles:
//
//     Wall A
//     ───────────────
//            │
//            │
//            │ Wall B
//
// The endpoint/end-cap line is hidden when another
// wall connects to the middle of this wall.
//

function isWallEndpointConnected(

    wallId: string,

    point: Vector3,

    walls: WallConnectionData[]

): boolean {


    const CONNECTION_TOLERANCE =
        0.05;


    return walls.some(

        otherWall => {

            if (
                otherWall.id ===
                wallId
            ) {

                return false;

            }


            const otherStart =
                otherWall.start.position;


            const otherEnd =
                otherWall.end.position;


            return (

                pointToSegmentDistanceXZ(

                    point,

                    otherStart,

                    otherEnd

                ) <=

                CONNECTION_TOLERANCE

            );

        }

    );

}


//======================================================
// WALLS
//======================================================

function Walls() {


    const {
        state
    } = useEditor();


    //--------------------------------------------------
    // Regions
    //--------------------------------------------------

    const regions =
        useMemo(

            () =>

                solveRegions(

                    state.corners,

                    state.walls

                ),

            [

                state.corners,

                state.walls

            ]

        );


    //--------------------------------------------------
    // Render walls
    //--------------------------------------------------

    return (

        <group>

            {
                state.walls.map(

                    wall => {


                        //--------------------------------------------------
                        // BUILD WALL PIECES
                        //--------------------------------------------------

                        const pieces =
                            buildWallMeshes(

                                wall,

                                state.wallHeight,

                                state.wallThickness,

                                state.doors,

                                state.openings,

                                state.windows

                            );


                        //--------------------------------------------------
                        // WALL FINISH
                        //--------------------------------------------------

                        const finishSides =
                            getWallFinishSides(

                                wall,

                                regions,

                                state.wallFinishes

                            );


                        //--------------------------------------------------
                        // ORIGINAL WALL ENDPOINTS
                        //--------------------------------------------------

                        const wallStart =
                            wall.start.position;


                        const wallEnd =
                            wall.end.position;


                        //--------------------------------------------------
                        // CHECK WALL CONNECTIONS
                        //--------------------------------------------------

                        const connectedStart =
                            isWallEndpointConnected(

                                wall.id,

                                wallStart,

                                state.walls as WallConnectionData[]

                            );


                        const connectedEnd =
                            isWallEndpointConnected(

                                wall.id,

                                wallEnd,

                                state.walls as WallConnectionData[]

                            );


                        return (

                            <group

                                key={
                                    wall.id
                                }

                            >

                                {/* ======================================
                                    WALL PIECES
                                ====================================== */}

                                {
                                    pieces.map(

                                        (
                                            piece,
                                            index
                                        ) => (

                                            <WallPiece

                                                key={
                                                    `${wall.id}-${index}`
                                                }

                                                wallId={
                                                    wall.id
                                                }

                                                piece={
                                                    piece
                                                }

                                                finishSides={
                                                    finishSides
                                                }

                                            />

                                        )

                                    )
                                }


                                {/* ======================================
                                    SINGLE WALL OUTLINE
                                ====================================== */}

                                <WallOutline

                                    start={
                                        wallStart
                                    }

                                    end={
                                        wallEnd
                                    }

                                    height={
                                        state.wallHeight
                                    }

                                    thickness={
                                        state.wallThickness
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
    Walls
);