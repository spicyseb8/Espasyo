import {
    getCachedDoorWindowAsset
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

    return (

        <group>

            {
                windows.map(
                    window => {

                        const asset = getCachedDoorWindowAsset(window.assetId);


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