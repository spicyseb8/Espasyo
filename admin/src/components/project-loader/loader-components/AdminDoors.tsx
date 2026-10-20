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

}


export default function AdminDoors({
    doors,
    wallThickness
}: AdminDoorsProps) {
    return (

        <group>

            {
                doors.map(
                    door => {

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

                            />

                        );

                    }
                )
            }

        </group>

    );

}