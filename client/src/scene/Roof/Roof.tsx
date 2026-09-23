import { useMemo } from "react";

import {
    DoubleSide,
    Shape,
    ShapeGeometry,
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";


export default function Roof() {

    const {
        state
    } = useEditor();


    //==================================================
    // ROOF HEIGHT
    //==================================================
    //
    // WallPiece uses wallHeight * 0.5 as the vertical
    // center of each wall, so the actual wall top is
    // exactly wallHeight.
    //
    // Add a very small offset to avoid z-fighting.
    //
    //==================================================

    const roofHeight =
        Math.max(
            state.wallHeight,
            0.1
        ) + 0.03;


    //==================================================
    // GET ALL WALL CORNERS
    //==================================================
    //
    // We use the actual wall endpoints instead of relying
    // on solveRegions().
    //
    // This makes the roof work even when the house is:
    //
    // - rectangle
    // - L-shaped
    // - connected rooms
    // - irregular
    //
    //==================================================

    const roofGeometry =
        useMemo(
            () => {

                if (
                    !state.walls ||
                    state.walls.length === 0
                ) {
                    return null;
                }


                //==================================================
                // COLLECT WALL ENDPOINTS
                //==================================================

                const points: Vector3[] =
                    [];

                for (
                    const wall
                    of state.walls
                ) {

                    points.push(
                        wall.start.position.clone()
                    );

                    points.push(
                        wall.end.position.clone()
                    );
                }


                if (
                    points.length < 3
                ) {
                    return null;
                }


                //==================================================
                // REMOVE DUPLICATE POINTS
                //==================================================

                const uniquePoints: Vector3[] =
                    [];

                const duplicateDistance =
                    0.001;

                for (
                    const point
                    of points
                ) {

                    const alreadyExists =
                        uniquePoints.some(
                            existing =>
                                existing.distanceToSquared(
                                    point
                                ) <
                                duplicateDistance *
                                duplicateDistance
                        );

                    if (
                        !alreadyExists
                    ) {
                        uniquePoints.push(
                            point
                        );
                    }
                }


                if (
                    uniquePoints.length < 3
                ) {
                    return null;
                }


                //==================================================
                // CENTER
                //==================================================
                //
                // Find the center of all wall points.
                //
                // This is used to sort the boundary points
                // around the outside of the house.
                //
                //==================================================

                let centerX =
                    0;

                let centerZ =
                    0;

                for (
                    const point
                    of uniquePoints
                ) {

                    centerX +=
                        point.x;

                    centerZ +=
                        point.z;
                }

                centerX /=
                    uniquePoints.length;

                centerZ /=
                    uniquePoints.length;


                //==================================================
                // SORT AROUND CENTER
                //==================================================

                uniquePoints.sort(
                    (
                        a,
                        b
                    ) => {

                        const angleA =
                            Math.atan2(
                                a.z -
                                    centerZ,
                                a.x -
                                    centerX
                            );

                        const angleB =
                            Math.atan2(
                                b.z -
                                    centerZ,
                                b.x -
                                    centerX
                            );

                        return (
                            angleA -
                            angleB
                        );
                    }
                );


                //==================================================
                // CREATE SHAPE
                //==================================================

                const shape =
                    new Shape();


                shape.moveTo(
                    uniquePoints[0].x,
                    -uniquePoints[0].z
                );


                for (
                    let i = 1;
                    i < uniquePoints.length;
                    i++
                ) {

                    shape.lineTo(
                        uniquePoints[i].x,
                        -uniquePoints[i].z
                    );
                }


                shape.closePath();


                //==================================================
                // BUILD GEOMETRY
                //==================================================

                const geometry =
                    new ShapeGeometry(
                        shape
                    );

                geometry.computeVertexNormals();

                geometry.computeBoundingSphere();


                return geometry;

            },
            [
                state.walls
            ]
        );


    //==================================================
    // NO ROOF
    //==================================================

    if (
        !state.walkthroughMode ||
        !roofGeometry
    ) {
        return null;
    }


    //==================================================
    // RENDER
    //==================================================

    return (
        <group
            name="WalkthroughRoof"
            position={[
                0,
                roofHeight,
                0
            ]}
        >

            <mesh
                geometry={
                    roofGeometry
                }
                rotation={[
                    -Math.PI / 2,
                    0,
                    0
                ]}

                //==================================================
                // IMPORTANT:
                // Do not let the roof create a shadow over
                // the walkthrough interior.
                //==================================================

                castShadow={
                    false
                }

                receiveShadow={
                    false
                }

                //==================================================
                // Roof is not interactive.
                //==================================================

                raycast={() => null}
            >

                <meshBasicMaterial
                    color="#ffde9b"
                    side={
                        DoubleSide
                    }
                    transparent={
                        false
                    }
                    depthWrite={
                        true
                    }
                />

            </mesh>

        </group>
    );
}