import AssetSection from "./AssetSection";
import { AssetLibrary } from "../../../assets/AssetLibrary";
import useEditor from "../../../context/editor/useEditor";

export default function FurniturePanel() {

    const { state } = useEditor();

    console.log("Selected furniture asset:", state.selectedAsset);
    console.log("Current build tool:", state.buildTool);

    return (
        <div>
            <AssetSection
                title="Furniture"
                assets={AssetLibrary.furniture}
                defaultOpen={true}
            />
        </div>
    );
}