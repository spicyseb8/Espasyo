import "./Editor.css";

import Topbar from "../Topbar/Topbar";
import Workspace from "../Workspace/Workspace";
import Scene from "../../scene/Scene";
import InstructionModal from "./InstructionModal/InstructionModal";

export default function Editor() {
    return (
        <div className="editor">

            <Topbar />

            <div className="editor-body">

                <Workspace />

                <main className="viewport">

                    <Scene />

                    <InstructionModal />

                </main>

            </div>

        </div>
    );
}