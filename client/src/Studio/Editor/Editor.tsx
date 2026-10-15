
import {
    useCallback,
    useState
} from "react";

import "./Editor.css";

import Topbar
    from "../Topbar/Topbar";

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

import DraftLoader
    from "./DraftLoader";

import EditorExitGuard
    from "./EditorExitGuard";

//==================================================
// EDITOR
//==================================================

export default function Editor() {

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

    return (

        <>

            <div className="editor">

                <DraftLoader />

                <EditorExitGuard />

                <Topbar />

                <div className="editor-body">

                    <Workspace />

                    <main className="viewport">

                        <Scene
                            onSpawnConfirmed={
                                setWalkthroughSpawnConfirmed
                            }
                            walkthroughSpawnConfirmed={
                                walkthroughSpawnConfirmed
                            }
                            onSceneReady={
                                handleSceneReady
                            }
                        />

                        <InstructionModal />

                        <WalkthroughUI
                            spawnConfirmed={
                                walkthroughSpawnConfirmed
                            }
                        />

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
