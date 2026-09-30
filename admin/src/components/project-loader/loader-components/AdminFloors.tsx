import {
    useEffect,
    useMemo,
    useState
} from "react";

import type {
    Material
} from "../engine/materials/MaterialTypes";

import {
    getDefaultFloorMaterial,
    getFloorMaterials,
    preloadFloorTexture
} from "../../../services/assets/floorsload";

import {
    solveRegions
} from "../engine/regions/RegionSolver";

import type {
    Corner
} from "../engine/walls/Corner";

import type {
    Wall
} from "../engine/walls/WallTypes";

import AdminFloor
    from "./AdminFloor";


interface AdminFloorsProps {

    corners:
        Corner[];

    walls:
        Wall[];

    floorFinishes:
        Record<string, string>;

}


export default function AdminFloors({
    corners,
    walls,
    floorFinishes
}: AdminFloorsProps) {

    const [
        floorMaterials,
        setFloorMaterials
    ] = useState<Material[]>([]);


    //==================================================
    // LOAD FLOOR MATERIALS
    //==================================================

    useEffect(() => {

        let cancelled =
            false;


        async function initializeFloors() {

            try {

                //--------------------------------------------------
                // DEFAULT FLOOR FIRST
                //--------------------------------------------------

                const defaultMaterial =
                    await getDefaultFloorMaterial();


                if (cancelled) {

                    return;

                }


                //--------------------------------------------------
                // PRELOAD LOCAL DEFAULT TEXTURE
                //--------------------------------------------------

                if (
                    defaultMaterial?.texture
                ) {

                    await preloadFloorTexture(
                        defaultMaterial.texture
                    );

                }


                if (cancelled) {

                    return;

                }


                //--------------------------------------------------
                // SHOW DEFAULT MATERIAL
                //--------------------------------------------------

                if (
                    defaultMaterial
                ) {

                    setFloorMaterials([
                        defaultMaterial
                    ]);

                }


                //--------------------------------------------------
                // LOAD COMPLETE FIREBASE CATALOG
                //--------------------------------------------------

                try {

                    const materials =
                        await getFloorMaterials();


                    if (cancelled) {

                        return;

                    }


                    setFloorMaterials(
                        materials
                    );

                } catch (catalogError) {

                    console.error(
                        "Failed to load admin floor catalog:",
                        catalogError
                    );

                }

            } catch (error) {

                console.error(
                    "Failed to initialize admin floors:",
                    error
                );

            }

        }


        void initializeFloors();


        return () => {

            cancelled =
                true;

        };

    }, []);


    //==================================================
    // SOLVE ROOMS
    //==================================================

    const regions =
        useMemo(() => {

            return solveRegions(
                corners,
                walls
            ).filter(
                region => {

                    const area =
                        Math.abs(
                            region.area || 0
                        );


                    return (
                        region.corners.length >= 3 &&
                        area > 0.01
                    );

                }
            );

        }, [
            corners,
            walls
        ]);


    //==================================================
    // RENDER
    //==================================================

    return (

        <group>

            {
                regions.map(
                    region => (

                        <AdminFloor

                            key={
                                region.id
                            }

                            region={
                                region
                            }

                            materials={
                                floorMaterials
                            }

                            floorFinishes={
                                floorFinishes
                            }

                        />

                    )
                )
            }

        </group>

    );

}