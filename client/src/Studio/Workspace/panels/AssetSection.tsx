import "./AssetSection.css";

import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronDown, Check } from "lucide-react";

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

    // NOTE: this fires the same SET_BUILD_TOOL dispatch that used to live
    // in AssetCard.tsx's onClick. I'm also immediately clearing the
    // selection afterward so Apply goes back to disabled and has to be
    // pressed again for the next placement - but since I don't have
    // whatever component actually places the asset in the scene (and
    // resets/consumes the build tool once placement is done), I can't
    // confirm this clears at the right moment relative to that placement.
    // If assets stop placing correctly, or you want the reset to happen
    // only after the asset is actually dropped in the scene rather than
    // the instant Apply is clicked, share that file and I'll rewire this
    // to hook into the real placement-complete event instead.
    const handleApply = () => {
        if (!pendingAsset) return;

        dispatch({
            type: "SET_BUILD_TOOL",
            payload: pendingAsset.type
        });

        dispatch({
            type: "SET_SELECTED_ASSET",
            payload: null
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
                            <Check size={16} />
                            Apply
                        </button>
                    </div>
                </div>
            </div>

        </section>
    );
}