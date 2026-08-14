import "./Workspace.css";

import WorkspaceTabs from "./WorkspaceTabs";
import WorkspaceContent from "./WorkspaceContent";


import useEditor from "../../context/editor/useEditor";

export default function Workspace() {

    const { state, dispatch } = useEditor();

    return (

        <aside className="workspace">

            <WorkspaceTabs
                activeTab={state.activeTab}
                layoutConfirmed={state.layoutConfirmed}
                onTabChange={(tab) => {

                    // Prevent returning to Floor Plan
                    if (
                        state.layoutConfirmed &&
                        tab === "floorplan"
                    ) {
                        return;
                    }

                    dispatch({
                        type: "SET_ACTIVE_TAB",
                        payload: tab,
                    });
                }}
            />

            <div className="workspace-divider" />

            <div className="workspace-content">

                <WorkspaceContent
                    activeTab={state.activeTab}
                />

            </div>

        </aside>

    );

}