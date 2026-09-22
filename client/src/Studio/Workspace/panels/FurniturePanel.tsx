import {
    useEffect,
    useMemo,
    useState
} from "react";
import "./FurniturePanel.css";
import {
    Search
} from "lucide-react";

import AssetSection
    from "./AssetSection";

import type {
    Asset
} from "../../../assets/Asset";

import {
    getFurnitureAssets
} from "../../../engine/furniture/FirebaseFurnitureLibrary";

import type {
    FurnitureCategory
} from "../../../engine/furniture/FurnitureCategory";


//==================================================
// SECTIONS
//==================================================

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


//==================================================
// SEARCH
//==================================================

function filterFurniture(
    assets: Asset[],
    query: string
): Asset[] {

    const q =
        query
            .trim()
            .toLowerCase();

    if (!q) {
        return assets;
    }

    return assets.filter(
        asset =>
            asset.name
                .toLowerCase()
                .includes(q)
    );
}


//==================================================
// PANEL
//==================================================

export default function FurniturePanel() {

    const [
        furnitureAssets,
        setFurnitureAssets
    ] = useState<Asset[]>([]);

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        loadError,
        setLoadError
    ] = useState<string | null>(
        null
    );

    const [
        searchQuery,
        setSearchQuery
    ] = useState("");


    //==================================================
    // LOAD FIREBASE FURNITURE
    //==================================================

    useEffect(() => {

        let cancelled =
            false;

        setLoading(true);
        setLoadError(null);

        getFurnitureAssets()
            .then(assets => {

                if (cancelled) {
                    return;
                }

                setFurnitureAssets(
                    assets
                );

            })
            .catch(error => {

                console.error(
                    "Failed to load Firebase furniture:",
                    error
                );

                if (!cancelled) {

                    setLoadError(
                        "Unable to load furniture."
                    );

                }

            })
            .finally(() => {

                if (!cancelled) {

                    setLoading(false);

                }

            });


        return () => {

            cancelled = true;

        };

    }, []);


    //==================================================
    // FILTERED SECTIONS
    //==================================================

    const sections =
        useMemo(
            () => {

                return furnitureSections.map(
                    section => {

                        const categoryAssets =
                            furnitureAssets.filter(
                                asset =>
                                    asset.furnitureCategory ===
                                    section.category
                            );

                        return {

                            ...section,

                            assets:
                                filterFurniture(
                                    categoryAssets,
                                    searchQuery
                                )

                        };

                    }
                );

            },
            [
                furnitureAssets,
                searchQuery
            ]
        );


    const isSearching =
        searchQuery.trim().length > 0;


    const hasResults =
        sections.some(
            section =>
                section.assets.length > 0
        );


    //==================================================
    // RENDER
    //==================================================

    return (

        <div className="furniture-panel">

            {/* ------------------------------------------
                FURNITURE SEARCH
            ------------------------------------------ */}

            <div className="furniture-panel-search">

                <Search
                    size={16}
                    className="furniture-panel-search-icon"
                />

                <input
                    type="text"
                    placeholder="Search furniture"
                    value={searchQuery}
                    onChange={e =>
                        setSearchQuery(
                            e.target.value
                        )
                    }
                    aria-label="Search furniture"
                />

            </div>


            {/* ------------------------------------------
                LOADING
            ------------------------------------------ */}

            {loading && (

                <p className="asset-empty">
                    Loading furniture...
                </p>

            )}


            {/* ------------------------------------------
                ERROR
            ------------------------------------------ */}

            {!loading &&
                loadError && (

                    <p className="asset-empty">
                        {loadError}
                    </p>

                )
            }


            {/* ------------------------------------------
                RESULTS
            ------------------------------------------ */}

            {!loading &&
                !loadError &&
                hasResults && (

                    sections.map(
                        section => {

                            if (
                                section.assets.length === 0
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
                                        section.assets
                                    }

                                    defaultOpen={
                                        section.category ===
                                        "livingRoom"
                                    }

                                    forceOpen={
                                        isSearching
                                            ? true
                                            : undefined
                                    }

                                />

                            );

                        }
                    )

                )
            }


            {/* ------------------------------------------
                NO RESULTS
            ------------------------------------------ */}

            {!loading &&
                !loadError &&
                !hasResults && (

                    <p className="asset-empty">
                        No furniture found.
                    </p>

                )
            }

        </div>
    );
}