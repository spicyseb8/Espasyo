import {
    getCachedFurnitureAsset,
    getCachedFurnitureAssets
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
    onAssetError: (assetId: string) => void;

}


//==================================================
// ADMIN FURNITURES
//==================================================

export default function AdminFurnitures({
    furniture,
    onAssetError
}: AdminFurnituresProps) {
    const assets = getCachedFurnitureAssets();

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
                            ) ??
                            getCachedFurnitureAsset(
                                item.assetId
                            );


                        if (
                            !asset
                        ) {

                            console.warn(
                                "Admin furniture asset not found:",
                                item.assetId
                            );
                            onAssetError(item.assetId);

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
                                onAssetError={onAssetError}
                            />

                        );

                    }
                )
            }

        </group>

    );

}