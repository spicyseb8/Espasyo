import {
    useEffect,
    useMemo,
    useState
} from "react";

import type {
    Material
} from "../../engine/materials/MaterialTypes";

import {
    getDefaultFloorMaterial,
    getFloorMaterials,
    preloadFloorTexture
} from "../../engine/materials/floors";

import useEditor
    from "../../context/editor/useEditor";

import Floor
    from "./Floor";

import {
    solveRegions
} from "../../engine/regions/RegionSolver";


//==================================================
// FLOORS
//==================================================

export default function Floors() {

    const {
        state
    } = useEditor();


    //==================================================
    // FLOOR MATERIALS
    //==================================================

    const [
        floorMaterials,
        setFloorMaterials
    ] = useState<Material[]>(
        []
    );


    //==================================================
    // INITIAL FLOOR LOADING
    //==================================================
    //
    // IMPORTANT:
    //
    // 1. Load Terrazo Tiles first.
    // 2. Preload its Diffuse.png.
    // 3. Give it to Floor.
    // 4. Load the remaining catalog in background.
    //==================================================

    useEffect(() => {

        let cancelled =
            false;


        async function initializeFloors() {

            //--------------------------------------------------
            // STEP 1
            //
            // Fetch ONLY the default floor.
            //--------------------------------------------------

            const defaultMaterial =
                await getDefaultFloorMaterial();


            if (
                cancelled
            ) {

                return;
            }


            //--------------------------------------------------
            // STEP 2
            //
            // Preload Terrazo's texture before rendering it.
            //--------------------------------------------------

            if (
                defaultMaterial?.texture
            ) {

                await preloadFloorTexture(
                    defaultMaterial.texture
                );

            }


            if (
                cancelled
            ) {

                return;
            }


            //--------------------------------------------------
            // STEP 3
            //
            // Show the default floor.
            //--------------------------------------------------

            if (
                defaultMaterial
            ) {

                setFloorMaterials([

                    defaultMaterial

                ]);

            }


            //--------------------------------------------------
            // STEP 4
            //
            // Load all remaining flooring in background.
            //
            // IMPORTANT:
            // We intentionally DO NOT await this before
            // showing the default floor.
            //--------------------------------------------------

            try {

                const materials =
                    await getFloorMaterials();


                if (
                    cancelled
                ) {

                    return;
                }


                //--------------------------------------------------
                // Replace temporary default-only list with
                // complete Firebase catalog.
                //--------------------------------------------------

                setFloorMaterials(
                    materials
                );

            } catch (error) {

                console.error(

                    "Failed to load complete floor catalog:",

                    error

                );

                //--------------------------------------------------
                // Keep default floor visible if the background
                // catalog request fails.
                //--------------------------------------------------

            }
        }


        initializeFloors();


        return () => {

            cancelled =
                true;

        };

    }, []);


    //==================================================
    // FLOOR REGIONS
    //==================================================

    const regions =
        useMemo(() => {

            const filteredRegions =
                solveRegions(

                    state.corners,

                    state.walls

                ).filter(
                    region => {

                        const area =
                            Math.abs(

                                region.area ||
                                0

                            );


                        return (

                            region.corners.length >= 3 &&

                            area > 0.01

                        );

                    }
                );


            return filteredRegions;

        }, [

            state.corners,

            state.walls

        ]);


    //==================================================
    // RENDER
    //==================================================

    return (

        <>

            {
                regions.map(
                    region => (

                        <Floor

                            key={
                                region.id
                            }

                            region={
                                region
                            }

                            materials={
                                floorMaterials
                            }

                        />

                    )
                )
            }

        </>

    );
}