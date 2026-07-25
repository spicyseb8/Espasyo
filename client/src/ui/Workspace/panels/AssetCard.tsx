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
                dispatch({
                    type: "SET_SELECTED_ASSET",
                    payload: asset
                });
                dispatch({
                    type: "SET_BUILD_TOOL",
                    payload: asset.type
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
            <span>
                {asset.name}
            </span>
        </button>
    );
}