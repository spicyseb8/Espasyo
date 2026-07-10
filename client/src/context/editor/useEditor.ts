import { useContext } from "react";

import { EditorContext } from "../EditorContext";

export default function useEditor() {

    const context = useContext(EditorContext);

    if (!context) {

        throw new Error(

            "useEditor must be used inside EditorProvider"

        );

    }

    return context;

}