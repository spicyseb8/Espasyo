import {
    getCachedDoorWindowAsset
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

    onDoorSelect?: (doorId: string) => void;
    hiddenDoorId?: string | null;

}


export default function AdminDoors({
    doors,
    wallThickness,
    onDoorSelect,
    hiddenDoorId
}: AdminDoorsProps) {
    return (

        <group>

            {
                doors.map(
                    door => {

                        if (door.id === hiddenDoorId) return null;

                        const asset = getCachedDoorWindowAsset(door.assetId);


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

                                onSelect={onDoorSelect}

                            />

                        );

                    }
                )
            }

        </group>

    );

}