
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
    loadManagedInteriorData,
    mergeManagedInteriorData
} from "../services/managedProjectData";

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
        deadline,
        setDeadline
    ] = useState<string | null>(null);

    const [
        deadlinePassed,
        setDeadlinePassed
    ] = useState(false);

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
        const controller = new AbortController();

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

                if (
                    projectMetadata.workflowType === "admin-managed" &&
                    (
                        projectMetadata.structuralStatus !== "published" ||
                        typeof projectMetadata.publishedStructuralRevision !== "number" ||
                        projectMetadata.publishedStructuralRevision < 1
                    )
                ) {
                    throw new Error(
                        "This project has not been published yet."
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
                        cache: "no-store",
                        signal: controller.signal
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to download project JSON (${response.status}).`
                    );
                }

                const projectData =
                    await response.json();

                if (projectMetadata.workflowType === "admin-managed") {
                    if (
                        projectData.projectId !== projectId ||
                        projectData.ownerId !== user.uid ||
                        projectData.workflowType !== "admin-managed" ||
                        projectData.structuralStatus !== "published" ||
                        projectData.publishedStructuralRevision !== projectMetadata.publishedStructuralRevision ||
                        projectData.structuralRevision !== projectMetadata.publishedStructuralRevision ||
                        !Array.isArray(projectData.walls) ||
                        !Array.isArray(projectData.corners) ||
                        !Array.isArray(projectData.doors) ||
                        !Array.isArray(projectData.windows) ||
                        !Array.isArray(projectData.openings)
                    ) {
                        throw new Error(
                            "The published structure does not match this project's owner, ID, or revision."
                        );
                    }
                }

                if (
                    projectMetadata.workflowType === "admin-managed" &&
                    projectData.workflowType === "admin-managed"
                ) {
                    const interiorData = await loadManagedInteriorData({
                        projectId,
                        ownerId: user.uid,
                        interiorJsonPath: typeof projectMetadata.interiorJsonPath === "string"
                            ? projectMetadata.interiorJsonPath
                            : undefined,
                        interiorJsonUrl: typeof projectMetadata.interiorJsonUrl === "string"
                            ? projectMetadata.interiorJsonUrl
                            : undefined
                    }, (input, init) => fetch(input, {
                        ...init,
                        signal: controller.signal
                    }));
                    Object.assign(projectData, mergeManagedInteriorData(
                        projectData,
                        interiorData
                    ));
                }

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
            controller.abort();

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
        loading
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
                        top: 70,
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
