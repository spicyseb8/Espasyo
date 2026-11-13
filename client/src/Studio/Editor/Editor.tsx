
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
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
import useEditorGuide from "./InstructionModal/useEditorGuide";
import useEditor from "../../context/editor/useEditor";

type WorkspaceTabPanel = Exclude<WorkspacePanel, "project" | null>;

function isWorkspaceTabPanel(panel: WorkspacePanel): panel is WorkspaceTabPanel {
    return panel === "furniture" || panel === "flooring" || panel === "paint";
}

//==================================================
// EDITOR
//==================================================

interface Props {
    viewOnly?: boolean;
    viewOnlyTitle?: string;
    guideUserId?: string;
    autoOpenGuide?: boolean;
}

export default function Editor({
    viewOnly = false,
    viewOnlyTitle = "",
    guideUserId,
    autoOpenGuide = false,
}: Props) {

    const [activePanel, setActivePanel] =
        useState<WorkspacePanel | null>(null);
    const [lastPanel, setLastPanel] =
        useState<WorkspaceTabPanel>("furniture");
    const { state } = useEditor();

    const [
        walkthroughSpawnConfirmed,
        setWalkthroughSpawnConfirmed
    ] = useState(false);

    const [
        sceneReady,
        setSceneReady
    ] = useState(false);
    const activePanelRef = useRef(activePanel);
    const lastPanelRef = useRef(lastPanel);
    const sceneReadyRef = useRef(sceneReady);
    const walkthroughModeRef = useRef(state.walkthroughMode);

    const handlePanelChange = useCallback((nextPanel: WorkspacePanel) => {
        const currentPanel = activePanelRef.current;
        if (isWorkspaceTabPanel(nextPanel)) {
            lastPanelRef.current = nextPanel;
            setLastPanel(nextPanel);
        } else if (nextPanel === null && isWorkspaceTabPanel(currentPanel)) {
            lastPanelRef.current = currentPanel;
            setLastPanel(currentPanel);
        }

        activePanelRef.current = nextPanel;
        setActivePanel(nextPanel);
    }, []);

    useLayoutEffect(() => {
        activePanelRef.current = activePanel;
        lastPanelRef.current = lastPanel;
        sceneReadyRef.current = sceneReady;
        walkthroughModeRef.current = state.walkthroughMode;
    }, [activePanel, lastPanel, sceneReady, state.walkthroughMode]);

    const handleSceneReady =
        useCallback(() => {

            setSceneReady(true);

        }, []);

    const {
        autoOpen: shouldAutoOpenGuide,
        markSeen: markEditorGuideSeen,
    } = useEditorGuide(
        guideUserId,
        autoOpenGuide && sceneReady && !viewOnly,
    );

    useEffect(() => {
        if (viewOnly) return;

        const handleWorkspaceTabShortcut = (event: KeyboardEvent) => {
            if (
                event.key !== "Tab" ||
                event.repeat ||
                event.shiftKey ||
                event.ctrlKey ||
                event.altKey ||
                event.metaKey ||
                !sceneReadyRef.current ||
                walkthroughModeRef.current
            ) {
                return;
            }

            const target = event.target;
            if (
                target instanceof Element &&
                target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
            ) {
                return;
            }
            if (document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]')) {
                return;
            }

            event.preventDefault();
            const currentPanel = activePanelRef.current;
            if (currentPanel !== null) {
                if (isWorkspaceTabPanel(currentPanel)) {
                    lastPanelRef.current = currentPanel;
                    setLastPanel(currentPanel);
                }
                activePanelRef.current = null;
                setActivePanel(null);
                return;
            }

            const panelToOpen = lastPanelRef.current;
            activePanelRef.current = panelToOpen;
            setActivePanel(panelToOpen);
        };

        window.addEventListener("keydown", handleWorkspaceTabShortcut, true);
        return () => {
            window.removeEventListener("keydown", handleWorkspaceTabShortcut, true);
        };
    }, [viewOnly]);

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
                            handlePanelChange(
                                activePanel === "project"
                                    ? null
                                    : "project"
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
                            onPanelChange={handlePanelChange}
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

                        {!viewOnly && (
                            <InstructionModal
                                autoOpen={shouldAutoOpenGuide}
                                onAutoGuideSeen={markEditorGuideSeen}
                            />
                        )}

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
