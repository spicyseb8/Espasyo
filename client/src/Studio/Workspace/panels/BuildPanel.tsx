import "./BuildPanel.css";

import { useMemo, useState } from "react";

import { Search } from "lucide-react";

import AssetSection from "./AssetSection";

import { AssetLibrary } from "../../../assets/AssetLibrary";
import type { Asset } from "../../../assets/Asset";

function filterAssets(assets: Asset[], query: string) {
    if (!query) return assets;
    const q = query.toLowerCase();
    return assets.filter(asset => asset.name.toLowerCase().includes(q));
}

export default function BuildPanel() {

    const [query, setQuery] = useState("");

    const sections = useMemo(() => ([
        { title: "Openings", assets: AssetLibrary.openings },
        { title: "Doors", assets: AssetLibrary.doors},
        { title: "Windows", assets: AssetLibrary.windows },
    ]), []);

    const isSearching = query.trim().length > 0;

    // NOTE: Confirm Layout button has moved out of BuildPanel - see
    // FurniturePanel.tsx (pending). The Apply button also moved: it's now
    // per-section, rendered inside AssetSection.tsx instead of here.

    return (
        <div className="build-panel">

            <div className="build-panel-search">
                <Search size={14} className="build-panel-search-icon" />
                <input
                    type="text"
                    placeholder="Search assets"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            <div className="build-panel-sections">
                {
                    sections.map(section => (
                        <AssetSection
                            key={section.title}
                            title={section.title}

                            assets={filterAssets(section.assets, query)}
                            defaultOpen={section.title === "Openings"}
                            forceOpen={isSearching ? true : undefined}
                        />
                    ))
                }
            </div>


        </div>
    );
}