import "./BuildPanel.css";

import AssetSection from "./AssetSection";

import { AssetLibrary } from "../../../assets/AssetLibrary";

export default function BuildPanel() {

    return (

        <div className="build-panel">

            <AssetSection

                title="Openings"

                assets={AssetLibrary.openings}

            />

            <AssetSection

                title="Doors"

                assets={AssetLibrary.doors}

            />

            <AssetSection

                title="Windows"

                assets={AssetLibrary.windows}

            />

        </div>

    );

}