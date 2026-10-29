
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
    runTransaction,
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
    createManagedInteriorData,
    createProjectData
} from "../../../services/projectSerializer";

import {
    getClientDesignLifecycleUpdate,
    hasMeaningfulManagedInteriorChanges,
    saveManagedInteriorData
} from "../../../services/managedProjectData";

import {
    captureSceneThumbnail
} from "../../../services/projectThumbnail";

import {
    deleteDraft,
    getDraft
} from "../../../services/projectDraftService";

import {
    isDeadlinePassed,
    isProjectReadOnlyByDeadline,
    isValidProjectDeadline,
    setActiveProjectDeadline,
    subscribeToProjectDeadline
} from "../../../services/projectDeadlineService";

import "./ProjectPanel.css";

//======================================================
// PROJECT ID FORMAT
//
// PRJ-00126
//     001 = sequence number
//      26 = year 2026
//
// The counter is stored in Firestore at:
// idCounters/projects-2026
//
// The transaction prevents two simultaneous requests
// from allocating the same sequence number.
//======================================================

function getPhilippineYear(): number {
    const year = new Intl.DateTimeFormat(
        "en-US",
        {
            timeZone: "Asia/Manila",
            year: "numeric"
        }
    ).format(new Date());

    return Number(year);
}

function formatProjectId(
    sequence: number,
    year: number
): string {
    const sequenceCode = String(
        sequence
    ).padStart(3, "0");

    const yearCode = String(
        year % 100
    ).padStart(2, "0");

    return `PRJ-${sequenceCode}${yearCode}`;
}

//======================================================
// GENERATE THE NEXT PROJECT ID
//======================================================

async function generateNextProjectId(): Promise<string> {
    const year = getPhilippineYear();

    const counterRef = doc(
        db,
        "idCounters",
        `projects-${year}`
    );

    return runTransaction(
        db,
        async transaction => {
            const counterSnapshot =
                await transaction.get(counterRef);

            const storedSequence =
                counterSnapshot.exists()
                    ? Number(
                        counterSnapshot.data().lastSequence ?? 0
                    )
                    : 0;

            if (
                !Number.isSafeInteger(storedSequence) ||
                storedSequence < 0
            ) {
                throw new Error(
                    "The project ID counter is invalid."
                );
            }

            let nextSequence =
                storedSequence + 1;

            let nextProjectId =
                formatProjectId(
                    nextSequence,
                    year
                );

            // Check the destination document in case a project
            // already exists beyond the saved counter.
            let destinationRef = doc(
                db,
                "projects",
                nextProjectId
            );

            let destinationSnapshot =
                await transaction.get(destinationRef);

            // Skip existing IDs instead of overwriting projects.
            while (destinationSnapshot.exists()) {
                nextSequence += 1;

                if (!Number.isSafeInteger(nextSequence)) {
                    throw new Error(
                        "Unable to generate another project ID."
                    );
                }

                nextProjectId = formatProjectId(
                    nextSequence,
                    year
                );

                destinationRef = doc(
                    db,
                    "projects",
                    nextProjectId
                );

                destinationSnapshot =
                    await transaction.get(destinationRef);
            }

            // Reserve the sequence atomically.
            transaction.set(
                counterRef,
                {
                    lastSequence: nextSequence,
                    year,
                    updatedAt: serverTimestamp()
                },
                {
                    merge: true
                }
            );

            return nextProjectId;
        }
    );
}

//======================================================
// CHECK WHETHER AN ID USES THE NEW PROJECT FORMAT
//======================================================

function usesProjectIdFormat(
    value: string
): boolean {
    return /^PRJ-\d{3,}\d{2}$/.test(
        value
    );
}

//======================================================
// PROJECT PANEL
//======================================================

export default function ProjectPanel() {
    const {
        state
    } = useEditor();

    const {
        projectId: routeProjectId
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
    ] = useState<string | null>(null);

    const [
        saving,
        setSaving
    ] = useState(false);

    const [
        message,
        setMessage
    ] = useState("");

    const [
        deadlineLocked,
        setDeadlineLocked
    ] = useState(
        isProjectReadOnlyByDeadline()
    );

    const isExistingProject =
        Boolean(routeProjectId);

    const isDraftProject =
        Boolean(draftId);

    //==================================================
    // WATCH DEADLINE LOCK STATUS
    //==================================================

    useEffect(() => {
        const updateLockStatus = () => {
            setDeadlineLocked(
                isProjectReadOnlyByDeadline()
            );
        };

        updateLockStatus();

        const unsubscribe =
            subscribeToProjectDeadline(
                updateLockStatus
            );

        // Update the UI if the deadline passes while
        // the editor remains open.
        const timer = window.setInterval(
            updateLockStatus,
            15_000
        );

        return () => {
            unsubscribe();
            window.clearInterval(timer);
        };
    }, []);

    //==================================================
    // LOAD EXISTING PROJECT OR DRAFT
    //==================================================

    useEffect(() => {
        let cancelled = false;

        async function initializeProject() {
            if (routeProjectId) {
                const existingProjectId =
                    routeProjectId;

                setProjectId(
                    existingProjectId
                );

                try {
                    const projectRef = doc(
                        db,
                        "projects",
                        existingProjectId
                    );

                    const projectSnapshot =
                        await getDoc(projectRef);

                    if (
                        cancelled ||
                        !projectSnapshot.exists()
                    ) {
                        return;
                    }

                    const data =
                        projectSnapshot.data();

                    // Keep the deadline synchronized with
                    // the Firestore metadata for this project.
                    const currentDeadline =
                        isValidProjectDeadline(
                            data.deadline
                        )
                            ? data.deadline
                            : null;

                    setActiveProjectDeadline(
                        existingProjectId,
                        currentDeadline
                    );

                    setDeadlineLocked(
                        isDeadlinePassed(
                            currentDeadline
                        )
                    );

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
                } catch (error: unknown) {
                    console.error(
                        "Failed to load existing project:",
                        error
                    );
                }

                return;
            }

            if (!draftId) {
                return;
            }

            const ownerId =
                auth.currentUser?.uid ??
                localStorage.getItem(
                    "espasyo_current_user_uid"
                );

            if (!ownerId) {
                return;
            }

            const draft = getDraft(
                ownerId,
                draftId
            );

            if (!draft || cancelled) {
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
        }

        void initializeProject();

        return () => {
            cancelled = true;
        };
    }, [
        routeProjectId,
        draftId
    ]);

    //==================================================
    // SAVE PROJECT NAME LOCALLY
    //==================================================

    useEffect(() => {
        if (!projectName.trim()) {
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

    //==================================================
    // SAVE PROJECT
    //==================================================

    async function handleSave() {
        const user =
            auth.currentUser;

        if (!user) {
            setMessage(
                "Please log in before saving a project."
            );

            return;
        }

        const trimmedName =
            projectName.trim();

        if (!trimmedName) {
            setMessage(
                "Please enter a project name."
            );

            return;
        }

        if (saving) {
            return;
        }

        try {
            setSaving(true);

            setMessage(
                "Preparing project..."
            );

            //==================================================
            // CHECK THE CURRENT FIRESTORE DEADLINE
            //==================================================

            if (routeProjectId) {
                const projectRef = doc(
                    db,
                    "projects",
                    routeProjectId
                );

                const projectSnapshot =
                    await getDoc(projectRef);

                if (!projectSnapshot.exists()) {
                    throw new Error(
                        "This project no longer exists."
                    );
                }

                const metadata =
                    projectSnapshot.data();

                if (
                    metadata.ownerId !== user.uid
                ) {
                    throw new Error(
                        "You do not have permission to edit this project."
                    );
                }

                if (
                    metadata.workflowType === "admin-managed" &&
                    (
                        metadata.structuralStatus !== "published" ||
                        typeof metadata.publishedStructuralRevision !== "number" ||
                        metadata.publishedStructuralRevision < 1
                    )
                ) {
                    throw new Error(
                        "This structural project has not been published and cannot be saved as an interior design."
                    );
                }

                if (
                    state.workflowType === "admin-managed" &&
                    metadata.workflowType !== "admin-managed"
                ) {
                    throw new Error(
                        "Project workflow metadata changed. Reopen the project before saving."
                    );
                }

                const currentDeadline =
                    isValidProjectDeadline(
                        metadata.deadline
                    )
                        ? metadata.deadline
                        : null;

                setActiveProjectDeadline(
                    routeProjectId,
                    currentDeadline
                );

                setDeadlineLocked(
                    isDeadlinePassed(
                        currentDeadline
                    )
                );

                if (
                    isDeadlinePassed(
                        currentDeadline
                    )
                ) {
                    setMessage(
                        "Deadline passed. This project is read-only, and your changes cannot be saved."
                    );

                    return;
                }
            }

            // Check the currently active project's lock as well.
            if (isProjectReadOnlyByDeadline()) {
                setDeadlineLocked(true);

                setMessage(
                    "Deadline passed. This project is read-only, and your changes cannot be saved."
                );

                return;
            }

            // Existing projects keep their original ID.
            // New projects receive the formatted ID.
            //
            // A generated ID is reused after an unsuccessful
            // save attempt to avoid unnecessary sequence gaps.
            let currentProjectId: string;

            if (routeProjectId) {
                currentProjectId =
                    routeProjectId;
            } else if (
                projectId &&
                usesProjectIdFormat(projectId)
            ) {
                currentProjectId =
                    projectId;
            } else {
                currentProjectId =
                    await generateNextProjectId();

                setProjectId(
                    currentProjectId
                );
            }

            const isNewProject =
                !routeProjectId;

            //==================================================
            // PREPARE PROJECT JSON
            //==================================================

            const isManaged = state.workflowType === "admin-managed";
            const projectData = {
                ...createProjectData(
                    state,
                    currentProjectId,
                    trimmedName,
                    user.uid
                ),
                wallFinishes: state.wallFinishes
            };

            const estimatedCost =
                projectData.costEstimate.total;

            const thumbnailDataUrl =
                captureSceneThumbnail();

            const uploadThumbnail = thumbnailDataUrl
                ? async () => {
                    const path = `projects/${user.uid}/${currentProjectId}.jpg`;
                    const thumbnailRef = ref(storage, path);
                    setMessage("Saving project thumbnail...");
                    await uploadString(thumbnailRef, thumbnailDataUrl, "data_url", {
                        contentType: "image/jpeg"
                    });
                    return {
                        thumbnailPath: path,
                        thumbnailUrl: await getDownloadURL(thumbnailRef)
                    };
                }
                : undefined;

            if (isManaged) {
                setMessage("Saving project...");
                const interiorData = createManagedInteriorData(
                    state,
                    currentProjectId,
                    user.uid
                );
                await saveManagedInteriorData({
                    projectId: currentProjectId,
                    ownerId: user.uid,
                    projectName: trimmedName,
                    estimatedCost,
                    interiorData,
                    hasMeaningfulChanges: hasMeaningfulManagedInteriorChanges(interiorData),
                    updatedAt: serverTimestamp(),
                    createdAt: isNewProject ? serverTimestamp() : undefined,
                    uploadJson: async (path, json) => {
                        const storageRef = ref(storage, path);
                        await uploadString(storageRef, json, "raw", {
                            contentType: "application/json"
                        });
                        return getDownloadURL(storageRef);
                    },
                    uploadThumbnail,
                    updateMetadata: async metadata => {
                        const projectRef = doc(db, "projects", currentProjectId);
                        await runTransaction(db, async transaction => {
                            const snapshot = await transaction.get(projectRef);
                            if (!snapshot.exists()) {
                                throw new Error("The designated client project no longer exists.");
                            }
                            const currentMetadata = snapshot.data();
                            if (
                                currentMetadata.projectId !== currentProjectId ||
                                currentMetadata.ownerId !== user.uid ||
                                currentMetadata.workflowType !== "admin-managed" ||
                                currentMetadata.structuralStatus !== "published" ||
                                typeof currentMetadata.publishedStructuralRevision !== "number"
                            ) {
                                throw new Error(
                                    "Project ownership or published structure changed. Interior changes were not marked as saved."
                                );
                            }
                            const lifecycle = getClientDesignLifecycleUpdate(
                                currentMetadata,
                                metadata.clientDesignStarted === true,
                                serverTimestamp()
                            );
                            transaction.set(projectRef, {
                                ...metadata,
                                ...lifecycle
                            }, { merge: true });
                        });
                    }
                });
            } else {
                const json = JSON.stringify(projectData, null, 2);
                const storagePath = `projects/${user.uid}/${currentProjectId}.json`;
                const storageRef = ref(storage, storagePath);
                setMessage("Saving project...");
                await uploadString(storageRef, json, "raw", {
                    contentType: "application/json"
                });
                const downloadUrl = await getDownloadURL(storageRef);

                const thumbnail = await uploadThumbnail?.();

                const projectMetadata: Record<string, unknown> = {
                    projectId: currentProjectId,
                    projectName: trimmedName,
                    ownerId: user.uid,
                    schemaVersion: 1,
                    estimatedCost,
                    updatedAt: serverTimestamp(),
                    jsonPath: storagePath,
                    jsonUrl: downloadUrl
                };
                if (thumbnail) {
                    projectMetadata.thumbnailPath = thumbnail.thumbnailPath;
                    projectMetadata.thumbnailUrl = thumbnail.thumbnailUrl;
                }
                if (isNewProject) projectMetadata.createdAt = serverTimestamp();

                await setDoc(
                    doc(db, "projects", currentProjectId),
                    projectMetadata,
                    { merge: true }
                );
            }

            //==================================================
            // SAVE BASELINE
            //==================================================

            saveProjectBaseline(
                currentProjectId,
                projectData
            );

            localStorage.setItem(
                "espasyo_project_name",
                trimmedName
            );

            //==================================================
            // DELETE DRAFT AFTER SUCCESSFUL SAVE
            //==================================================

            if (draftId) {
                deleteDraft(
                    user.uid,
                    draftId
                );
            }

            setMessage(
                isExistingProject
                    ? "Project updated successfully."
                    : isDraftProject
                        ? "Draft saved successfully."
                        : "Project saved successfully."
            );
        } catch (error: unknown) {
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
            setSaving(false);
        }
    }

    //==================================================
    // RENDER
    //==================================================

    return (
        <aside className="design-sidebar">
            <div className="panel-card">
                <h3 className="section-title">
                    {
                        deadlineLocked
                            ? "Project Read Only"
                            : isExistingProject
                                ? "Edit Project"
                                : isDraftProject
                                    ? "Continue Draft"
                                    : "Save Project"
                    }
                </h3>

                {deadlineLocked && (
                    <div
                        role="alert"
                        className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
                    >
                        The project deadline has passed.
                        Editing and saving are disabled.
                        You can still view the design.
                    </div>
                )}

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
                        value={projectName}
                        onChange={event =>
                            setProjectName(
                                event.target.value
                            )
                        }
                        disabled={
                            saving ||
                            deadlineLocked
                        }
                    />
                </div>

                {
                    (
                        routeProjectId ??
                        projectId
                    ) && (
                        <div className="project-id-display">
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
                    onClick={handleSave}
                    disabled={
                        saving ||
                        deadlineLocked
                    }
                >
                    {
                        deadlineLocked
                            ? "Read Only"
                            : saving
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
                            {message}
                        </div>
                    )
                }
            </div>
        </aside>
    );
}
