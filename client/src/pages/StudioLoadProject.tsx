
import {
    useEffect,
    useState
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    doc,
    getDoc
} from "firebase/firestore";

import {
    auth,
    db
} from "../firebase/firebase";

import EditorProvider
    from "../context/EditorProvider";

import useEditor
    from "../context/editor/useEditor";

import Editor
    from "../Studio/Editor/Editor";

import LoadingScreen
    from "../scene/LoadingScreen";

import {
    preloadProjectAssets
} from "../engine/AssetPreloader";

import {
    clearProjectSession,
    saveProjectBaseline
} from "../services/projectEditSessionService";

// Avoid a brief flash, without imposing a 5.5-second delay.
const MIN_LOADING_MS = 300;

function LoadProjectContent() {

    const {
        projectId
    } = useParams<{
        projectId: string;
    }>();

    const {
        dispatch
    } = useEditor();

    const navigate =
        useNavigate();

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");

    const [
        minTimeElapsed,
        setMinTimeElapsed
    ] = useState(false);

    //==================================================
    // MINIMUM LOADING SCREEN TIME
    //==================================================

    useEffect(() => {

        setMinTimeElapsed(false);

        const timer = window.setTimeout(
            () => {
                setMinTimeElapsed(true);
            },
            MIN_LOADING_MS
        );

        return () => {
            window.clearTimeout(timer);
        };

    }, [projectId]);

    //==================================================
    // LOAD PROJECT
    //==================================================

    useEffect(() => {

        let cancelled = false;

        async function loadProject() {

            if (!projectId) {

                setError(
                    "No project was selected."
                );

                setLoading(false);

                return;
            }

            const user = auth.currentUser;

            if (!user) {

                setError(
                    "Please log in before opening a project."
                );

                setLoading(false);

                return;
            }

            try {

                setLoading(true);
                setError("");

                //==================================================
                // FETCH PROJECT METADATA
                //==================================================

                const projectReference = doc(
                    db,
                    "projects",
                    projectId
                );

                const projectSnapshot = await getDoc(
                    projectReference
                );

                if (!projectSnapshot.exists()) {

                    throw new Error(
                        "Project does not exist."
                    );
                }

                const projectMetadata =
                    projectSnapshot.data();

                if (
                    projectMetadata.ownerId !==
                    user.uid
                ) {

                    throw new Error(
                        "You do not have access to this project."
                    );
                }

                //==================================================
                // VALIDATE PROJECT JSON URL
                //==================================================

                const jsonUrl =
                    projectMetadata.jsonUrl;

                if (
                    typeof jsonUrl !== "string" ||
                    jsonUrl.trim() === ""
                ) {

                    throw new Error(
                        "This project does not have a valid JSON URL."
                    );
                }

                //==================================================
                // DOWNLOAD PROJECT JSON
                //==================================================

                const response = await fetch(
                    jsonUrl.trim(),
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );

                if (!response.ok) {

                    throw new Error(
                        `Failed to download project JSON (${response.status}).`
                    );
                }

                const projectData =
                    await response.json();

                if (cancelled) {
                    return;
                }

                //==================================================
                // PRELOAD ONLY THIS PROJECT'S ASSETS
                //==================================================

                await preloadProjectAssets(
                    projectData
                );

                if (cancelled) {
                    return;
                }

                //==================================================
                // RESTORE PROJECT STATE
                //==================================================

                clearProjectSession();

                dispatch({
                    type: "LOAD_PROJECT",
                    payload: projectData
                });

                saveProjectBaseline(
                    projectId,
                    projectData
                );

                //==================================================
                // SAVE PROJECT NAME
                //==================================================

                if (
                    typeof projectData.projectName ===
                        "string" &&
                    projectData.projectName.trim() !== ""
                ) {

                    localStorage.setItem(
                        "espasyo_project_name",
                        projectData.projectName
                    );
                }

                setLoading(false);

            } catch (loadError) {

                console.error(
                    "Failed to load project:",
                    loadError
                );

                if (cancelled) {
                    return;
                }

                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Failed to load project."
                );

                setLoading(false);
            }
        }

        void loadProject();

        return () => {
            cancelled = true;
        };

    }, [
        projectId,
        dispatch
    ]);

    //==================================================
    // LOADING SCREEN
    //==================================================

    if (
        !error &&
        (
            loading ||
            !minTimeElapsed
        )
    ) {

        return <LoadingScreen />;
    }

    //==================================================
    // ERROR SCREEN
    //==================================================

    if (error) {

        return (
            <div className="project-loading">
                <div>

                    <h2>
                        Unable to open project
                    </h2>

                    <p>
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/studio")
                        }
                    >
                        Back to Projects
                    </button>

                </div>
            </div>
        );
    }

    //==================================================
    // EDITOR
    //==================================================

    return <Editor />;
}

//==================================================
// PAGE
//==================================================

export default function StudioLoadProject() {

    return (
        <EditorProvider>
            <LoadProjectContent />
        </EditorProvider>
    );
}
