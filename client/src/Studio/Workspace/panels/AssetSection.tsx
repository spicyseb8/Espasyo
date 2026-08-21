import "./AssetSection.css";

import { useState } from "react";
import type { ReactNode } from "react";

import {
    ChevronDown,
    Check
} from "lucide-react";

import AssetCard from "./AssetCard";

import useEditor from "../../../context/editor/useEditor";
import type { Asset } from "../../../assets/Asset";

import {
    BuildTool
} from "../../../context/BuildTool";

import {
    furnitureInteraction
} from "../../../scene/Furniture/FurnitureInteraction";


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

    const {
        state,
        dispatch
    } = useEditor();

    const [
        open,
        setOpen
    ] = useState(defaultOpen);

    const isOpen =
        forceOpen ?? open;

    //--------------------------------------------------
    // Selected asset
    //--------------------------------------------------

    const pendingAsset =
        state.selectedAsset ?? null;

    //--------------------------------------------------
    // Is selected asset inside this section?
    //--------------------------------------------------

    const pendingInThisSection =
        pendingAsset
            ? assets.some(
                asset =>
                    asset.id ===
                    pendingAsset.id
            )
            : false;

    //--------------------------------------------------
    // Is this section currently placing furniture?
    //--------------------------------------------------

    const isPlacingFurniture =
        state.buildTool ===
        BuildTool.Furniture;

    //--------------------------------------------------
    // Apply
    //--------------------------------------------------

    const handleApply = () => {

        if (
            !pendingAsset ||
            !pendingInThisSection
        ) {
            return;
        }

        //--------------------------------------------------
        // Furniture
        //--------------------------------------------------

        if (
            pendingAsset.type ===
            BuildTool.Furniture
        ) {

            //--------------------------------------------------
            // Start each new placement at 0°
            //--------------------------------------------------

            furnitureInteraction
                .resetRotation();

            //--------------------------------------------------
            // Activate furniture placement
            //--------------------------------------------------

            dispatch({
                type:
                    "SET_BUILD_TOOL",

                payload:
                    BuildTool.Furniture
            });

            return;
        }

        //--------------------------------------------------
        // Other build assets
        //
        // Keep existing behavior for them.
        //--------------------------------------------------

        dispatch({
            type:
                "SET_BUILD_TOOL",

            payload:
                pendingAsset.type
        });

        dispatch({
            type:
                "SET_SELECTED_ASSET",

            payload:
                null
        });

    };

    return (

        <section
            className="asset-section"
        >

            {/* -------------------------------------- */}
            {/* Header                                 */}
            {/* -------------------------------------- */}

            <button
                className="asset-section-header"
                onClick={() =>
                    setOpen(
                        o => !o
                    )
                }
                aria-expanded={isOpen}
            >

                <span
                    className="asset-section-title"
                >

                    {icon}

                    {title}

                    <span
                        className="asset-count"
                    >
                        {assets.length}
                    </span>

                </span>

                <ChevronDown
                    size={16}
                    className={
                        `asset-chevron ${
                            isOpen
                                ? "open"
                                : ""
                        }`
                    }
                />

            </button>

            {/* -------------------------------------- */}
            {/* Content                                */}
            {/* -------------------------------------- */}

            <div
                className={
                    `asset-collapse ${
                        isOpen
                            ? "open"
                            : ""
                    }`
                }
            >

                <div className="asset-collapse-inner">

    {
        assets.length > 0 ? (

            <div className="asset-grid-scroll">

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

            </div>

        ) : (
            <p className="asset-empty">
                No matches in this category.
            </p>
        )
    }

    <div className="asset-apply-row">

                        <button
                            type="button"
                            className="asset-apply-button"
                            disabled={
                                !pendingInThisSection ||
                                (
                                    pendingAsset
                                        ?.type ===
                                    BuildTool.Furniture &&
                                    isPlacingFurniture
                                )
                            }
                            onClick={
                                handleApply
                            }
                        >

                            <Check
                                size={16}
                            />

                            {
                                pendingAsset
                                    ?.type ===
                                    BuildTool.Furniture &&
                                isPlacingFurniture
                                    ? "Placing..."
                                    : "Apply"
                            }

                        </button>

                    </div>

                </div>

            </div>

        </section>
    );
}