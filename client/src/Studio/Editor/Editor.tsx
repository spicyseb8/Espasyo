import "./Editor.css";

import Topbar from "../Topbar/Topbar";
import Workspace from "../Workspace/Workspace";
import Scene from "../../scene/Scene";

export default function Editor() {

    return (

        <div className="editor">

            <Topbar />

            <div className="editor-body">

                <Workspace />

                <main className="viewport">

                    <Scene />


                </main>

            </div>

        </div>

    );

}