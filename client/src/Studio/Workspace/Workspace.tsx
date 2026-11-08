import { useEffect, useRef } from "react";
import "./Workspace.css";
import WorkspaceTabs, { type WorkspacePanel } from "./WorkspaceTabs";
import WorkspaceContent from "./WorkspaceContent";
import useEditor from "../../context/editor/useEditor";

interface Props {
    activePanel: WorkspacePanel;
    onPanelChange: (panel: WorkspacePanel) => void;
}

export default function Workspace({
    activePanel,
    onPanelChange,
}: Props) {
    const { state } = useEditor();
    const lastMaterialPanel = useRef<WorkspacePanel | null>(null);

    if (activePanel === "flooring" || activePanel === "paint") {
        lastMaterialPanel.current = activePanel;
    }

    const closingMaterialPanel = activePanel === null
        ? lastMaterialPanel.current
        : null;
    const displayedPanel = activePanel ?? closingMaterialPanel;

    useEffect(() => {
        if (state.walkthroughMode) {
            onPanelChange(null);
        }
    }, [state.walkthroughMode, onPanelChange]);

    useEffect(() => {
        if (!activePanel) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onPanelChange(null);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [activePanel, onPanelChange]);

    const panelTitle = {
        furniture: "Furniture",
        flooring: "Flooring",
        paint: "Paint",
        project: "Project",
    } as const;
    const activePanelTitle = displayedPanel
        ? panelTitle[displayedPanel]
        : "";

    return (
        <aside className="workspace">
            <section
                className={`workspace-shell${displayedPanel === "flooring" || displayedPanel === "paint" ? " is-material-panel" : ""}${closingMaterialPanel ? " is-closed" : ""}`}
                hidden={(!activePanel && !closingMaterialPanel) || displayedPanel === "project"}
                aria-hidden={Boolean(closingMaterialPanel)}
                inert={Boolean(closingMaterialPanel)}
                aria-labelledby="workspace-panel-title"
            >
                <header className="workspace-panel-header">
                    <h2 id="workspace-panel-title">{activePanelTitle}</h2>
                    <button
                        type="button"
                        className="workspace-panel-close"
                        onClick={() => onPanelChange(null)}
                        aria-label={`Close ${activePanelTitle} panel`}
                        title="Close panel (Esc)"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </header>
                <div className="workspace-content">
                    <WorkspaceContent
                        activePanel={displayedPanel}
                        onClosePanel={() => onPanelChange(null)}
                    />
                </div>
            </section>

            <WorkspaceTabs
                activePanel={activePanel}
                walkthroughMode={state.walkthroughMode}
                onPanelChange={onPanelChange}
            />
        </aside>
    );
}