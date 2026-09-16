import { useEffect, useState } from "react";
import "./Workspace.css";
import WorkspaceTabs from "./WorkspaceTabs";
import WorkspaceContent from "./WorkspaceContent";
import useEditor from "../../context/editor/useEditor";

export default function Workspace() {
    const { state, dispatch } = useEditor();
    const [panelOpen, setPanelOpen] = useState(true);

    // Automatically close the panel when entering Walkthrough mode.
    useEffect(() => {
        if (state.walkthroughMode) {
            setPanelOpen(false);
        }
    }, [state.walkthroughMode]);

    function handleTabChange(tab: typeof state.activeTab) {
        // Clicking the currently active tab toggles the panel.
        if (tab === state.activeTab) {
            setPanelOpen((current) => !current);
            return;
        }

        // Switching tabs changes the active tab and opens the panel.
        dispatch({
            type: "SET_ACTIVE_TAB",
            payload: tab,
        });

        setPanelOpen(true);
    }

    return (
        <aside className="workspace">
            <WorkspaceTabs
                activeTab={state.activeTab}
                layoutConfirmed={state.layoutConfirmed}
                walkthroughMode={state.walkthroughMode}
                panelOpen={panelOpen}
                onTabChange={handleTabChange}
            />

            <div
                className={`workspace-floating-panel ${
                    panelOpen
                        ? "workspace-panel-open"
                        : "workspace-panel-closed"
                }`}
            >
                

                <div className="workspace-content">
                    <WorkspaceContent activeTab={state.activeTab} />
                </div>
            </div>
        </aside>
    );
}