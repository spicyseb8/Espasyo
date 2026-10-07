import {
    useEffect,
    useState
} from "react";
import {
    useParams,
    useSearchParams
} from "react-router-dom";
import useEditor
    from "../../../context/editor/useEditor";
import {
    auth,
    db,
    storage
} from "../../../firebase/firebase";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";
import {
    saveProjectBaseline
} from "../../../services/projectEditSessionService";
import {
    getDownloadURL,
    ref,
    uploadString
} from "firebase/storage";
import {
    createProjectData
} from "../../../services/projectSerializer";
import {
    captureSceneThumbnail
} from "../../../services/projectThumbnail";
import {
    deleteDraft,
    getDraft
} from "../../../services/projectDraftService";
import "./ProjectPanel.css";

export default function ProjectPanel() {
    const {
        state
    } = useEditor();

    const {
        projectId:
            routeProjectId
    } = useParams<{
        projectId?: string;
    }>();

    const [
        searchParams
    ] = useSearchParams();

    const draftId =
        searchParams.get("draft");

    const [
        projectName,
        setProjectName
    ] = useState("");

    const [
        projectId,
        setProjectId
    ] = useState<string | null>(
        null
    );

    const [
        saving,
        setSaving
    ] = useState(false);

    const [
        message,
        setMessage
    ] = useState("");

    const isExistingProject =
        Boolean(
            routeProjectId
        );

    const isDraftProject =
        Boolean(
            draftId
        );

    useEffect(() => {
    if (
        routeProjectId
    ) {
        const existingProjectId =
            routeProjectId;

        setProjectId(
            existingProjectId
        );

        async function loadExistingProject() {
            try {
                const projectRef =
                    doc(
                        db,
                        "projects",
                        existingProjectId
                    );

                const projectSnapshot =
                    await getDoc(
                        projectRef
                    );

                if (
                    !projectSnapshot.exists()
                ) {
                    return;
                }

                const data =
                    projectSnapshot.data();

                if (
                    typeof data.projectName === "string" &&
                    data.projectName.trim() !== ""
                ) {
                    setProjectName(
                        data.projectName
                    );

                    localStorage.setItem(
                        "espasyo_project_name",
                        data.projectName
                    );
                }
            } catch (
                error: unknown
            ) {
                console.error(
                    "Failed to load existing project:",
                    error
                );
            }
        }

        loadExistingProject();

        return;
    }

    if (
        !draftId
    ) {
        return;
    }

    const ownerId =
        auth.currentUser?.uid ??
        localStorage.getItem(
            "espasyo_current_user_uid"
        );

    if (
        !ownerId
    ) {
        return;
    }

    const draft =
        getDraft(
            ownerId,
            draftId
        );

    if (
        !draft
    ) {
        return;
    }

    setProjectId(
        draft.projectId
    );

    setProjectName(
        draft.projectName
    );

    localStorage.setItem(
        "espasyo_project_name",
        draft.projectName
    );
}, [
    routeProjectId,
    draftId
]);

    useEffect(() => {
        if (
            !projectName.trim()
        ) {
            localStorage.removeItem(
                "espasyo_project_name"
            );
            return;
        }

        localStorage.setItem(
            "espasyo_project_name",
            projectName
        );
    }, [
        projectName
    ]);

    async function handleSave() {
        const user =
            auth.currentUser;

        if (
            !user
        ) {
            setMessage(
                "Please log in before saving a project."
            );
            return;
        }

        const trimmedName =
            projectName.trim();

        if (
            trimmedName === ""
        ) {
            setMessage(
                "Please enter a project name."
            );
            return;
        }

        if (
            saving
        ) {
            return;
        }

        try {
            setSaving(
                true
            );

            setMessage(
                "Preparing project..."
            );

            const currentProjectId =
                routeProjectId ??
                projectId ??
                crypto.randomUUID();

            if (
                !routeProjectId &&
                !projectId
            ) {
                setProjectId(
                    currentProjectId
                );
            }

            const isNewProject =
                !routeProjectId;

            const projectData =
                createProjectData(
                    state,
                    currentProjectId,
                    trimmedName,
                    user.uid
                );

            const estimatedCost =
                projectData.costEstimate.total;

            const json =
                JSON.stringify(
                    projectData,
                    null,
                    2
                );

            const storagePath =
                `projects/${user.uid}/${currentProjectId}.json`;

            const storageRef =
                ref(
                    storage,
                    storagePath
                );

            setMessage(
                "Saving project..."
            );

            await uploadString(
                storageRef,
                json,
                "raw",
                {
                    contentType:
                        "application/json"
                }
            );

            const downloadUrl =
                await getDownloadURL(
                    storageRef
                );

            const thumbnailDataUrl =
                captureSceneThumbnail();

            let thumbnailPath:
                string | undefined;

            let thumbnailUrl:
                string | undefined;

            if (
                thumbnailDataUrl
            ) {
                thumbnailPath =
                    `projects/${user.uid}/${currentProjectId}.jpg`;

                const thumbnailRef =
                    ref(
                        storage,
                        thumbnailPath
                    );

                setMessage(
                    "Saving project thumbnail..."
                );

                await uploadString(
                    thumbnailRef,
                    thumbnailDataUrl,
                    "data_url",
                    {
                        contentType:
                            "image/jpeg"
                    }
                );

                thumbnailUrl =
                    await getDownloadURL(
                        thumbnailRef
                    );
            }

            const projectMetadata:
                Record<string, unknown> = {
                projectId:
                    currentProjectId,
                projectName:
                    trimmedName,
                ownerId:
                    user.uid,
                jsonPath:
                    storagePath,
                jsonUrl:
                    downloadUrl,
                schemaVersion:
                    1,
                estimatedCost:
                    estimatedCost,
                updatedAt:
                    serverTimestamp()
            };

            if (
                thumbnailPath
            ) {
                projectMetadata.thumbnailPath =
                    thumbnailPath;
            }

            if (
                thumbnailUrl
            ) {
                projectMetadata.thumbnailUrl =
                    thumbnailUrl;
            }

            if (
                isNewProject
            ) {
                projectMetadata.createdAt =
                    serverTimestamp();
            }

            await setDoc(
                doc(
                    db,
                    "projects",
                    currentProjectId
                ),
                projectMetadata,
                {
                    merge:
                        true
                }
            );
            saveProjectBaseline(
    currentProjectId,
    projectData
);

localStorage.setItem(
    "espasyo_project_name",
    trimmedName
);
            if (
                draftId
            ) {
                deleteDraft(
                    user.uid,
                    draftId
                );
            }

            localStorage.setItem(
                "espasyo_project_name",
                trimmedName
            );

            setMessage(
                isExistingProject
                    ? "Project updated successfully."
                    : isDraftProject
                        ? "Draft saved successfully."
                        : "Project saved successfully."
            );
        } catch (
            error: unknown
        ) {
            console.error(
                "Failed to save project:",
                error
            );

            const firebaseError =
                error as {
                    code?: string;
                    message?: string;
                };

            setMessage(
                `Save failed: ${
                    firebaseError.code ??
                    "unknown"
                } - ${
                    firebaseError.message ??
                    "Unknown error"
                }`
            );
        } finally {
            setSaving(
                false
            );
        }
    }

    return (
        <aside className="design-sidebar">
            <div className="panel-card">
                <h3 className="section-title">
                    {
                        isExistingProject
                            ? "Edit Project"
                            : isDraftProject
                                ? "Continue Draft"
                                : "Save Project"
                    }
                </h3>

                <div className="setting-group">
                    <label
                        className="setting-label"
                        htmlFor="project-name"
                    >
                        Project Name
                    </label>

                    <input
                        id="project-name"
                        className="setting-input project-name-input"
                        type="text"
                        placeholder="Enter project name"
                        value={
                            projectName
                        }
                        onChange={
                            event =>
                                setProjectName(
                                    event.target.value
                                )
                        }
                        disabled={
                            saving
                        }
                    />
                </div>

                {
                    (
                        routeProjectId ??
                        projectId
                    ) && (
                        <div
                            className="project-id-display"
                        >
                            <span>
                                Project ID
                            </span>

                            <span>
                                {
                                    routeProjectId ??
                                    projectId
                                }
                            </span>
                        </div>
                    )
                }

                <button
                    type="button"
                    className="confirm-layout-button"
                    onClick={
                        handleSave
                    }
                    disabled={
                        saving
                    }
                >
                    {
                        saving
                            ? "Saving..."
                            : isExistingProject
                                ? "Save Changes"
                                : "Save Project"
                    }
                </button>

                {
                    message && (
                        <div
                            className="save-message"
                            role="status"
                        >
                            {
                                message
                            }
                        </div>
                    )
                }
            </div>
        </aside>
    );
}