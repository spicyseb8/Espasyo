import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import type { ManagedStructure } from "./structureTypes";
import type { AdminStructuralTool } from "./AdminFloorPlanPanel";
import AdminAssetSection from "./AdminAssetSection";
import "./AdminBuildPanel.css";

const OPENING_ASSETS: Asset[] = [
    {
        id: "opening-rectangle",
        name: "Rectangle Opening",
        thumbnail: "",
        model: "",
        type: "opening",
        price: 0,
        openingShape: "rectangle"
    },
    {
        id: "opening-arch",
        name: "Arch Opening",
        thumbnail: "",
        model: "",
        type: "opening",
        price: 0,
        openingShape: "arch"
    }
];

interface AdminBuildPanelProps {
    structure: ManagedStructure;
    doors: Asset[];
    windows: Asset[];
    loading: boolean;
    loadError: string;
    selectedAsset: Asset | null;
    tool: AdminStructuralTool;
    placementWidth: number;
    placementHeight: number;
    onSelectAsset: (asset: Asset) => void;
    onActivateAsset: (asset: Asset) => void;
    onPlacementWidthChange: (value: number) => void;
    onPlacementHeightChange: (value: number) => void;
    onOpeningWidthChange: (value: number) => void;
    onOpeningHeightChange: (value: number) => void;
    onArchRiseChange: (value: number) => void;
}

function assetTool(asset: Asset): AdminStructuralTool | null {
    if (asset.type === "door" || asset.type === "window" || asset.type === "opening") {
        return asset.type;
    }
    return null;
}

export default function AdminBuildPanel({
    structure,
    doors,
    windows,
    loading,
    loadError,
    selectedAsset,
    tool,
    placementWidth,
    placementHeight,
    onSelectAsset,
    onActivateAsset,
    onPlacementWidthChange,
    onPlacementHeightChange,
    onOpeningWidthChange,
    onOpeningHeightChange,
    onArchRiseChange
}: AdminBuildPanelProps) {
    const [query, setQuery] = useState("");
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const sections = useMemo(() => {
        const filterAssets = (assets: Asset[]) => normalizedQuery
            ? assets.filter(asset => asset.name.toLocaleLowerCase().includes(normalizedQuery))
            : assets;
        return [
            { title: "Openings", assets: filterAssets(OPENING_ASSETS), defaultOpen: true },
            { title: "Doors", assets: filterAssets(doors), defaultOpen: false },
            { title: "Windows", assets: filterAssets(windows), defaultOpen: false }
        ];
    }, [doors, windows, normalizedQuery]);
    const placementDisabled =
        !structure.layoutConfirmed ||
        selectedAsset === null;
    const disabledReason = !structure.layoutConfirmed
        ? "Confirm the floor plan before placing doors, windows, or openings."
        : "Move over a wall in the scene, then click to place the selected asset.";

    return (
        <div className="admin-build-panel">
            {!structure.layoutConfirmed && (
                <p className="admin-build-lock-notice">
                    Confirm the floor plan before placing doors, windows, or openings.
                </p>
            )}
            <label className="admin-build-search">
                <Search size={15} aria-hidden="true" />
                <input
                    type="search"
                    placeholder="Search assets"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    aria-label="Search build assets"
                />
            </label>
            {loading && (
                <p className="admin-build-catalog-status" role="status">
                    Loading doors and windows...
                </p>
            )}
            {loadError && (
                <p className="admin-build-catalog-error" role="alert">
                    {loadError}
                </p>
            )}
            <div className="admin-build-sections">
                {sections.map(section => (
                    <AdminAssetSection
                        key={section.title}
                        title={section.title}
                        assets={section.assets}
                        selectedAsset={selectedAsset}
                        defaultOpen={section.defaultOpen}
                        forceOpen={normalizedQuery.length > 0 ? true : undefined}
                        statusMessage={
                            section.title !== "Openings" && loading
                                ? "Loading catalog..."
                                : undefined
                        }
                        placementDisabled={placementDisabled}
                        isPlacementActive={selectedAsset !== null && tool === assetTool(selectedAsset)}
                        placementWidth={placementWidth}
                        placementHeight={placementHeight}
                        openingWidth={structure.openingWidth}
                        openingHeight={structure.openingHeight}
                        archRise={structure.archRise}
                        onSelectAsset={onSelectAsset}
                        onActivatePlacement={() => {
                            if (selectedAsset) onActivateAsset(selectedAsset);
                        }}
                        onPlacementWidthChange={onPlacementWidthChange}
                        onPlacementHeightChange={onPlacementHeightChange}
                        onOpeningWidthChange={onOpeningWidthChange}
                        onOpeningHeightChange={onOpeningHeightChange}
                        onArchRiseChange={onArchRiseChange}
                        disabledReason={disabledReason}
                    />
                ))}
            </div>
        </div>
    );
}
