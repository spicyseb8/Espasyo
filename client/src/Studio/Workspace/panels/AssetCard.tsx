import "./AssetCard.css";

import {
    Check
} from "lucide-react";

import useEditor
    from "../../../context/editor/useEditor";

import type {
    Asset
} from "../../../assets/Asset";

import {
    BuildTool
} from "../../../context/BuildTool";

interface Props {
    asset: Asset;
}

export default function AssetCard({
    asset
}: Props) {

    const {
        state,
        dispatch
    } = useEditor();

    const selected =
        state.selectedAsset?.id ===
        asset.id;

    return (

        <button
            className={
                `asset-card ${
                    selected
                        ? "selected"
                        : ""
                }`
            }

            aria-pressed={
                selected
            }

            onClick={() => {

                //--------------------------------------------------
                // IMPORTANT:
                //
                // Clicking a card only selects an asset.
                //
                // It must NOT immediately start placement.
                //
                // If another asset was already being placed,
                // cancel that placement first.
                //--------------------------------------------------

                dispatch({
                    type:
                        "SET_BUILD_TOOL",

                    payload:
                        BuildTool.None
                });

                //--------------------------------------------------
                // Select / deselect pending asset
                //--------------------------------------------------

                dispatch({
                    type:
                        "SET_SELECTED_ASSET",

                    payload:
                        selected
                            ? null
                            : asset
                });

            }}
        >

            <div
                className="asset-thumb"
            >

                <img
                    src={
                        asset.thumbnail
                    }

                    alt={
                        asset.name
                    }
                />

                {
                    selected && (

                        <span
                            className=
                                "selected-badge"
                        >

                            <Check
                                size={12}
                                strokeWidth={3}
                            />

                        </span>
                    )
                }

            </div>

            <div>

                <span>
                    {
                        asset.name
                    }
                </span>

                <small>
                    ₱
                    {
                        asset.price.toLocaleString()
                    }
                </small>

            </div>

        </button>
    );
}