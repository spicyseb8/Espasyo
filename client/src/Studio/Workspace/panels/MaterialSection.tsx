import "./MaterialSection.css";

import {
    Check,
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

    onApply?:
        () => void;

    onApplyToRoom?:
        () => void;

    onApplyToAll?:
        () => void;

    canApply?: boolean;

    canApplyToRoom?: boolean;

    canApplyToAll?: boolean;

    applyLabel?: string;

    applyToRoomLabel?: string;

    applyToAllLabel?: string;

}

export default function MaterialSection({

    title,

    materials,

    favoriteType,

    favoritesFirst,

    onToggleFavoritesFirst,

    selectedMaterialId,

    onSelect,

    onApply,


    onApplyToRoom,

    onApplyToAll,

    canApply = false,


    canApplyToRoom = false,

    canApplyToAll = false,

    applyLabel = "Apply",

    applyToRoomLabel = "Apply to Room",

    applyToAllLabel = "Apply to All"

}: Props) {
    const { isFavorite } = useAssetFavorites();
    const favoriteMaterials = favoritesFirst
        ? materials.filter(material =>
            isFavorite(favoriteType, material.id)
        )
        : [];
    const otherMaterials = favoritesFirst
        ? materials.filter(material =>
            !isFavorite(favoriteType, material.id)
        )
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
                    aria-label={
                        favoritesFirst
                            ? "Show original material order"
                            : "Show favorites first"
                    }
                    title={
                        favoritesFirst
                            ? "Show original order"
                            : "Show favorites first"
                    }
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

            <div
                className="material-scroll"
            >

                {
                    materials.length > 0
                        ? favoritesFirst
                            ? (
                                <>
                                    {favoriteMaterials.length > 0 && (
                                        <>
                                            <div className="material-group-label">
                                                Favorites
                                            </div>
                                            {renderMaterialGrid(favoriteMaterials)}
                                        </>
                                    )}
                                    {favoriteMaterials.length > 0 &&
                                        otherMaterials.length > 0 && (
                                            <div className="material-group-divider">
                                                All materials
                                            </div>
                                        )}
                                    {otherMaterials.length > 0 &&
                                        renderMaterialGrid(otherMaterials)}
                                </>
                            )
                            : renderMaterialGrid(materials)

                        : (

                            <p
                                className="material-empty"
                            >
                                No materials available.
                            </p>

                        )
                }

            </div>

            {/* =========================================
                ACTION BUTTONS
                ========================================= */}

            {
                (
                    onApply ||
                    onApplyToRoom ||
                    onApplyToAll
                ) && (

                    <div
                        className="material-actions"
                    >

                        {
                            onApply && (

                                <button

                                    type="button"

                                    className="material-apply-button"

                                    disabled={
                                        !canApply
                                    }

                                    onClick={
                                        onApply
                                    }

                                >

                                    <Check
                                        size={15}
                                    />

                                    {
                                        applyLabel
                                    }

                                </button>

                            )
                        }

                        {
                            onApplyToRoom && (

                                <button

                                    type="button"

                                    className="material-apply-room-button"

                                    disabled={
                                        !canApplyToRoom
                                    }

                                    onClick={
                                        onApplyToRoom
                                    }

                                >

                                    {
                                        applyToRoomLabel
                                    }

                                </button>

                            )
                        }

                        {
                            onApplyToAll && (

                                <button

                                    type="button"

                                    className="material-apply-all-button"

                                    disabled={
                                        !canApplyToAll
                                    }

                                    onClick={
                                        onApplyToAll
                                    }

                                >

                                    {
                                        applyToAllLabel
                                    }

                                </button>

                            )
                        }

                    </div>

                )
            }

        </section>
    );
}