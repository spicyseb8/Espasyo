import EditorProvider
    from "../context/EditorProvider";


// IMPORTANT:
// Replace this import with whatever component currently
// renders your actual 3D editor.
import Editor
    from "../Studio/Editor/Editor";


export default function StudioEditor() {

    return (

        <EditorProvider>

            <Editor />

        </EditorProvider>

    );
}