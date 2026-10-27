import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import AdminAssetCard from "./AdminAssetCard";
import "./AdminAssetSection.css";

interface AdminAssetSectionProps {
    title: string;
    assets: Asset[];
    selectedAsset: Asset | null;
    defaultOpen?: boolean;
    forceOpen?: boolean;
    statusMessage?: string;
    placementDisabled: boolean;
    isPlacementActive: boolean;
    placementWidth: number;
    placementHeight: number;
    openingWidth: number;
    openingHeight: number;
    archRise: number;
    onSelectAsset: (asset: Asset) => void;
    onActivatePlacement: () => void;
    onPlacementWidthChange: (value: number) => void;
    onPlacementHeightChange: (value: number) => void;
    onOpeningWidthChange: (value: number) => void;
    onOpeningHeightChange: (value: number) => void;
    onArchRiseChange: (value: number) => void;
    disabledReason: string;
    icon?: ReactNode;
}

export default function AdminAssetSection({
    title,
    assets,
    selectedAsset,
    defaultOpen = false,
    forceOpen,
    statusMessage,
    placementDisabled,
    isPlacementActive,
    placementWidth,
    placementHeight,
    openingWidth,
    openingHeight,
    archRise,
    onSelectAsset,
    onActivatePlacement,
    onPlacementWidthChange,
    onPlacementHeightChange,
    onOpeningWidthChange,
    onOpeningHeightChange,
    onArchRiseChange,
    disabledReason,
    icon
}: AdminAssetSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const visible = forceOpen ?? open;
    const selectedInSection = selectedAsset
        ? assets.some(asset => asset.id === selectedAsset.id)
        : false;
    const isOpening = title === "Openings" && selectedAsset?.type === "opening";

    return (
        <section className="admin-asset-section">
            <button
                type="button"
                className="admin-asset-section-header"
                aria-expanded={visible}
                onClick={() => setOpen(value => !value)}
            >
                <span className="admin-asset-section-title">
                    {icon}
                    {title}
                    <span className="admin-asset-count">{assets.length}</span>
                </span>
                <ChevronDown size={16} className={visible ? "open" : ""} />
            </button>
            <div className={`admin-asset-collapse ${visible ? "open" : ""}`}>
                <div className="admin-asset-collapse-inner">
                    {assets.length > 0 ? (
                        <div className="admin-asset-grid">
                            {assets.map(asset => (
                                <AdminAssetCard
                                    key={asset.id}
                                    asset={asset}
                                    selected={selectedAsset?.id === asset.id}
                                    onSelect={onSelectAsset}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="admin-asset-empty">{statusMessage ?? "No matches in this category."}</p>
                    )}
                    {selectedInSection && selectedAsset && (
                        <>
                            <div className="admin-asset-divider" />
                            <button
                                type="button"
                                className="admin-asset-settings-toggle"
                                aria-expanded={settingsOpen}
                                onClick={() => setSettingsOpen(value => !value)}
                            >
                                <span>Placement settings</span>
                                <ChevronDown size={14} className={settingsOpen ? "open" : ""} />
                            </button>
                            <div className={`admin-asset-settings-collapse ${settingsOpen ? "open" : ""}`}>
                                <div className="admin-asset-fields">
                                    {isOpening ? (
                                        <>
                                            <AdminField
                                                id="admin-opening-width"
                                                label="Width"
                                                value={openingWidth}
                                                onChange={onOpeningWidthChange}
                                            />
                                            <AdminField
                                                id="admin-opening-height"
                                                label="Height"
                                                value={openingHeight}
                                                onChange={onOpeningHeightChange}
                                            />
                                            {selectedAsset.openingShape === "arch" && (
                                                <AdminField
                                                    id="admin-opening-arch-rise"
                                                    label="Arch rise"
                                                    value={archRise}
                                                    onChange={onArchRiseChange}
                                                    max={openingHeight}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <AdminField
                                                id={`admin-${title.toLowerCase()}-width`}
                                                label="Width"
                                                value={placementWidth}
                                                onChange={onPlacementWidthChange}
                                            />
                                            <AdminField
                                                id={`admin-${title.toLowerCase()}-height`}
                                                label="Height"
                                                value={placementHeight}
                                                onChange={onPlacementHeightChange}
                                            />
                                            {selectedAsset.width && selectedAsset.height && (
                                                <p className="admin-asset-metadata">
                                                    Catalog dimensions: {selectedAsset.width} × {selectedAsset.height} m
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="admin-asset-apply">
                                {disabledReason && <p>{disabledReason}</p>}
                                <button
                                    type="button"
                                    className={isPlacementActive ? "active" : ""}
                                    disabled={placementDisabled}
                                    aria-pressed={isPlacementActive}
                                    onClick={onActivatePlacement}
                                >
                                    {isPlacementActive ? "Placement active — click the scene" : "Use selected asset"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

function AdminField({
    id,
    label,
    value,
    onChange,
    max = 20
}: {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    max?: number;
}) {
    return (
        <label className="admin-asset-field" htmlFor={id}>
            <span>{label}</span>
            <span className="admin-asset-field-input">
                <input
                    id={id}
                    type="number"
                    min="0.05"
                    max={max}
                    step="0.05"
                    value={value}
                    onChange={event => onChange(Number(event.target.value))}
                />
                <small>m</small>
            </span>
        </label>
    );
}
