import {
    useEffect,
    useMemo,
    useRef
} from "react";

import {
    DirectionalLight,
    Vector3
} from "three";

import useEditor
    from "../context/editor/useEditor";


export default function Lights() {

    const {
        state
    } = useEditor();

    //==================================================
    // Directional light reference
    //==================================================

    const directionalLightRef =
        useRef<DirectionalLight | null>(
            null
        );


    //==================================================
    // Calculate house bounds
    //==================================================

    const houseBounds =
        useMemo(() => {

            const corners =
                state.corners ?? [];

            //--------------------------------------------------
            // No room yet
            //--------------------------------------------------

            if (
                corners.length === 0
            ) {

                return {

                    center:
                        new Vector3(
                            0,
                            0,
                            0
                        ),

                    halfSize:
                        15

                };
            }

            //--------------------------------------------------
            // Find X/Z bounds
            //--------------------------------------------------

            let minX =
                Infinity;

            let maxX =
                -Infinity;

            let minZ =
                Infinity;

            let maxZ =
                -Infinity;


            for (
                const corner
                of corners
            ) {

                const x =
                    corner.position.x;

                const z =
                    corner.position.z;


                minX =
                    Math.min(
                        minX,
                        x
                    );

                maxX =
                    Math.max(
                        maxX,
                        x
                    );

                minZ =
                    Math.min(
                        minZ,
                        z
                    );

                maxZ =
                    Math.max(
                        maxZ,
                        z
                    );
            }


            //--------------------------------------------------
            // House center
            //--------------------------------------------------

            const center =
                new Vector3(

                    (minX + maxX) *
                    0.5,

                    0,

                    (minZ + maxZ) *
                    0.5

                );


            //--------------------------------------------------
            // Largest horizontal dimension
            //--------------------------------------------------

            const width =
                maxX - minX;

            const depth =
                maxZ - minZ;

            const largestDimension =
                Math.max(
                    width,
                    depth
                );


            //--------------------------------------------------
            // Add margin around house
            //--------------------------------------------------

            const margin =
                4;


            const halfSize =
                Math.max(
                    10,
                    largestDimension *
                        0.5 +
                        margin
                );


            return {

                center,

                halfSize

            };

        }, [
            state.corners
        ]);


    //==================================================
    // Update shadow camera target
    //==================================================

    useEffect(() => {

        const light =
            directionalLightRef.current;


        if (
            !light
        ) {

            return;
        }


        //--------------------------------------------------
        // Point the light toward the center of the house
        //--------------------------------------------------

        light.target.position.set(

            houseBounds.center.x,

            0,

            houseBounds.center.z

        );


        light.target.updateMatrixWorld();


    }, [
        houseBounds.center.x,
        houseBounds.center.z
    ]);


    const shadowSize =
        houseBounds.halfSize;


    return (

        <>

            {/*==================================================
                AMBIENT LIGHT
            ==================================================*/}

            <ambientLight
                intensity={
                    1.0
                }
            />


            {/*==================================================
                MAIN LIGHT
            ==================================================*/}

            <directionalLight

                ref={
                    directionalLightRef
                }

                castShadow

                position={[
                    houseBounds.center.x + 8,
                    14,
                    houseBounds.center.z + 8
                ]}

                intensity={
                    2.0
                }


                shadow-mapSize-width={
                    2048
                }

                shadow-mapSize-height={
                    2048
                }



                shadow-camera-near={
                    0.1
                }

                shadow-camera-far={
                    60
                }

                shadow-camera-left={
                    -shadowSize
                }

                shadow-camera-right={
                    shadowSize
                }

                shadow-camera-top={
                    shadowSize
                }

                shadow-camera-bottom={
                    -shadowSize
                }

                shadow-bias={
                    -0.0001
                }

                shadow-normalBias={
                    0.02
                }

            />

        </>
    );
}