import {
    useState
} from "react";
import "./Editor.css";
import Topbar
    from "../Topbar/Topbar";
import Workspace
    from "../Workspace/Workspace";
import Scene
    from "../../scene/Scene";
import InstructionModal
    from "./InstructionModal/InstructionModal";
import WalkthroughUI
    from "../../scene/Walkthrough/WalkthroughUI";
import DraftLoader
    from "./DraftLoader";
import EditorExitGuard
    from "./EditorExitGuard";

export default function Editor() {
    const [
        walkthroughSpawnConfirmed,
        setWalkthroughSpawnConfirmed
    ] = useState(false);

    return (
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
    );
}