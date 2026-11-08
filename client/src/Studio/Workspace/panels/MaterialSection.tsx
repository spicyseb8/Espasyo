import "./MaterialSection.css";

import {
    Grid2X2,
    Layers,
    Rows2,
    Star
} from "lucide-react";

import type {
    Material
} from "../../../engine/materials/MaterialTypes";

import MaterialCard
    from "./MaterialCard";
import type {
    AssetFavoriteType
} from "../../../context/AssetFavoritesContext";
import { useAssetFavorites } from "../../../context/useAssetFavorites";

interface Props {

    title: string;

    materials: Material[];

    favoriteType: AssetFavoriteType;

    favoritesFirst: boolean;

    onToggleFavoritesFirst: () => void;

    selectedMaterialId:
        string | null;

    onSelect:
        (materialId: string) => void;

    flooringCategory?: "all" | "tiles" | "wood";

    onFlooringCategoryChange?: (
        category: "all" | "tiles" | "wood"
    ) => void;

}

export default function MaterialSection({

    title,

    materials,

    favoriteType,

    favoritesFirst,

    onToggleFavoritesFirst,

    selectedMaterialId,

    onSelect,

    flooringCategory,

    onFlooringCategoryChange

}: Props) {
    const { isFavorite } = useAssetFavorites();
    const orderedMaterials = favoritesFirst
        ? [
            ...materials.filter(material =>
                isFavorite(favoriteType, material.id)
            ),
            ...materials.filter(material =>
                !isFavorite(favoriteType, material.id)
            )
        ]
        : materials;

    const renderMaterialGrid = (items: Material[]) => (
        <div className="material-grid">
            {items.map(material => (
                <MaterialCard
                    key={material.id}
                    material={material}
                    selected={selectedMaterialId === material.id}
                    onClick={() => onSelect(material.id)}
                    favoriteType={favoriteType}
                />
            ))}
        </div>
    );

    return (

        <section
            className="material-section"
        >

            {/* =========================================
                HEADER
                ========================================= */}

            <div
                className="material-section-header"
            >

                <span
                    className="material-section-title"
                >

                    {title}

                    <span
                        className="material-section-count"
                    >
                        {
                            materials.length
                        }
                    </span>

                </span>

                <button
                    type="button"
                    className={`material-favorites-toggle ${favoritesFirst ? "is-active" : ""}`}
                    aria-label="Show favorites"
                    title="Show favorites"
                    aria-pressed={favoritesFirst}
                    onClick={onToggleFavoritesFirst}
                >
                    <Star
                        size={15}
                        strokeWidth={2}
                        fill={favoritesFirst ? "currentColor" : "none"}
                    />
                </button>

            </div>

            {/* =========================================
                SCROLLABLE MATERIAL AREA
                ========================================= */}

            <div className="material-section-body">
                {onFlooringCategoryChange && (
                    <nav
                        className="flooring-category-nav"
                        aria-label="Flooring categories"
                    >
                        {([
                            { id: "all", label: "All", Icon: Layers },
                            { id: "tiles", label: "Tiles", Icon: Grid2X2 },
                            { id: "wood", label: "Wood", Icon: Rows2 }
                        ] as const).map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                type="button"
                                className={`flooring-category-button${
                                    flooringCategory === id ? " active" : ""
                                }`}
                                aria-label={label}
                                aria-pressed={flooringCategory === id}
                                title={label}
                                onClick={() =>
                                    onFlooringCategoryChange(id)
                                }
                            >
                                <Icon size={16} aria-hidden="true" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </nav>
                )}

                <div
                    className="material-scroll"
                >

                    {
                        materials.length > 0
                            ? renderMaterialGrid(orderedMaterials)
                            : (

                                <p
                                    className="material-empty"
                                >
                                    No materials available.
                                </p>

                            )
                    }

                </div>
            </div>

        </section>
    );
}