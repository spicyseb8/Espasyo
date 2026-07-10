import { createContext } from "react";

import type { EditorState } from "./editor/types";

import type { EditorAction } from "./editor/editorActions";

export interface EditorContextType {

    state: EditorState;

    dispatch: React.Dispatch<EditorAction>;

}

export const EditorContext =

    createContext<EditorContextType | null>(null);