import "./AssetCard.css";
import { Check } from "lucide-react";
import useEditor from "../../../context/editor/useEditor";
import type { Asset } from "../../../assets/Asset";

interface Props {
    asset: Asset;
}

export default function AssetCard({
    asset
}: Props) {
    const { state, dispatch } = useEditor();

    const selected = state.selectedAsset?.id === asset.id;

    return (
        <button
            className={`asset-card ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            onClick={() => {
                // Selecting only ever marks the pending choice - it does
                // not arm placement (that's SET_BUILD_TOOL, fired from the
                // Apply button in AssetSection.tsx). Clicking an already-
                // selected card deselects it.
                dispatch({
                    type: "SET_SELECTED_ASSET",
                    payload: selected ? null : asset
                });
            }}
        >
            <div className="asset-thumb">
                <img
                    src={asset.thumbnail}
                    alt={asset.name}
                />
                {selected && (
                    <span className="selected-badge">
                        <Check size={12} strokeWidth={3} />
                    </span>
                )}
            </div>
            <div>
    <span>{asset.name}</span>
    <small>
        ₱{asset.price.toLocaleString()}
    </small>
</div>
        </button>
    );
}