import { useEffect, useMemo, useState } from "react";
import "./FurniturePanel.css";
import {
    Armchair,
    Archive,
    Bath,
    BedDouble,
    BookOpen,
    Grid2X2,
    Refrigerator,
    Sofa,
    Sparkles,
    Table2,
    Toilet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Search, Star } from "lucide-react";
import AssetCard from "./AssetCard";
import type { Asset } from "../../../assets/Asset";
import useEditor from "../../../context/editor/useEditor";
import { BuildTool } from "../../../context/BuildTool";
import { getFurnitureAssets } from "../../../engine/furniture/FirebaseFurnitureLibrary";
import {
    FURNITURE_CATEGORY_SECTIONS,
    type FurnitureCategory,
} from "../../../engine/furniture/FurnitureCategory";
import { useAssetFavorites } from "../../../context/useAssetFavorites";

type FurnitureAssetCategory = Exclude<
    FurnitureCategory,
    "livingRoom" | "bedroom" | "diningRoom" | "kitchen" | "bathroom" | "office"
>;

const CATEGORY_ICONS: Record<FurnitureAssetCategory, LucideIcon> = {
    tables: Table2,
    beds: BedDouble,
    decorations: Sparkles,
    toilets: Toilet,
    vanity: Bath,
    cabinets: Archive,
    appliances: Refrigerator,
    chairs: Armchair,
    sofas: Sofa,
    lavatory: Bath,
    shelves: BookOpen,
};

const ROOM_CATEGORIES = new Set<FurnitureCategory>([
    "livingRoom",
    "bedroom",
    "diningRoom",
    "kitchen",
    "bathroom",
    "office",
]);

const FURNITURE_CATEGORIES = FURNITURE_CATEGORY_SECTIONS.filter(
    (section): section is (typeof FURNITURE_CATEGORY_SECTIONS)[number] & {
        category: FurnitureAssetCategory;
    } => !ROOM_CATEGORIES.has(section.category)
);

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

interface Props {
    onClose: () => void;
}

export default function FurniturePanel({ onClose }: Props) {
    const { state, dispatch } = useEditor();
    const { favorites } = useAssetFavorites();
    const [furnitureAssets, setFurnitureAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] =
        useState<FurnitureAssetCategory | "all" | "favorites">("all");

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

    const visibleFurniture = useMemo(
        () => filterFurniture(
            furnitureAssets.filter(asset => {
                if (
                    activeCategory === "favorites" &&
                    !favorites.furniture.includes(asset.id)
                ) {
                    return false;
                }

                return activeCategory === "all" ||
                    activeCategory === "favorites" ||
                    asset.furnitureCategory === activeCategory;
            }),
            searchQuery
        ),
        [activeCategory, favorites.furniture, furnitureAssets, searchQuery]
    );

    const hasResults = visibleFurniture.length > 0;
    const canApply = state.selectedAsset?.type === BuildTool.Furniture;

    return (
        <div className="furniture-panel">
            <nav className="furniture-category-nav" aria-label="Furniture categories">
                <button
                    type="button"
                    className={`furniture-category-button${activeCategory === "all" ? " active" : ""}`}
                    aria-label="All furniture"
                    title="All furniture"
                    aria-pressed={activeCategory === "all"}
                    onClick={() => setActiveCategory("all")}
                >
                    <Grid2X2 size={17} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`furniture-category-button${activeCategory === "favorites" ? " active" : ""}`}
                    aria-label="Favorite furniture"
                    title="Favorites"
                    aria-pressed={activeCategory === "favorites"}
                    onClick={() => setActiveCategory("favorites")}
                >
                    <Star size={17} aria-hidden="true" />
                </button>
                {FURNITURE_CATEGORIES.map(section => {
                    const Icon = CATEGORY_ICONS[section.category];
                    return (
                        <button
                            key={section.category}
                            type="button"
                            className={`furniture-category-button${activeCategory === section.category ? " active" : ""}`}
                            aria-label={section.title}
                            title={section.title}
                            aria-pressed={activeCategory === section.category}
                            onClick={() => setActiveCategory(section.category)}
                        >
                            <Icon size={17} aria-hidden="true" />
                        </button>
                    );
                })}
            </nav>

            <div className="furniture-panel-main">
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
                    <p className="asset-empty furniture-panel-empty">
                        Loading furniture...
                    </p>
                )}

                {!loading && loadError && (
                    <p className="asset-empty furniture-panel-empty">
                        {loadError}
                    </p>
                )}

                {!loading && !loadError && hasResults && (
                    <div className="furniture-panel-grid">
                        <div className="furniture-panel-grid-inner">
                            {visibleFurniture.map(asset => (
                                <AssetCard
                                    key={asset.id}
                                    asset={asset}
                                    showInformation={false}
                                    categoryLabel={
                                        FURNITURE_CATEGORIES.find(
                                            section =>
                                                section.category === asset.furnitureCategory
                                        )?.title ?? "Furniture"
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}

                {!loading && !loadError && !hasResults && (
                    <p className="asset-empty furniture-panel-empty">
                        No furniture found.
                    </p>
                )}

                <footer className="furniture-panel-actions">
                    <button
                        type="button"
                        className="furniture-apply-button"
                        disabled={!canApply}
                        onClick={() => {
                            if (!canApply) {
                                return;
                            }
                            dispatch({ type: "APPLY_SELECTED_ASSET" });
                            onClose();
                        }}
                    >
                        Apply
                    </button>
                </footer>
            </div>
        </div>
    );
}