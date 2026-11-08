import "./WorkspaceContent.css";

import FurniturePanel from "./panels/FurniturePanel";
import DesignPanel from "./panels/DesignPanel";
import type { WorkspacePanel } from "./WorkspaceTabs";

interface Props {
    activePanel: WorkspacePanel;
    onClosePanel: () => void;
}

export default function WorkspaceContent({
    activePanel,
    onClosePanel,
}: Props) {
    return (
        <div className="workspace-panels">
            <div
                className="workspace-panel-view workspace-furniture-view"
                hidden={activePanel !== "furniture"}
                aria-hidden={activePanel !== "furniture"}
            >
                <FurniturePanel onClose={onClosePanel} />
            </div>
            <div
                className="workspace-panel-view workspace-design-view"
                hidden={activePanel !== "flooring" && activePanel !== "paint"}
                aria-hidden={activePanel !== "flooring" && activePanel !== "paint"}
            >
                <DesignPanel mode={activePanel === "paint" ? "paint" : "flooring"} />
            </div>
        </div>
    );
}