
import {
    useCallback,
    useEffect,
    useState
} from "react";
import { Link } from "react-router-dom";

import "./Editor.css";

import Topbar
    from "../Topbar/Topbar";

import FloorSwitcher
    from "../FloorSwitcher/FloorSwitcher";

import Workspace
    from "../Workspace/Workspace";

import Scene
    from "../../scene/Scene";

import LoadingScreen
    from "../../scene/LoadingScreen";

import InstructionModal
    from "./InstructionModal/InstructionModal";

import WalkthroughUI
    from "../../scene/Walkthrough/WalkthroughUI";
import BudgetWarning
    from "../../scene/BudgetWarning";

import DraftLoader
    from "./DraftLoader";

import EditorExitGuard
    from "./EditorExitGuard";
import type { WorkspacePanel } from "../Workspace/WorkspaceTabs";

//==================================================
// EDITOR
//==================================================

interface Props {
    viewOnly?: boolean;
    viewOnlyTitle?: string;
}

export default function Editor({
    viewOnly = false,
    viewOnlyTitle = ""
}: Props) {

    const [activePanel, setActivePanel] =
        useState<WorkspacePanel | null>("furniture");

    const [
        walkthroughSpawnConfirmed,
        setWalkthroughSpawnConfirmed
    ] = useState(false);

    const [
        sceneReady,
        setSceneReady
    ] = useState(false);

    const handleSceneReady =
        useCallback(() => {

            setSceneReady(true);

        }, []);

    useEffect(() => {
        if (!viewOnly) return;
        const handleEditingShortcut = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            const blockedKey = ["delete", "backspace", "r"].includes(key);
            const blockedCommand = (event.ctrlKey || event.metaKey) &&
                ["a", "c", "d", "p", "s", "v", "x", "y", "z"].includes(key);
            if (!blockedKey && !blockedCommand) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        window.addEventListener("keydown", handleEditingShortcut, true);
        return () => window.removeEventListener("keydown", handleEditingShortcut, true);
    }, [viewOnly]);

    return (

        <>

            <div className={`editor${viewOnly ? " is-view-only" : ""}`}>

                {!viewOnly && <DraftLoader />}

                {!viewOnly && <EditorExitGuard />}

                {viewOnly ? (
                    <header className="view-only-header">
                        <Link className="view-only-back" to="/studio">Studio</Link>
                        <div className="view-only-heading">
                            <span className="view-only-badge">View only</span>
                            <span className="view-only-title">{viewOnlyTitle}</span>
                        </div>
                    </header>
                ) : (
                    <Topbar
                        projectPanelOpen={activePanel === "project"}
                        onProjectClick={() =>
                            setActivePanel(current =>
                                current === "project" ? null : "project"
                            )
                        }
                    />
                )}

                <div className="editor-body">

                    <FloorSwitcher materialPanelOpen={!viewOnly && (
                        activePanel === "flooring" ||
                        activePanel === "paint"
                    )} />

                    {!viewOnly && (
                        <Workspace
                            activePanel={activePanel}
                            onPanelChange={setActivePanel}
                        />
                    )}

                    <main className="viewport">

                        <Scene
                            onSpawnConfirmed={
                                setWalkthroughSpawnConfirmed
                            }
                            walkthroughSpawnConfirmed={
                                walkthroughSpawnConfirmed
                            }
                            viewOnly={viewOnly}
                            onSceneReady={
                                handleSceneReady
                            }
                        />

                        {!viewOnly && <BudgetWarning />}

                        {!viewOnly && <InstructionModal />}

                        {!viewOnly && (
                            <WalkthroughUI
                                spawnConfirmed={walkthroughSpawnConfirmed}
                            />
                        )}

                    </main>

                </div>

            </div>

            {/* Keep the loading screen above the editor
                until the first scene frames are rendered. */}

            {
                !sceneReady && (

                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 99999,
                            width: "100vw",
                            height: "100vh",
                            background: "#ffffff"
                        }}
                    >

                        <LoadingScreen />

                    </div>

                )
            }

        </>
    );
}
