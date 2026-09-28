import {
    useEffect,
    useState
} from "react";

import type {
    Asset
} from "../engine/assets/Asset";

import {
    getFurnitureAssets
} from "../../../services/assets/furnitureload";

import type {
    SavedFurniture
} from "../ProjectTypes";

import AdminFurniture
    from "./AdminFurniture";


//==================================================
// PROPS
//==================================================

interface AdminFurnituresProps {

    furniture:
        SavedFurniture[];

}


//==================================================
// ADMIN FURNITURES
//==================================================

export default function AdminFurnitures({
    furniture
}: AdminFurnituresProps) {

    const [
        assets,
        setAssets
    ] = useState<Asset[]>([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    //--------------------------------------------------
    // LOAD FIREBASE CATALOG
    //--------------------------------------------------

    useEffect(() => {

        let cancelled =
            false;


        async function loadAssets() {

            try {

                const loaded =
                    await getFurnitureAssets();


                if (
                    cancelled
                ) {

                    return;

                }


                setAssets(
                    loaded
                );

            } catch (error) {

                console.error(
                    "Failed to load admin furniture assets:",
                    error
                );

            } finally {

                if (
                    !cancelled
                ) {

                    setLoading(
                        false
                    );

                }

            }

        }


        void loadAssets();


        return () => {

            cancelled =
                true;

        };

    }, []);


    //--------------------------------------------------
    // WAIT FOR CATALOG
    //--------------------------------------------------

    if (
        loading
    ) {

        return null;

    }


    //--------------------------------------------------
    // RENDER
    //--------------------------------------------------

    return (

        <group>

            {
                furniture.map(
                    item => {

                        const asset =
                            assets.find(
                                assetItem =>
                                    assetItem.id ===
                                    item.assetId
                            );


                        if (
                            !asset
                        ) {

                            console.warn(
                                "Admin furniture asset not found:",
                                item.assetId
                            );

                            return null;

                        }


                        return (

                            <AdminFurniture

                                key={
                                    item.id
                                }

                                furniture={
                                    item
                                }

                                asset={
                                    asset
                                }

                            />

                        );

                    }
                )
            }

        </group>

    );

}