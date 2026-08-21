import "./FurniturePanel.css";

import { AssetLibrary } from "../../../assets/AssetLibrary";

import useEditor from "../../../context/editor/useEditor";

import { BuildTool } from "../../../context/BuildTool";
import { furnitureInteraction } from "../../../scene/Furniture/FurnitureInteraction";

import AssetCard from "./AssetCard";

export default function FurniturePanel() {

    const { state, dispatch } = useEditor();

    //--------------------------------------------------
    // Only furniture assets
    //--------------------------------------------------

    const furniture =
        AssetLibrary.furniture;

    //--------------------------------------------------
    // Start furniture placement
    //--------------------------------------------------

    const handleApply = () => {

        if (!state.selectedAsset)
            return;

        //--------------------------------------------------
        // Only allow furniture here
        //--------------------------------------------------
        furnitureInteraction.resetRotation();
        if (
            state.selectedAsset.type !==
            BuildTool.Furniture
        ) {
            return;
        }

        //--------------------------------------------------
        // NOW activate placement mode
        //--------------------------------------------------

        dispatch({
            type: "SET_BUILD_TOOL",
            payload: BuildTool.Furniture
        });

    };

    //--------------------------------------------------
    // Check whether furniture is currently being placed
    //--------------------------------------------------

    const isPlacingFurniture =
        state.buildTool === BuildTool.Furniture;

    return (

        <div className="furniture-panel">

            <div className="furniture-panel-header">

                <h2>
                    Furniture
                </h2>

                <span>
                    {furniture.length}
                </span>

            </div>

            <div className="furniture-panel-grid">

                {furniture.map(
                    asset => (

                        <AssetCard
                            key={asset.id}
                            asset={asset}
                        />

                    )
                )}

            </div>

            <div className="furniture-panel-footer">

                <button
                    type="button"
                    className="furniture-apply-button"
                    disabled={
                        !state.selectedAsset ||
                        state.selectedAsset.type !==
                            BuildTool.Furniture ||
                        isPlacingFurniture
                    }
                    onClick={handleApply}
                >

                    {isPlacingFurniture
                        ? "Placing..."
                        : "✓ Apply"}

                </button>

            </div>

        </div>

    );
}