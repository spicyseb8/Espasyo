import "./MaterialCard.css";

import {
    useState
} from "react";
import {
    Star
} from "lucide-react";

import type {
    Material
} from "../../../engine/materials/MaterialTypes";
import type {
    AssetFavoriteType
} from "../../../context/AssetFavoritesContext";
import { useAssetFavorites } from "../../../context/useAssetFavorites";

interface Props {

    material: Material;

    selected: boolean;

    onClick: () => void;

    favoriteType: AssetFavoriteType;
}

export default function MaterialCard({
    material,
    selected,
    onClick,
    favoriteType
}: Props) {

    const [
        imageFailed,
        setImageFailed
    ] = useState(false);

    const showImage =
        Boolean(
            material.thumbnail
        ) &&
        !imageFailed;
    const {
        isFavorite,
        toggleFavorite
    } = useAssetFavorites();
    const favorite = isFavorite(favoriteType, material.id);

    return (
        <div className="material-card-container">
            <button
                type="button"

                className={
                    `material-card ${
                        selected
                            ? "selected"
                            : ""
                    }`
                }

            onClick={
                onClick
            }

            aria-pressed={
                selected
            }

            >

            <div
                className="material-card-thumbnail"
            >

                {showImage ? (

                    <img

                        src={
                            material.thumbnail
                        }

                        alt={
                            material.name
                        }

                        onError={() =>
                            setImageFailed(
                                true
                            )
                        }

                    />

                ) : material.color ? (

                    <div

                        className="material-card-color"

                        style={{
                            backgroundColor:
                                material.color
                        }}

                        aria-label={
                            `${material.name} color`
                        }

                    />

                ) : (

                    <div
                        className="material-card-placeholder"
                    />

                )}

            </div>

            <div
                className="material-card-name"
            >
                {
                    material.name
                }
            </div>

            <div
                className="material-card-price"
            >

                ₱
                {
                    Number(
                        material.pricePerPiece ??
                        material.pricePerSquareMeter
                    ).toLocaleString()
                }

                <span>
                    {material.pricePerPiece !== undefined
                        ? "/tile"
                        : material.sourceCategory?.toLowerCase() === "paint"
                            ? "/L"
                            : "/m²"}
                </span>

            </div>

            </button>
            <button
                type="button"
                className={`material-card-favorite ${favorite ? "is-favorite" : ""}`}
                aria-label={favorite ? "Remove from Favorites" : "Add to Favorites"}
                title={favorite ? "Remove from Favorites" : "Add to Favorites"}
                aria-pressed={favorite}
                onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    void toggleFavorite(favoriteType, material.id);
                }}
            >
                <Star
                    size={12}
                    strokeWidth={2}
                    fill={favorite ? "currentColor" : "none"}
                />
            </button>
        </div>
    );
}