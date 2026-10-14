import {
    useEffect,
    useState
} from "react";

import EditorProvider
    from "../context/EditorProvider";

import Editor
    from "../Studio/Editor/Editor";

import LoadingScreen
    from "../scene/LoadingScreen";

const MIN_LOADING_MS = 5500;

function StudioEditorContent() {
    const [
        loading,
        setLoading
    ] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setLoading(false);
        }, MIN_LOADING_MS);

        return () => {
            window.clearTimeout(timer);
        };
    }, []);

    return (
        <div className="relative min-h-screen">
            <Editor />

            {loading && (
                <div
                    className="fixed inset-0 z-[9999] bg-white"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <LoadingScreen />
                </div>
            )}
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