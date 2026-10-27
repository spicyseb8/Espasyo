import { useState } from "react";
import { Check } from "lucide-react";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import "./AdminAssetCard.css";

interface AdminAssetCardProps {
    asset: Asset;
    selected: boolean;
    onSelect: (asset: Asset) => void;
}

export default function AdminAssetCard({
    asset,
    selected,
    onSelect
}: AdminAssetCardProps) {
    const [thumbnailError, setThumbnailError] = useState(false);
    const hasThumbnail = Boolean(asset.thumbnail?.trim()) && !thumbnailError;

    return (
        <button
            type="button"
            className={`admin-asset-card ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelect(asset)}
        >
            <span className="admin-asset-thumb">
                {hasThumbnail ? (
                    <img
                        src={asset.thumbnail}
                        alt={asset.name}
                        loading="lazy"
                        onError={() => setThumbnailError(true)}
                    />
                ) : (
                    <span className="admin-asset-thumb-empty">
                        {asset.model ? "Preview unavailable" : "No preview"}
                    </span>
                )}
                {selected && (
                    <span className="admin-asset-selected">
                        <Check size={12} strokeWidth={3} />
                    </span>
                )}
            </span>
            <span className="admin-asset-card-copy">
                <span title={asset.name}>{asset.name}</span>
                <small>
                    {asset.price == null
                        ? "Price unavailable"
                        : `₱${asset.price.toLocaleString()}`}
                </small>
            </span>
        </button>
    );
}
