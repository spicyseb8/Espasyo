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

    const panels = {

        floorplan: <FloorPlanPanel />,

        build: <BuildPanel />,

        furniture: <FurniturePanel />,

        design: <DesignPanel />,
        project: <ProjectPanel />

    };

    return (

        <div key={activeTab} className="workspace-content-inner">

            {panels[activeTab as keyof typeof panels]}

        </div>

    );

}