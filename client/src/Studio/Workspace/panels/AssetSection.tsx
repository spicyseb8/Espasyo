import "./AssetSection.css";

import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import AssetCard from "./AssetCard";

import useEditor from "../../../context/editor/useEditor";
import type { Asset } from "../../../assets/Asset";
import { BuildTool } from "../../../context/BuildTool";


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
    const [settingsOpen, setSettingsOpen] = useState(false);

    const isOpen = forceOpen ?? open;


    // --------------------------------------------------
    // Pending asset
    // --------------------------------------------------

    const pendingAsset = state.selectedAsset ?? null;

    const pendingInThisSection = pendingAsset
        ? assets.some(asset => asset.id === pendingAsset.id)
        : false;


    // --------------------------------------------------
    // Apply
    // --------------------------------------------------

    const handleApply = () => {

        if (!pendingAsset) return;

        dispatch({
            type: "APPLY_SELECTED_ASSET"
        });

    };


    // --------------------------------------------------
    // Opening settings?
    // --------------------------------------------------

    const showOpeningSettings =
        title === "Openings" &&
        pendingAsset?.type === BuildTool.Opening;


    // --------------------------------------------------
    // Render
    // --------------------------------------------------

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

                    <span className="asset-count">
                        {assets.length}
                    </span>

                </span>

                <ChevronDown
                    size={16}
                    className={`asset-chevron ${
                        isOpen ? "open" : ""
                    }`}
                />

            </button>


            <div
                className={`asset-collapse ${
                    isOpen ? "open" : ""
                }`}
            >

                <div className="asset-collapse-inner">

                    {/* -------------------------------- */}
                    {/* Asset cards */}
                    {/* -------------------------------- */}

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

                            <p className="asset-empty">
                                No matches in this category.
                            </p>

                        )
                    }


                    {/* -------------------------------- */}
                    {/* Opening settings (collapsible) */}
                    {/* -------------------------------- */}

                    {
                        showOpeningSettings && pendingAsset && (

                            <>

                                <div className="asset-divider" />

                                <button
                                    type="button"
                                    className="asset-settings-toggle"
                                    onClick={() => setSettingsOpen(s => !s)}
                                    aria-expanded={settingsOpen}
                                >

                                    <span>
                                    
                                        Settings
                                    </span>

                                    <ChevronDown
                                        size={14}
                                        className={`asset-chevron ${
                                            settingsOpen ? "open" : ""
                                        }`}
                                    />

                                </button>

                                <div
                                    className={`asset-settings-collapse ${
                                        settingsOpen ? "open" : ""
                                    }`}
                                >

                                    <div className="asset-settings-collapse-inner">

                                        <div className="field-grid">

                                            {/* Width */}

                                            <div className="field">

                                                <label htmlFor="opening-width">
                                                    Width
                                                </label>

                                                <div className="field-input">

                                                    <input
                                                        id="opening-width"
                                                        type="number"
                                                        min="0.1"
                                                        max="20"
                                                        step="0.05"
                                                        value={state.openingWidth}
                                                        onChange={(e) => {

                                                            const value =
                                                                Number(e.target.value);

                                                            if (value <= 0) return;

                                                            dispatch({
                                                                type:
                                                                    "SET_OPENING_WIDTH",
                                                                payload: value
                                                            });

                                                        }}
                                                    />

                                                    <span className="field-unit">
                                                        m
                                                    </span>

                                                </div>

                                            </div>


                                            {/* Height */}

                                            <div className="field">

                                                <label htmlFor="opening-height">
                                                    Height
                                                </label>

                                                <div className="field-input">

                                                    <input
                                                        id="opening-height"
                                                        type="number"
                                                        min="0.1"
                                                        max="20"
                                                        step="0.05"
                                                        value={state.openingHeight}
                                                        onChange={(e) => {

                                                            const value =
                                                                Number(e.target.value);

                                                            if (value <= 0) return;

                                                            dispatch({
                                                                type:
                                                                    "SET_OPENING_HEIGHT",
                                                                payload: value
                                                            });

                                                        }}
                                                    />

                                                    <span className="field-unit">
                                                        m
                                                    </span>

                                                </div>

                                            </div>


                                            {/* Arch Rise (arch openings only) */}

                                            {
                                                pendingAsset.openingShape === "arch" && (

                                                    <div className="field">

                                                        <label htmlFor="arch-rise">
                                                            Arch Rise
                                                        </label>

                                                        <div className="field-input">

                                                            <input
                                                                id="arch-rise"
                                                                type="number"
                                                                min="0.05"
                                                                max={state.openingHeight}
                                                                step="0.05"
                                                                value={state.archRise}
                                                                onChange={(e) => {

                                                                    const value =
                                                                        Number(e.target.value);

                                                                    if (value <= 0) return;

                                                                    dispatch({
                                                                        type:
                                                                            "SET_ARCH_RISE",
                                                                        payload: value
                                                                    });

                                                                }}
                                                            />

                                                            <span className="field-unit">
                                                                m
                                                            </span>

                                                        </div>

                                                    </div>

                                                )
                                            }

                                        </div>

                                    </div>

                                </div>

                            </>

                        )
                    }


                    {/* -------------------------------- */}
                    {/* Apply */}
                    {/* -------------------------------- */}

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