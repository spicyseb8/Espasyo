import { useReducer } from "react";

import { EditorContext } from "./EditorContext";

import { editorReducer } from "./editor/editorReducer";

import { initialState } from "./editor/initialState";

export default function EditorProvider({

    children,

}: {

    children: React.ReactNode;

}) {

    const [state, dispatch] = useReducer(

        editorReducer,

        initialState

    );

    return (

        <EditorContext.Provider

            value={{

                state,

                dispatch,

            }}

        >

            {children}

        </EditorContext.Provider>

    );

}