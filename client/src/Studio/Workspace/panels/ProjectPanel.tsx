
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

import { projectApi } from "../../../services/projectApi";
import {
    acknowledgeSubmissionAgreement,
    getClientProjectActivity,
    getClientProjectWorkflow,
    submitClientProject,
    type ProjectActivity
} from "../../../services/clientProjectWorkflow";

import {
    captureSceneThumbnail
} from "../../../services/projectThumbnail";

import {
    deleteDraft,
    getDraft
} from "../../../services/projectDraftService";

import {
    isDeadlinePassed,
    getDaysUntilProjectDeadline,
    formatProjectDeadline,
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

function formatActivityTimestamp(value: unknown): string {
    const date = typeof value === "string"
        ? new Date(value)
        : value instanceof Date
            ? value
            : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleString()
        : "Unknown date";
}

function formatActivityValue(value: unknown): string {
    if (value === null) return "none";
    if (typeof value !== "object" || value instanceof Date) return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return "value unavailable";
    }
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
        state,
        dispatch
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
    const [projectStatus, setProjectStatus] = useState<string>("available");
    const [revisionFeedback, setRevisionFeedback] = useState<string | null>(null);
    const [deadline, setDeadline] = useState<string | null>(null);
    const [savedVersionNumber, setSavedVersionNumber] = useState<number | null>(null);
    const [projectActivities, setProjectActivities] = useState<ProjectActivity[]>([]);
    const [showSubmissionAgreement, setShowSubmissionAgreement] = useState(false);
    const [submissionAgreementChecked, setSubmissionAgreementChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState("");

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
        let active = true;
        const updateLockStatus = () => {
            setDeadlineLocked(isProjectReadOnlyByDeadline());
        };
        const refreshWorkflow = async () => {
            if (routeProjectId) {
                try {
                    const workflow = await getClientProjectWorkflow(routeProjectId);
                    if (!active) return;
                    setProjectStatus(workflow.projectStatus);
                    setRevisionFeedback(workflow.revisionFeedback);
                    setDeadline(workflow.deadline);
                    setSavedVersionNumber(workflow.currentDesignVersionNumber ??
                        (workflow.clientDesignStarted ? 0 : null));
                    setActiveProjectDeadline(routeProjectId, workflow.deadline);
                    setDeadlineLocked(isDeadlinePassed(workflow.deadline));
                    dispatch({
                        type: "SET_PROJECT_LOCKED",
                        payload: !workflow.deadline ||
                            isDeadlinePassed(workflow.deadline) ||
                            workflow.projectStatus === "submitted" ||
                            workflow.projectStatus === "approved"
                    });
                    try {
                        setProjectActivities(await getClientProjectActivity(routeProjectId));
                    } catch (activityError) {
                        console.error("Unable to refresh project activity:", activityError);
                    }
                    return;
                } catch (error) {
                    console.error("Unable to refresh project status and deadline:", error);
                }
            }
        };

        updateLockStatus();
        void refreshWorkflow();

        const unsubscribe =
            subscribeToProjectDeadline(
                updateLockStatus
            );

        // Update the UI if the deadline passes while
        // the editor remains open.
        const timer = window.setInterval(() => {
            updateLockStatus();
            void refreshWorkflow();
        }, 15_000);

        return () => {
            active = false;
            unsubscribe();
            window.clearInterval(timer);
        };
    }, [routeProjectId, dispatch]);

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
                    if (data.workflowType === "admin-managed") {
                        try {
                            const workflow = await getClientProjectWorkflow(existingProjectId);
                            setProjectStatus(workflow.projectStatus);
                            setRevisionFeedback(workflow.revisionFeedback);
                            setDeadline(workflow.deadline);
                            setSavedVersionNumber(workflow.currentDesignVersionNumber ??
                                (workflow.clientDesignStarted ? 0 : null));
                            dispatch({
                                type: "SET_PROJECT_LOCKED",
                                payload: !workflow.deadline ||
                                    isDeadlinePassed(workflow.deadline) ||
                                    workflow.projectStatus === "submitted" ||
                                    workflow.projectStatus === "approved"
                            });
                            setProjectActivities(await getClientProjectActivity(existingProjectId));
                        } catch (workflowError) {
                            console.error("Failed to load project workflow details:", workflowError);
                        }
                    }

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
        draftId,
        dispatch
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
        if (
            state.workflowType === "admin-managed" &&
            ["submitted", "approved"].includes(projectStatus)
        ) {
            setMessage("This project is locked during review or after approval.");
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
                if (["submitted", "approved"].includes(metadata.projectStatus)) {
                    throw new Error("This project is locked during review or after approval.");
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
                const thumbnail = await uploadThumbnail?.();
                const saveResult = await projectApi<{
                    versionId?: string;
                    versionNumber?: number;
                }>(
                    `/projects/${encodeURIComponent(currentProjectId)}/managed-interior`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            interiorData,
                            estimatedCost,
                            thumbnailPath: thumbnail?.thumbnailPath,
                            thumbnailUrl: thumbnail?.thumbnailUrl
                        })
                    }
                );
                if (saveResult.versionNumber !== undefined) {
                    setSavedVersionNumber(saveResult.versionNumber);
                }
                setProjectStatus("ongoing");
                setRevisionFeedback(null);
                dispatch({
                    type: "SET_PROJECT_LOCKED",
                    payload: false
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
                const interiorJsonPath =
                    `projects/${user.uid}/${currentProjectId}.interior.json`;
                const interiorJsonRef = ref(storage, interiorJsonPath);
                const interiorData = {
                    projectId: currentProjectId,
                    ownerId: user.uid,
                    wallPaintSeparators:
                        state.floors[0]?.wallPaintSeparators ??
                        state.wallPaintSeparators,
                    ...(state.floors.length > 0
                        ? {
                            floors: state.floors.map(floor => ({
                                floorId: floor.floorId,
                                wallPaintSeparators: floor.wallPaintSeparators
                            }))
                        }
                        : {}),
                    ...(state.projectBudget !== null
                        ? { maximumBudget: state.projectBudget }
                        : {})
                };
                await uploadString(
                    interiorJsonRef,
                    JSON.stringify(interiorData, null, 2),
                    "raw",
                    { contentType: "application/json" }
                );
                projectMetadata.interiorJsonPath = interiorJsonPath;
                projectMetadata.interiorJsonUrl =
                    await getDownloadURL(interiorJsonRef);
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
                {
                    ...projectData,
                    maximumBudget: state.projectBudget,
                    wallPaintSeparators: state.wallPaintSeparators,
                    wallPaintSeparatorsByFloor: state.floors.map(floor => ({
                        floorId: floor.floorId,
                        wallPaintSeparators: floor.wallPaintSeparators
                    }))
                }
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
            if (isManaged) {
                try {
                    setProjectActivities(await getClientProjectActivity(currentProjectId));
                } catch (activityError) {
                    console.error("Design saved, but project activity could not be refreshed:", activityError);
                }
            }
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

    async function handleSubmitProject() {
        if (!routeProjectId || !submissionAgreementChecked || submitting) return;
        setSubmitting(true);
        setSubmissionError("");
        try {
            await acknowledgeSubmissionAgreement(routeProjectId);
            await submitClientProject(routeProjectId);
            setProjectStatus("submitted");
            setShowSubmissionAgreement(false);
            setMessage("Project submitted successfully. Editing is paused while an administrator reviews it.");
            dispatch({
                type: "SET_PROJECT_LOCKED",
                payload: true
            });
            try {
                setProjectActivities(await getClientProjectActivity(routeProjectId));
            } catch (activityError) {
                console.error("Project was submitted, but activity could not be refreshed:", activityError);
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : "Unable to submit project.");
        } finally {
            setSubmitting(false);
        }
    }

    const daysRemaining = deadline
        ? getDaysUntilProjectDeadline(deadline)
        : null;
    const projectLocked = deadlineLocked ||
        (state.workflowType === "admin-managed" && !deadline) ||
        projectStatus === "submitted" ||
        projectStatus === "approved";

    //==================================================
    // RENDER
    //==================================================

    return (
        <aside className="design-sidebar">
            <div className="panel-card">
                <h3 className="section-title">
                    {
                        projectLocked
                            ? "Project Read Only"
                            : isExistingProject
                                ? "Edit Project"
                                : isDraftProject
                                    ? "Continue Draft"
                                    : "Save Project"
                    }
                </h3>

                {projectLocked && (
                    <div
                        role="alert"
                        className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
                    >
                        {projectStatus === "submitted"
                            ? "This project is submitted and locked during administrative review."
                            : projectStatus === "approved"
                                ? "This approved project is locked against further changes."
                                : state.workflowType === "admin-managed" && !deadline
                                    ? "Editing is paused until an administrator sets a valid project deadline."
                                : "The project deadline has passed. Editing and saving are disabled."}
                    </div>
                )}
                {projectStatus === "approved" && (
                    <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs leading-relaxed text-green-900">
                        Approved as a reference for professional development. This is not construction authorization or a finalized construction agreement; consultation and final development happen separately.
                    </p>
                )}
                {deadline && (
                    <p className={`mb-3 rounded-lg border px-3 py-2 text-xs ${daysRemaining !== null && daysRemaining <= 3 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-black/10 bg-white text-black/60"}`}>
                        Deadline (Philippine time): {formatProjectDeadline(deadline)}
                        {daysRemaining !== null && (daysRemaining < 0
                            ? ` · ${Math.abs(daysRemaining)} day(s) overdue`
                            : daysRemaining === 0
                                ? " · Due today"
                                : ` · ${daysRemaining} day(s) remaining`)}
                    </p>
                )}
                {revisionFeedback && projectStatus === "revision-requested" && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                        <strong>Revision requested:</strong> {revisionFeedback}
                    </div>
                )}
                {savedVersionNumber !== null && (
                    <p className="mb-2 text-xs text-muted-foreground">Last saved design version: {savedVersionNumber}</p>
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
                        readOnly={state.workflowType === "admin-managed"}
                        aria-readonly={state.workflowType === "admin-managed"}
                        disabled={
                            saving ||
                            projectLocked
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
                        projectLocked
                    }
                >
                    {
                        projectLocked
                            ? "Read Only"
                            : saving
                                ? "Saving..."
                                : isExistingProject
                                    ? "Save Changes"
                                    : "Save Project"
                    }
                </button>
                {state.workflowType === "admin-managed" &&
                    isExistingProject &&
                    projectStatus !== "submitted" &&
                    projectStatus !== "approved" && (
                        <button
                            type="button"
                            className="confirm-layout-button mt-2"
                            onClick={() => {
                                setSubmissionAgreementChecked(false);
                                setSubmissionError("");
                                setShowSubmissionAgreement(true);
                            }}
                            disabled={projectLocked || saving || savedVersionNumber === null}
                        >
                            Submit for Review
                        </button>
                    )}
                {isExistingProject && !projectLocked && (
                    <button
                        type="button"
                        className="confirm-layout-button mt-2"
                        disabled={saving}
                        onClick={() => {
                            if (window.confirm("Discard unsaved changes and reload the last saved design?")) {
                                window.location.reload();
                            }
                        }}
                    >
                        Discard Unsaved Changes
                    </button>
                )}
                {projectActivities.length > 0 && (
                    <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-medium">Recent project activity</summary>
                        <ul className="mt-2 space-y-1 text-muted-foreground">
                            {projectActivities.slice(0, 5).map(activity => (
                                <li key={activity.id}>
                                    <span className="font-medium text-foreground">
                                        {activity.action.replaceAll("-", " ")}
                                    </span>
                                    {" · "}{formatActivityTimestamp(activity.createdAt)}
                                    {" · "}{activity.actorName || (activity.actorRole === "client" ? "You" : "Admin")}
                                    {activity.description && <p>{activity.description}</p>}
                                    {(activity.previousValue !== undefined || activity.newValue !== undefined) && (
                                        <p>
                                            {activity.previousValue !== undefined
                                                ? `Previous: ${formatActivityValue(activity.previousValue)}`
                                                : ""}
                                            {activity.previousValue !== undefined && activity.newValue !== undefined ? " · " : ""}
                                            {activity.newValue !== undefined
                                                ? `New: ${formatActivityValue(activity.newValue)}`
                                                : ""}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </details>
                )}

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
            {showSubmissionAgreement && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
                    <section role="dialog" aria-modal="true" aria-labelledby="submission-agreement-title" className="w-full max-w-xl rounded-2xl bg-white p-6 text-[#1b1b1b] shadow-xl">
                        <h2 id="submission-agreement-title" className="text-xl font-semibold">Project Submission Agreement</h2>
                        <p className="mt-3 text-sm leading-6 text-black/65">
                            I have completed and reviewed my proposed design and am submitting it for administrative evaluation.
                            I understand that the construction company may request revisions, and that this proposal is a reference
                            for professional development—not approval for construction. Final specifications, quotations,
                            construction agreements, and contractual obligations are handled separately with the company.
                        </p>
                        <label className="mt-5 flex items-start gap-2 text-sm leading-5">
                            <input
                                type="checkbox"
                                checked={submissionAgreementChecked}
                                onChange={event => setSubmissionAgreementChecked(event.target.checked)}
                            />
                            <span>I have read and agree to the Project Submission Agreement.</span>
                        </label>
                        {submissionError && <p role="alert" className="mt-3 text-sm text-red-700">{submissionError}</p>}
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" className="rounded-lg border border-black/15 px-4 py-2 text-sm" onClick={() => setShowSubmissionAgreement(false)} disabled={submitting}>Cancel</button>
                            <button type="button" className="rounded-lg bg-[#1b1b1b] px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => void handleSubmitProject()} disabled={!submissionAgreementChecked || submitting}>
                                {submitting ? "Submitting..." : "Confirm Submission"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </aside>
    );
}
