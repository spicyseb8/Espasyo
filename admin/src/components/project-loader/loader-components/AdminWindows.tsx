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

    onWindowSelect?: (windowId: string) => void;
    hiddenWindowId?: string | null;

}


export default function AdminWindows({
    windows,
    wallThickness,
    onWindowSelect,
    hiddenWindowId
}: AdminWindowsProps) {

    return (

        <group>

            {
                windows.map(
                    window => {

                        if (window.id === hiddenWindowId) return null;

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

                                onSelect={onWindowSelect}

                            />

                        );

                    }
                )
            }

        </group>

    );

}