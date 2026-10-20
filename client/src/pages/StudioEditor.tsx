import EditorProvider
    from "../context/EditorProvider";

import Editor
    from "../Studio/Editor/Editor";

function StudioEditorContent() {
    return (
        <div className="relative min-h-screen">
            <Editor />
        </div>
    );
}

export default function StudioEditor() {
    return (
        <EditorProvider>
            <StudioEditorContent />
        </EditorProvider>
    );
}