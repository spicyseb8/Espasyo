import "./AssetCard.css";

import {
    useState
} from "react";

import {
    Check,
    Info,
    Star
} from "lucide-react";

import useEditor
    from "../../../context/editor/useEditor";

import type {
    Asset
} from "../../../assets/Asset";

import {
    BuildTool
} from "../../../context/BuildTool";
import {
    useAssetFavorites
} from "../../../context/useAssetFavorites";

interface Props {
    asset: Asset;
    categoryLabel?: string;
    showInformation?: boolean;
}


export default function AssetCard({
    asset,
    categoryLabel,
    showInformation = true
}: Props) {

    const {
        state,
        dispatch
    } = useEditor();

    const [
        thumbnailError,
        setThumbnailError
    ] = useState(false);
    const {
        isFavorite,
        toggleFavorite
    } = useAssetFavorites();
    const [showInfo, setShowInfo] = useState(false);

    const isFurniture = asset.type === BuildTool.Furniture;
    const favorite =
        isFurniture &&
        isFavorite("furniture", asset.id);
    const selected =
        state.selectedAsset?.id ===
        asset.id;


    const hasThumbnail =
        Boolean(asset.thumbnail?.trim()) &&
        !thumbnailError;


    return (

        <div className="asset-card-container">
            <button
                type="button"
                className={
                    `asset-card ${
                        selected
                            ? "selected"
                            : ""
                    }`
                }

            aria-pressed={
                selected
            }

            onClick={() => {

                //--------------------------------------------------
                // Clicking only selects the asset.
                // It does not immediately start placement.
                //--------------------------------------------------

                dispatch({
                    type:
                        "SET_BUILD_TOOL",

                    payload:
                        BuildTool.None
                });


                //--------------------------------------------------
                // Select / deselect pending asset
                //--------------------------------------------------

                dispatch({
                    type:
                        "SET_SELECTED_ASSET",

                    payload:
                        selected
                            ? null
                            : asset
                });

            }}
            >

            <div
                className="asset-thumb"
            >

                {hasThumbnail ? (

                    <img
                        src={
                            asset.thumbnail
                        }

                        alt={
                            asset.name
                        }

                        onError={() => {
                            setThumbnailError(true);
                        }}
                    />

                ) : (

                    <div className="asset-thumb-empty">
                        {asset.model ? "Preview unavailable" : "No preview"}
                    </div>

                )}


                {
                    selected && (

                        <span
                            className="selected-badge"
                        >

                            <Check
                                size={12}
                                strokeWidth={3}
                            />

                        </span>

                    )
                }

            </div>


            <div className="asset-card-details">

                <span
                    className="asset-card-name"
                    title={asset.name}
                >
                    {
                        asset.name
                    }
                </span>

                <small>

                    ₱

                    {
                        asset.price == null
                            ? "Price unavailable"
                            : asset.price.toLocaleString()
                    }

                </small>
                {categoryLabel && (
                    <small className="asset-card-category">
                        {categoryLabel}
                    </small>
                )}

            </div>

            </button>
            {isFurniture && (
                <button
                    type="button"
                    className={`asset-card-favorite ${favorite ? "is-favorite" : ""}`}
                    aria-label={favorite ? "Remove from Favorites" : "Add to Favorites"}
                    title={favorite ? "Remove from Favorites" : "Add to Favorites"}
                    aria-pressed={favorite}
                    onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        void toggleFavorite("furniture", asset.id);
                    }}
                >
                    <Star
                        size={13}
                        strokeWidth={2}
                        fill={favorite ? "currentColor" : "none"}
                    />
                </button>
            )}
            {showInformation && (
                <>
                    <button
                        type="button"
                        className={`asset-card-info${showInfo ? " is-open" : ""}`}
                        aria-label={`Information about ${asset.name}`}
                        aria-expanded={showInfo}
                        title="Asset information"
                        onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            setShowInfo(value => !value);
                        }}
                    >
                        <Info size={13} strokeWidth={2} />
                    </button>
                    {showInfo && (
                        <div className="asset-card-information" role="status">
                            <strong>{asset.name}</strong>
                            <span>{categoryLabel ?? "Furniture"}</span>
                            <span>
                                {asset.price == null
                                    ? "Price unavailable"
                                    : `₱${asset.price.toLocaleString()}`}
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}