import {
    useState
} from "react";

import "./WorkspaceContent.css";

import FloorPlanPanel from "./panels/FloorPlanPanel";
import BuildPanel from "./panels/BuildPanel";
import FurniturePanel from "./panels/FurniturePanel";
import DesignPanel from "./panels/DesignPanel";
import ProjectPanel from "./panels/ProjectPanel";

interface Props {

    activeTab: string;

}

export default function WorkspaceContent({

    activeTab

}: Props) {

    const isDesignTab =
        activeTab === "design";

    const [
        hasOpenedDesignTab,
        setHasOpenedDesignTab
    ] = useState<boolean>(
        isDesignTab
    );

    if (
        isDesignTab &&
        !hasOpenedDesignTab
    ) {

        setHasOpenedDesignTab(
            true
        );
    }


    //==================================================
    // OTHER PANELS
    //
    // Unchanged behavior: only the active one is
    // rendered, and it remounts on tab change.
    //==================================================

    const panels = {

        floorplan: <FloorPlanPanel />,

        build: <BuildPanel />,

        furniture: <FurniturePanel />,

        project: <ProjectPanel />

    };

    return (

        <>

            {!isDesignTab && (

                <div key={activeTab} className="workspace-content-inner">

                    {panels[activeTab as keyof typeof panels]}

                </div>

            )}

            {/*
                Inline style on purpose: a CSS class such as
                display:flex on .workspace-content-inner would
                override the HTML "hidden" attribute.
            */}

            {hasOpenedDesignTab && (

                <div

                    className="workspace-content-inner"

                    style={{
                        display:
                            isDesignTab
                                ? undefined
                                : "none"
                    }}

                >

                    <DesignPanel />

                </div>

            )}

        </>

    );

}