import { useEffect, useMemo, useState } from "react";
import "./FurniturePanel.css";
import { Search } from "lucide-react";
import AssetSection from "./AssetSection";
import type { Asset } from "../../../assets/Asset";
import { getFurnitureAssets } from "../../../engine/furniture/FirebaseFurnitureLibrary";
import { FURNITURE_CATEGORY_SECTIONS } from "../../../engine/furniture/FurnitureCategory";
import { useAssetFavorites } from "../../../context/useAssetFavorites";

function filterFurniture(
    assets: Asset[],
    query: string
): Asset[] {
    const q = query.trim().toLowerCase();

    if (!q) {
        return assets;
    }

    return assets.filter(
        asset => asset.name.toLowerCase().includes(q)
    );
}

export default function FurniturePanel() {
    const { favorites } = useAssetFavorites();
    const [furnitureAssets, setFurnitureAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let cancelled = false;

        getFurnitureAssets()
            .then(assets => {
                if (cancelled) {
                    return;
                }

                setFurnitureAssets(assets);
            })
            .catch(error => {
                console.error("Failed to load Firebase furniture:", error);

                if (!cancelled) {
                    setLoadError("Unable to load furniture.");
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

    const sections = useMemo(
        () =>
            FURNITURE_CATEGORY_SECTIONS.map(section => ({
                ...section,
                assets: filterFurniture(
                    furnitureAssets.filter(
                        asset =>
                            asset.furnitureCategory === section.category &&
                            !favorites.furniture.includes(asset.id)
                    ),
                    searchQuery
                )
            })),
        [furnitureAssets, searchQuery, favorites.furniture]
    );

    const favoriteFurniture = useMemo(
        () =>
            filterFurniture(
                furnitureAssets.filter(asset =>
                    favorites.furniture.includes(asset.id)
                ),
                searchQuery
            ),
        [furnitureAssets, favorites.furniture, searchQuery]
    );

    const isSearching = searchQuery.trim().length > 0;
    const hasResults =
        favoriteFurniture.length > 0 ||
        sections.some(section => section.assets.length > 0);
    return (
        <div className="furniture-panel">
            <div className="furniture-panel-search">
                <Search
                    size={16}
                    className="furniture-panel-search-icon"
                />
                <input
                    type="text"
                    placeholder="Search furniture"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label="Search furniture"
                />
            </div>

            {loading && (
                <p className="asset-empty">
                    Loading furniture...
                </p>
            )}

            {!loading && loadError && (
                <p className="asset-empty">
                    {loadError}
                </p>
            )}

            {!loading &&
                !loadError &&
                hasResults &&
                favoriteFurniture.length > 0 && (
                    <AssetSection
                        title="Favorites"
                        assets={favoriteFurniture}
                        defaultOpen
                        forceOpen={
                            isSearching
                                ? true
                                : undefined
                        }
                    />
                )}

            {!loading &&
                !loadError &&
                hasResults &&
                sections.map(section => {
                    if (section.assets.length === 0) {
                        return null;
                    }

                    return (
                        <AssetSection
                            key={section.category}
                            title={section.title}
                            assets={section.assets}
                            defaultOpen={section.category === "livingRoom"}
                            forceOpen={
                                isSearching
                                    ? true
                                    : undefined
                            }
                        />
                    );
                })}

            {!loading &&
                !loadError &&
                !hasResults && (
                    <p className="asset-empty">
                        No furniture found.
                    </p>
                )}
        </div>
    );
}