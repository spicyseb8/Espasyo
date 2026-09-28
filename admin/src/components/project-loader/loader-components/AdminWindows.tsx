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
    SavedWindow
} from "../ProjectTypes";

import AdminWindow
    from "./AdminWindow";


interface AdminWindowsProps {

    windows:
        SavedWindow[];

    wallThickness:
        number;

}


export default function AdminWindows({
    windows,
    wallThickness
}: AdminWindowsProps) {

    const [
        assets,
        setAssets
    ] = useState<Asset[]>([]);


    const [
        loading,
        setLoading
    ] = useState(true);


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
                windows.map(
                    window => {

                        const asset =
                            assets.find(
                                item =>
                                    item.id ===
                                    window.assetId
                            );


                        if (!asset) {

                            console.warn(
                                "Admin window asset not found:",
                                window.assetId
                            );

                            return null;

                        }


                        return (

                            <AdminWindow

                                key={
                                    window.id
                                }

                                window={
                                    window
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