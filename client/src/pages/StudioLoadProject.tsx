
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
import type { SavedProjectData } from "../context/editor/ProjectTypes";

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
import {
    acknowledgeProjectAccess,
    getClientManagedProjectFile,
    getClientProjectWorkflow,
    type ClientProjectWorkflow
} from "../services/clientProjectWorkflow";

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
    const [workflow, setWorkflow] = useState<ClientProjectWorkflow | null>(null);
    const [acknowledgingAccess, setAcknowledgingAccess] = useState(false);
    const [acknowledgementError, setAcknowledgementError] = useState("");

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

                let currentWorkflow: ClientProjectWorkflow | null = null;
                if (projectMetadata.workflowType === "admin-managed") {
                    currentWorkflow = await getClientProjectWorkflow(projectId);
                    if (cancelled) return;
                    setWorkflow(currentWorkflow);
                } else {
                    setWorkflow(null);
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

                let projectData: Record<string, unknown>;
                if (projectMetadata.workflowType === "admin-managed") {
                    projectData = await getClientManagedProjectFile(
                        projectId,
                        "structure",
                        undefined,
                        { signal: controller.signal }
                    );
                } else {
                    const jsonUrl = projectMetadata.jsonUrl;
                    if (typeof jsonUrl !== "string" || jsonUrl.trim() === "") {
                        throw new Error("This project does not have a valid JSON URL.");
                    }
                    const response = await fetch(jsonUrl.trim(), {
                        method: "GET",
                        cache: "no-store",
                        signal: controller.signal
                    });
                    if (!response.ok) {
                        throw new Error(`Failed to download project JSON (${response.status}).`);
                    }
                    projectData = await response.json();
                }

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
                        workflowType: "admin-managed"
                    });
                    Object.assign(projectData, mergeManagedInteriorData(
                        projectData,
                        interiorData
                    ));
                } else if (
                    typeof projectMetadata.interiorJsonUrl === "string" ||
                    typeof projectMetadata.interiorJsonPath === "string"
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
                    projectData.maximumBudget = interiorData?.maximumBudget ?? null;
                }

                if (cancelled) {
                    return;
                }

                const savedProjectData = projectData as unknown as SavedProjectData;

                //==================================================
                // PRELOAD ONLY THIS PROJECT'S ASSETS
                //==================================================

                await preloadProjectAssets(
                    savedProjectData
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
                    payload: savedProjectData
                });

                saveProjectBaseline(
                    projectId,
                    savedProjectData
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

    async function handleAcknowledgeAccess() {
        if (!projectId || acknowledgingAccess) return;
        setAcknowledgingAccess(true);
        setAcknowledgementError("");
        try {
            await acknowledgeProjectAccess(projectId);
            setWorkflow(current => current
                ? { ...current, accessAcknowledged: true }
                : current);
        } catch (acknowledgementFailure) {
            setAcknowledgementError(acknowledgementFailure instanceof Error
                ? acknowledgementFailure.message
                : "Unable to record acknowledgement.");
        } finally {
            setAcknowledgingAccess(false);
        }
    }

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

    if (workflow?.projectStatus === "submitted" || workflow?.projectStatus === "approved") {
        const approved = workflow.projectStatus === "approved";
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] p-6 text-[#1b1b1b]">
                <section className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                        {approved ? "Approved reference" : "Submitted for review"}
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold">
                        {approved ? "This design has been approved" : "Your design is under review"}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-black/60">
                        {approved
                            ? "Approval accepts this proposal as a reference for professional development. It is not construction authorization or a finalized construction agreement."
                            : "Editing is paused while an administrator reviews your submitted design."}
                    </p>
                    {workflow.submittedAt && (
                        <p className="mt-4 text-sm text-black/60">
                            Submitted {new Date(workflow.submittedAt).toLocaleString()} · Version {workflow.submittedVersionNumber ?? "saved"}
                        </p>
                    )}
                    <button
                        type="button"
                        className="mt-6 rounded-lg bg-[#1b1b1b] px-4 py-2.5 text-sm font-medium text-white"
                        onClick={() => navigate("/studio")}
                    >
                        Back to projects
                    </button>
                </section>
            </div>
        );
    }

    if (workflow && !workflow.accessAcknowledged) {
        return (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
                <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 text-[#1b1b1b] shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">Project access acknowledgement</p>
                    <h1 className="mt-2 text-2xl font-semibold">{workflow.projectName}</h1>
                    <p className="mt-3 text-sm leading-6 text-black/65">
                        This project has been assigned to you. Its current deadline is <strong>{workflow.deadline || "not set"}</strong>.
                        Use the assigned floor plan to prepare an interior-design proposal within the project scope.
                        Your design is preliminary and is not a construction-ready plan. You are responsible for reviewing your design before submitting it.
                    </p>
                    {acknowledgementError && (
                        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{acknowledgementError}</p>
                    )}
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            className="rounded-lg border border-black/15 px-4 py-2.5 text-sm"
                            onClick={() => navigate("/studio")}
                            disabled={acknowledgingAccess}
                        >
                            Not now
                        </button>
                        <button
                            type="button"
                            className="rounded-lg bg-[#1b1b1b] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                            onClick={() => void handleAcknowledgeAccess()}
                            disabled={acknowledgingAccess}
                        >
                            {acknowledgingAccess ? "Recording..." : "Acknowledge and continue"}
                        </button>
                    </div>
                </section>
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
