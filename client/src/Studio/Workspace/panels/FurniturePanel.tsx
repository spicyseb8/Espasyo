import AssetSection from "./AssetSection";

import {
    AssetLibrary
} from "../../../assets/AssetLibrary";

import type {
    FurnitureCategory
} from "../../../engine/furniture/FurnitureCategory";

const furnitureSections: {
    title: string;
    category: FurnitureCategory;
}[] = [

    {
        title: "Living Room",
        category: "livingRoom"
    },

    {
        title: "Bedroom",
        category: "bedroom"
    },

    {
        title: "Dining Room",
        category: "diningRoom"
    },

    {
        title: "Kitchen",
        category: "kitchen"
    },

    {
        title: "Bathroom",
        category: "bathroom"
    },

    {
        title: "Office",
        category: "office"
    }

];

export default function FurniturePanel() {

    return (

        <div className="furniture-panel">

            {
                furnitureSections.map(
                    section => {

                        const assets =
                            AssetLibrary.furniture.filter(
                                asset =>
                                    asset.furnitureCategory ===
                                    section.category
                            );

                        if (
                            assets.length === 0
                        ) {
                            return null;
                        }

                        return (

                            <AssetSection
                                key={
                                    section.category
                                }

                                title={
                                    section.title
                                }

                                assets={
                                    assets
                                }

                                defaultOpen={
                                    section.category ===
                                    "livingRoom"
                                }
                            />

                        );

                    }
                )
            }

        </div>
    );
}