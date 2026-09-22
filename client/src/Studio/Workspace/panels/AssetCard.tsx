import "./AssetCard.css";

import {
    useState
} from "react";

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

import AssetModelThumbnail
    from "../AssetModelThumbnail";


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

    const [
        thumbnailError,
        setThumbnailError
    ] = useState(false);


    const selected =
        state.selectedAsset?.id ===
        asset.id;


    const hasThumbnail =
        Boolean(asset.thumbnail?.trim()) &&
        !thumbnailError;


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
                // Clicking only selects the asset.
                // It does not immediately start placement.
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

                {hasThumbnail ? (

                    <img
                        src={
                            asset.thumbnail
                        }

                        alt={
                            asset.name
                        }

                        onError={() => {
                            setThumbnailError(true);
                        }}
                    />

                ) : asset.model ? (

                    <AssetModelThumbnail
                        model={
                            asset.model
                        }
                    />

                ) : (

                    <div className="asset-thumb-empty">
                        No preview
                    </div>

                )}


                {
                    selected && (

                        <span
                            className="selected-badge"
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