import "./AssetSection.css";

import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import AssetCard from "./AssetCard";

import useEditor from "../../../context/editor/useEditor";
import type { Asset } from "../../../assets/Asset";


interface Props {
    title: string;
    assets: Asset[];
    icon?: ReactNode;
    defaultOpen?: boolean;
    forceOpen?: boolean;
}

export default function AssetSection({
    title,
    assets,
    icon,
    defaultOpen = false,
    forceOpen
}: Props) {

    const { state, dispatch } = useEditor();

    const [open, setOpen] = useState(defaultOpen);
    const isOpen = forceOpen ?? open;

    // The Apply button only lights up in the section the pending selection
    // actually belongs to - selecting a door in "Doors" shouldn't let you
    // hit Apply from inside "Windows".
    const pendingAsset = state.selectedAsset ?? null;
    const pendingInThisSection = pendingAsset
        ? assets.some(asset => asset.id === pendingAsset.id)
        : false;

    const handleApply = () => {
        if (!pendingAsset) return;

        dispatch({
            type: "APPLY_SELECTED_ASSET"
        });
    };

    return (
        <section className="asset-section">

            <button
                className="asset-section-header"
                onClick={() => setOpen(o => !o)}
                aria-expanded={isOpen}
            >
                <span className="asset-section-title">
                    {icon}
                    {title}
                    <span className="asset-count">{assets.length}</span>
                </span>
                <ChevronDown
                    size={16}
                    className={`asset-chevron ${isOpen ? "open" : ""}`}
                />
            </button>

            <div className={`asset-collapse ${isOpen ? "open" : ""}`}>
                <div className="asset-collapse-inner">
                    {
                        assets.length > 0 ? (
                            <div className="asset-grid">
                                {
                                    assets.map(asset => (
                                        <AssetCard
                                            key={asset.id}
                                            asset={asset}
                                        />
                                    ))
                                }
                            </div>
                        ) : (
                            <p className="asset-empty">No matches in this category.</p>
                        )
                    }

                    <div className="asset-apply-row">
                        <button
                            type="button"
                            className="asset-apply-button"
                            disabled={!pendingInThisSection}
                            onClick={handleApply}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>

        </section>
    );
}