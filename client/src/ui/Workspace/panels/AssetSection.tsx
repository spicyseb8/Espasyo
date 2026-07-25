import "./AssetSection.css";

import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import AssetCard from "./AssetCard";

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

    const [open, setOpen] = useState(defaultOpen);
    const isOpen = forceOpen ?? open;

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
                </div>
            </div>

        </section>
    );
}