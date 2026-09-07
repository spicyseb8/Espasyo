import {
    createContext
} from "react";

import type {
    EditorAction
} from "./editor/editorActions";

import type {
    EditorState
} from "./editor/types";

//==================================================
// EDITOR CONTEXT TYPE
//==================================================

export interface EditorContextValue {

    state:
        EditorState;

    dispatch:
        (action: EditorAction) => void;

    //--------------------------------------------------
    // Undo / Redo
    //--------------------------------------------------

    undo:
        () => void;

    redo:
        () => void;

    //--------------------------------------------------
    // Used by Topbar later to enable/disable buttons.
    //--------------------------------------------------

    canUndo:
        boolean;

    canRedo:
        boolean;
}

//==================================================
// CONTEXT
//==================================================

export const EditorContext =
    createContext<
        EditorContextValue | null
    >(null);