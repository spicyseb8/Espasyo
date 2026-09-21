import { useState } from "react";

import "./Editor.css";

import Topbar from "../Topbar/Topbar";
import Workspace from "../Workspace/Workspace";
import Scene from "../../scene/Scene";

import InstructionModal from "./InstructionModal/InstructionModal";

import WalkthroughUI from "../../scene/Walkthrough/WalkthroughUI";

export default function Editor() {
    //==================================================
    // WALKTHROUGH SPAWN STATE
    //==================================================
    //
    // false = user is still choosing where to spawn
    // true  = spawn location has been confirmed
    //
    // This is also used by the walkthrough roof.
    //
    //==================================================

    const [
        walkthroughSpawnConfirmed,
        setWalkthroughSpawnConfirmed
    ] = useState(false);

    return (
        <div className="editor">

            {/*==================================================
                TOPBAR
            ==================================================*/}
            <Topbar />

            {/*==================================================
                EDITOR BODY
            ==================================================*/}
            <div className="editor-body">

                {/*==================================================
                    WORKSPACE
                ==================================================*/}
                <Workspace />

                {/*==================================================
                    VIEWPORT
                ==================================================*/}
                <main className="viewport">

                    {/*==================================================
                        3D SCENE
                    ==================================================*/}
                    <Scene
                        onSpawnConfirmed={
                            setWalkthroughSpawnConfirmed
                        }
                        walkthroughSpawnConfirmed={
                            walkthroughSpawnConfirmed
                        }
                    />

                    {/*==================================================
                        INSTRUCTION MODAL
                    ==================================================*/}
                    <InstructionModal />

                    {/*==================================================
                        WALKTHROUGH UI
                    ==================================================*/}
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