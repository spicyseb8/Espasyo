
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

import {
    clearActiveProjectDeadline,
    isDeadlinePassed,
    isValidProjectDeadline,
    setActiveProjectDeadline,
    subscribeToProjectDeadline
} from "../services/projectDeadlineService";

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

    const navigate = useNavigate();

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

    const [
        deadline,
        setDeadline
    ] = useState<string | null>(null);

    const [
        deadlinePassed,
        setDeadlinePassed
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
    }, [
        projectId
    ]);

    //==================================================
    // UPDATE DEADLINE STATUS
    //==================================================

    useEffect(() => {
        const updateDeadlineStatus = () => {
            setDeadlinePassed(
                isDeadlinePassed(deadline)
            );
        };

        updateDeadlineStatus();

        const unsubscribe =
            subscribeToProjectDeadline(
                updateDeadlineStatus
            );

        // Recheck periodically so a project that remains
        // open overnight becomes read-only automatically.
        const timer = window.setInterval(
            updateDeadlineStatus,
            15_000
        );

        return () => {
            unsubscribe();
            window.clearInterval(timer);
        };
    }, [
        deadline
    ]);

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

                setDeadline(null);
                setDeadlinePassed(false);

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
                // LOAD THE ADMIN-SET DEADLINE
                //==================================================

                const projectDeadline =
                    isValidProjectDeadline(
                        projectMetadata.deadline
                    )
                        ? projectMetadata.deadline
                        : null;

                if (cancelled) {
                    return;
                }

                setDeadline(
                    projectDeadline
                );

                setActiveProjectDeadline(
                    projectId,
                    projectDeadline
                );

                setDeadlinePassed(
                    isDeadlinePassed(
                        projectDeadline
                    )
                );

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

                clearActiveProjectDeadline(
                    projectId
                );

                setDeadline(null);
                setDeadlinePassed(false);

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

            clearActiveProjectDeadline(
                projectId
            );
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

    return (
        <div className="relative h-screen w-screen">
            <Editor />

            {deadlinePassed && (
                <div
                    role="alert"
                    style={{
                        position: "fixed",
                        top: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 99999,
                        width: "max-content",
                        maxWidth: "calc(100vw - 32px)",
                        padding: "12px 18px",
                        border: "1px solid #f1c98c",
                        borderRadius: 10,
                        background: "#fff8e9",
                        color: "#7a4b00",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: "center"
                    }}
                >
                    Deadline passed — this project is now read-only.
                    You can still view your design.
                </div>
            )}
        </div>
    );
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
