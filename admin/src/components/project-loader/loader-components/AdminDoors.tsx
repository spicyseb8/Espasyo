import {
    useEffect,
    useState
} from "react";

import type {
    Asset
} from "../engine/assets/Asset";

import {
    getDoorWindowAssets
} from "../../../services/assets/FirebaseDoorWindowLibrary";


import type {
    SavedDoor
} from "../ProjectTypes";

import AdminDoor
    from "./AdminDoor";


interface AdminDoorsProps {

    doors:
        SavedDoor[];

    wallThickness:
        number;

}


export default function AdminDoors({
    doors,
    wallThickness
}: AdminDoorsProps) {

    const [
        assets,
        setAssets
    ] = useState<Asset[]>([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    //==================================================
    // LOAD DOOR / WINDOW CATALOG
    //==================================================

    useEffect(() => {

        let cancelled =
            false;


        async function loadAssets() {

            try {

                const loaded =
                    await getDoorWindowAssets();


                if (cancelled) {

                    return;

                }


                setAssets(
                    loaded
                );

            } catch (error) {

                console.error(
                    "Failed to load admin door/window assets:",
                    error
                );

            } finally {

                if (!cancelled) {

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


    if (loading) {

        return null;

    }


    return (

        <group>

            {
                doors.map(
                    door => {

                        const asset =
                            assets.find(
                                item =>
                                    item.id ===
                                    door.assetId
                            );


                        if (!asset) {

                            console.warn(
                                "Admin door asset not found:",
                                door.assetId
                            );

                            return null;

                        }


                        return (

                            <AdminDoor

                                key={
                                    door.id
                                }

                                door={
                                    door
                                }

                                asset={
                                    asset
                                }

                                wallThickness={
                                    wallThickness
                                }

                            />

                        );

                    }
                )
            }

        </group>

    );

}