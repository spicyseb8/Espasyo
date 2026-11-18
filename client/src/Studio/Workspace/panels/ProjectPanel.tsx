import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from "react";

import {
    useParams,
    useSearchParams
} from "react-router-dom";

import useEditor
    from "../../../context/editor/useEditor";
import { canPerformProjectWrite } from "../../../context/editor/viewOnly";

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
    isProjectReadOnlyByDeadline,
    isValidProjectDeadline,
    setActiveProjectDeadline,
    subscribeToProjectDeadline
} from "../../../services/projectDeadlineService";
import { registerProjectSave } from "../../../services/projectSaveRegistry";

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
// FORMAT THE DEADLINE FOR DISPLAY (Philippine time)
//======================================================

function formatDeadline(value: string | null): string {
    if (!value) return "Not set yet";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not set yet";

    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

//======================================================
// TOAST
//======================================================

type ToastType = "success" | "error" | "info";

interface Toast {
    id: number;
    type: ToastType;
    text: string;
}

const TOAST_DURATION_MS = 4500;

// How long after the project loads we keep treating editor
// changes as "initial loading" rather than user edits.
const BASELINE_SETTLE_MS = 2000;

//======================================================
// PROJECT PANEL
//======================================================

interface Props {
    open: boolean;
}

export default function ProjectPanel({ open }: Props) {
    const {
        state,
        dispatch,
        viewOnly
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

    // The project name is edited in the top bar. The panel only
    // mirrors it so it can be saved with the project.
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

    const [toast, setToast] = useState<Toast | null>(null);
    const toastTimerRef = useRef<number | null>(null);
    const toastIdRef = useRef(0);

    const saveHandlerRef = useRef<() => Promise<boolean>>(async () => false);
    const saveErrorRef = useRef("");
    const [projectStatus, setProjectStatus] = useState<string>("available");
    const [revisionFeedback, setRevisionFeedback] = useState<string | null>(null);
    const [deadline, setDeadline] = useState<string | null>(null);
    const [savedVersionNumber, setSavedVersionNumber] = useState<number | null>(null);
    const [, setProjectActivities] = useState<ProjectActivity[]>([]);
    const [showSubmissionAgreement, setShowSubmissionAgreement] = useState(false);
    const [showAdjustmentPolicy, setShowAdjustmentPolicy] = useState(false);
    const [submissionAgreementChecked, setSubmissionAgreementChecked] = useState(false);
    const [publicConsentChecked, setPublicConsentChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState("");

    // Unsaved-change tracking
    const [savedThisSession, setSavedThisSession] = useState(false);
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);
    const [savedSignature, setSavedSignature] = useState<string | null>(null);
    const loadedAtRef = useRef<number | null>(null);
    const baselineLockedRef = useRef(false);

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
    // TOASTS
    //==================================================

    const dismissToast = useCallback(() => {
        if (toastTimerRef.current !== null) {
            window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
        setToast(null);
    }, []);

    const notify = useCallback((type: ToastType, text: string) => {
        if (toastTimerRef.current !== null) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastIdRef.current += 1;
        setToast({ id: toastIdRef.current, type, text });
        toastTimerRef.current = window.setTimeout(() => {
            toastTimerRef.current = null;
            setToast(null);
        }, TOAST_DURATION_MS);
    }, []);

    useEffect(() => () => {
        if (toastTimerRef.current !== null) {
            window.clearTimeout(toastTimerRef.current);
        }
    }, []);

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

                    setDeadline(currentDeadline);

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
                } finally {
                    if (!cancelled) {
                        loadedAtRef.current = Date.now();
                    }
                }

                return;
            }

            if (!draftId) {
                loadedAtRef.current = Date.now();
                return;
            }

            const ownerId =
                auth.currentUser?.uid ??
                localStorage.getItem(
                    "espasyo_current_user_uid"
                );

            if (!ownerId) {
                loadedAtRef.current = Date.now();
                return;
            }

            const draft = getDraft(
                ownerId,
                draftId
            );

            if (!draft || cancelled) {
                loadedAtRef.current = Date.now();
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
            loadedAtRef.current = Date.now();
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
    // KEEP THE NAME IN SYNC WITH THE TOP BAR
    //==================================================

    useEffect(() => {
        const handleNameChange = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail;
            if (typeof detail === "string") {
                setProjectName(detail);
            }
        };

        window.addEventListener(
            "espasyo-project-name-change",
            handleNameChange
        );

        return () => {
            window.removeEventListener(
                "espasyo-project-name-change",
                handleNameChange
            );
        };
    }, []);

    //==================================================
    // SAVE PROJECT NAME LOCALLY
    //==================================================

    useEffect(() => {
        if (!projectName.trim()) {
            localStorage.removeItem(
                "espasyo_project_name"
            );
            window.dispatchEvent(new CustomEvent("espasyo-project-name-change", {
                detail: ""
            }));

            return;
        }

        localStorage.setItem(
            "espasyo_project_name",
            projectName
        );
        window.dispatchEvent(new CustomEvent("espasyo-project-name-change", {
            detail: projectName
        }));
    }, [
        projectName
    ]);

    //==================================================
    // TRACK UNSAVED CHANGES
    //
    // A signature of everything that gets saved is compared
    // against the signature captured at the last save.
    //==================================================

    const computeSignature = useCallback((): string => {
        try {
            return JSON.stringify({
                project: createProjectData(
                    state,
                    "signature",
                    projectName.trim(),
                    auth.currentUser?.uid ?? ""
                ),
                wallFinishes: state.wallFinishes,
                maximumBudget: state.projectBudget,
                wallPaintSeparators: state.wallPaintSeparators,
                floors: state.floors.map(floor => ({
                    floorId: floor.floorId,
                    wallPaintSeparators: floor.wallPaintSeparators
                }))
            });
        } catch (error) {
            console.error("Unable to compute the project signature:", error);
            return "";
        }
    }, [state, projectName]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setCurrentSignature(computeSignature());
        }, 400);

        return () => window.clearTimeout(timer);
    }, [computeSignature]);

    // The first signatures after load are the saved design, not edits.
    useEffect(() => {
        if (currentSignature === null || baselineLockedRef.current) return;
        if (loadedAtRef.current === null) return;

        if (
            savedSignature === null ||
            Date.now() - loadedAtRef.current < BASELINE_SETTLE_MS
        ) {
            setSavedSignature(currentSignature);
        }
    }, [currentSignature, savedSignature]);

    const hasUnsavedChanges =
        currentSignature !== null &&
        savedSignature !== null &&
        currentSignature !== savedSignature;

    //==================================================
    // SAVE PROJECT
    //==================================================

    async function handleSave(): Promise<boolean> {
        saveErrorRef.current = "";

        const fail = (text: string): false => {
            saveErrorRef.current = text;
            notify("error", text);
            return false;
        };

        if (!canPerformProjectWrite(viewOnly, "save")) return false;

        const user =
            auth.currentUser;

        if (!user) {
            return fail("Please log in before saving a project.");
        }
        if (
            state.workflowType === "admin-managed" &&
            ["submitted", "approved"].includes(projectStatus)
        ) {
            return fail("This project is locked during review or after approval.");
        }

        const trimmedName =
            (
                projectName.trim() ||
                localStorage.getItem("espasyo_project_name")?.trim() ||
                ""
            );

        if (!trimmedName) {
            return fail("Please give your project a name in the top bar before saving.");
        }

        if (saving) {
            return false;
        }

        // Capture what is being saved so edits made while the
        // save is in flight are still detected afterwards.
        const signatureAtSave = computeSignature();

        try {
            setSaving(true);

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
                    return fail("Deadline passed. This project is read-only, and your changes cannot be saved.");
                }
            }

            // Check the currently active project's lock as well.
            if (isProjectReadOnlyByDeadline()) {
                setDeadlineLocked(true);

                return fail("Deadline passed. This project is read-only, and your changes cannot be saved.");
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

            // Mark the saved state so the button becomes "Saved"
            // until the next edit.
            baselineLockedRef.current = true;
            setCurrentSignature(signatureAtSave);
            setSavedSignature(signatureAtSave);
            setSavedThisSession(true);

            notify(
                "success",
                isExistingProject
                    ? "Changes saved successfully."
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
            return true;
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

            return fail(
                `Save failed: ${
                    firebaseError.code ?? "unknown"
                } - ${firebaseError.message ?? "Unknown error"}`
            );
        } finally {
            setSaving(false);
        }
    }

    useLayoutEffect(() => {
        saveHandlerRef.current = handleSave;
    });

    useEffect(
        () => registerProjectSave(
            () => saveHandlerRef.current(),
            () => saveErrorRef.current
        ),
        []
    );

    async function handleSubmitProject() {
        if (!canPerformProjectWrite(viewOnly, "submit")) return;
        if (!routeProjectId || !submissionAgreementChecked || submitting) return;
        setSubmitting(true);
        setSubmissionError("");
        try {
            await acknowledgeSubmissionAgreement(routeProjectId);
            await submitClientProject(routeProjectId, publicConsentChecked);
            setProjectStatus("submitted");
            setShowSubmissionAgreement(false);
            notify(
                "success",
                "Submitted for review. Editing is paused while an administrator reviews your design."
            );
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
            const text = error instanceof Error ? error.message : "Unable to submit project.";
            setSubmissionError(text);
            notify("error", text);
        } finally {
            setSubmitting(false);
        }
    }

    const projectLocked = deadlineLocked ||
        (state.workflowType === "admin-managed" && !deadline) ||
        projectStatus === "submitted" ||
        projectStatus === "approved";

    //==================================================
    // BUTTON STATE
    //==================================================

    const isManagedProject = state.workflowType === "admin-managed";

    // Has this design been saved at least once?
    const hasSavedDesign =
        savedThisSession ||
        (isExistingProject &&
            (isManagedProject ? savedVersionNumber !== null : true));

    // First click is always "Save Changes"; afterwards only when edited.
    const canSave =
        !projectLocked &&
        !saving &&
        (!hasSavedDesign || hasUnsavedChanges);

    const saveState: "locked" | "saving" | "saved" | "idle" =
        projectLocked
            ? "locked"
            : saving
                ? "saving"
                : canSave
                    ? "idle"
                    : "saved";

    const saveLabel =
        saveState === "locked"
            ? "Read Only"
            : saveState === "saving"
                ? "Saving..."
                : saveState === "saved"
                    ? "Saved"
                    : "Save Changes";

    const canSubmit =
        !projectLocked &&
        !saving &&
        hasSavedDesign &&
        !hasUnsavedChanges;

    const submitHint =
        projectLocked || saving
            ? ""
            : !hasSavedDesign
                ? "Save your design first to unlock submission."
                : hasUnsavedChanges
                    ? "Save your latest changes before submitting."
                    : "";

    //==================================================
    // RENDER
    //==================================================

    return (
        <>
            <aside
                id="project-panel-dropdown"
                className="project-panel-dropdown"
                aria-label="Project panel"
                hidden={!open}
            >
                <div className="project-panel-card">
                    <div
                        className="project-panel-deadline"
                        data-state={
                            !deadline
                                ? "none"
                                : deadlineLocked
                                    ? "passed"
                                    : "active"
                        }
                    >
                        <span className="project-panel-deadline-label">Deadline</span>
                        <span className="project-panel-deadline-value">
                            {formatDeadline(deadline)}
                        </span>
                        {deadline && deadlineLocked && (
                            <span className="project-panel-deadline-badge">Passed</span>
                        )}
                    </div>

                    {projectLocked && (
                        <div
                            role="alert"
                            className="project-panel-notice project-panel-notice-warning"
                        >
                            {projectStatus === "submitted"
                                ? "Awaiting administrative review. Editing is paused."
                                : projectStatus === "approved"
                                    ? "This project is approved and read-only."
                                    : isManagedProject && !deadline
                                        ? "Editing is paused until an administrator sets a deadline."
                                        : "The project deadline has passed. Editing and saving are disabled."}
                        </div>
                    )}
                    {projectStatus === "approved" && (
                        <p className="project-panel-notice project-panel-notice-success">
                            Approved as a professional-development reference, not construction authorization.
                        </p>
                    )}
                    {revisionFeedback && projectStatus === "revision-requested" && (
                        <div className="project-panel-notice project-panel-notice-warning">
                            <strong>Revision requested:</strong> {revisionFeedback}
                        </div>
                    )}

                    <button
                        type="button"
                        className="project-save-button"
                        data-state={saveState}
                        onClick={() => void handleSave()}
                        disabled={!canSave}
                        aria-busy={saving}
                    >
                        <span className="project-save-button-icon" aria-hidden="true">
                            {saveState === "saving" ? (
                                <svg className="project-save-spinner" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.28" strokeWidth="3" />
                                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                            ) : saveState === "saved" ? (
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path className="project-save-check" d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : saveState === "locked" ? (
                                <svg viewBox="0 0 24 24" fill="none">
                                    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                                    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M5 4h11l3 3v13H5V4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                    <path d="M8 4v5h7V4M8 20v-6h8v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                </svg>
                            )}
                        </span>
                        <span>{saveLabel}</span>
                    </button>

                    {isManagedProject &&
                        isExistingProject &&
                        projectStatus !== "submitted" &&
                        projectStatus !== "approved" && (
                            <>
                                <button
                                    type="button"
                                    className="project-submit-button"
                                    onClick={() => {
                                        setSubmissionAgreementChecked(false);
                                        setPublicConsentChecked(false);
                                        setSubmissionError("");
                                        setShowSubmissionAgreement(true);
                                    }}
                                    disabled={!canSubmit}
                                >
                                    Submit for Review
                                </button>
                                <button
                                    type="button"
                                    className="mt-2 text-xs font-medium underline underline-offset-4 text-black/70 hover:text-black"
                                    onClick={() => setShowAdjustmentPolicy(true)}
                                >
                                    Read project adjustment policy
                                </button>
                                {submitHint && (
                                    <p className="project-panel-hint">{submitHint}</p>
                                )}
                            </>
                        )}
                </div>
            </aside>

            {toast && (
                <div
                    key={toast.id}
                    className={`project-toast project-toast-${toast.type}`}
                    role={toast.type === "error" ? "alert" : "status"}
                    aria-live={toast.type === "error" ? "assertive" : "polite"}
                >
                    <span className="project-toast-icon" aria-hidden="true">
                        {toast.type === "success" ? (
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 7v6M12 17h.01" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                            </svg>
                        )}
                    </span>
                    <span className="project-toast-text">{toast.text}</span>
                    <button
                        type="button"
                        className="project-toast-close"
                        onClick={dismissToast}
                        aria-label="Dismiss notification"
                    >
                        ×
                    </button>
                    <span
                        className="project-toast-progress"
                        style={{ animationDuration: `${TOAST_DURATION_MS}ms` }}
                    />
                </div>
            )}

            {showAdjustmentPolicy && (
                <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/50 p-4">
                    <section role="dialog" aria-modal="true" aria-labelledby="adjustment-policy-title" className="max-h-[min(90vh,760px)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-8 text-[#1b1b1b] shadow-xl sm:p-10">
                        <div className="flex items-start justify-between gap-4">
                            <h2 id="adjustment-policy-title" className="text-xl font-semibold">Project Adjustment and Resolution Policy</h2>
                            <button type="button" className="text-sm text-black/60 hover:text-black" onClick={() => setShowAdjustmentPolicy(false)} aria-label="Close project adjustment policy">
                                Close
                            </button>
                        </div>
                        <div className="mt-5 text-sm leading-6 text-black/75">
                            <p className="mb-4">This policy explains how schedule changes, temporary pauses, and project adjustments are handled while the design remains under review or coordination.</p>
                            <p className="mb-4">A request does not automatically become an approved change, and a missed deadline does not automatically cancel the project. The Company may approve, reject, request clarification, or propose a different arrangement after reviewing the circumstances.</p>
                            <p className="mb-4">If the project becomes inactive, the Company may contact the client and consider a revised deadline, a temporary pause, administrative review, or a formal discontinuation process. Material changes must be documented before they are treated as effective.</p>
                            <p className="mb-4">Technical issues, schedule delays, and platform interruptions may justify an adjustment, but the issue must be reviewed in context rather than treated as ordinary inactivity.</p>
                        </div>
                    </section>
                </div>
            )}

            {showSubmissionAgreement && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
                    <section role="dialog" aria-modal="true" aria-labelledby="submission-agreement-title" className="max-h-[min(90vh,760px)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 text-[#1b1b1b] shadow-xl sm:p-10">
                        <h2 id="submission-agreement-title" className="text-xl font-semibold">Client Project Participation and Coordination Agreement</h2>
                        <div className="mt-5 space-y-4 text-sm leading-6 text-black/70">
                            <p>
                                This Agreement establishes the responsibilities, expectations, and coordination procedures between Jocer Construction and the assigned client when participating in an interior design project through Espasyo.
                            </p>
                            <p>
                                Espasyo provides a digital environment for creating, modifying, saving, submitting, and reviewing interior design concepts and floor plans. The project record and approved updates serve as the operational reference for the work performed through the platform.
                            </p>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-black/80">Project responsibilities</h3>
                                <p>
                                    <strong className="font-semibold text-black">Jocer Construction</strong> will make reasonable efforts to provide project information, instructions, ongoing access subject to technical limits, review of submitted designs, communication about deadlines and administrative decisions, and appropriate records of project activity. It does not approve any construction method, structural modification, or implementation merely because a digital design has been reviewed or approved in Espasyo.
                                </p>
                                <p>
                                    <strong className="font-semibold text-black">The client</strong> is responsible for providing accurate project information, reviewing the assigned project details before design work begins, using the platform responsibly, submitting the project through the designated process, saving work, and notifying the company of any change in requirements or circumstances that may affect a deadline or project scope.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-black/80">Schedule and scope</h3>
                                <p>
                                    Each project has an initial deadline established by the company. If a client anticipates a delay, the client should notify the company as soon as reasonably practicable. If the deadline passes without a submission, the project may be marked as past due or awaiting client action, and the company may send reminders, consider an extension, or propose a revised schedule. Any approved adjustment must be documented in Espasyo.
                                </p>
                                <p>
                                    Material changes to the agreed project scope, deliverables, or schedule must be discussed and documented before being treated as approved. The number and nature of revisions may vary by project, and this Agreement does not promise unlimited revisions. Additional work, fees, or construction-related changes must be confirmed through a separate written arrangement.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-black/80">Submission, review, and approval</h3>
                                <p>
                                    The Client should submit the design through the designated Espasyo submission process. The company may approve the digital design, request revisions, or return the project for further development. Approval in Espasyo means the digital design has passed the applicable platform review stage; it does not certify structural safety, guarantee construction feasibility, confirm material availability, establish a final project price, or authorize physical construction.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-black/80">Important limitations</h3>
                                <p>
                                    Digital floor plans, measurements, 3D models, furniture arrangements, material previews, and visual representations are planning and visualization references only. Before implementation, relevant dimensions, site conditions, structural requirements, building regulations, material availability, and technical feasibility must be verified independently by suitably qualified persons. The client should not treat a digital visualization as a substitute for professional architectural, engineering, structural, or construction documentation.
                                </p>
                                <p>
                                    The company retains its rights in its own pre-existing materials, software, design assets, templates, libraries, and proprietary resources. Access to company-provided assets through Espasyo does not transfer ownership of those assets to the client. Use of a client’s design for public promotion, portfolio display, or marketing requires appropriate consent or authorization.
                                </p>
                            </div>
                            <p>
                                I have completed and reviewed my proposed design and am submitting it for administrative evaluation. I understand that the construction company may request revisions, and that this proposal is a reference for professional development—not approval for construction. Final specifications, quotations, construction agreements, and contractual obligations are handled separately with the company.
                            </p>
                        </div>
                        <label className="mt-5 flex items-start gap-2 text-sm leading-5">
                            <input
                                type="checkbox"
                                checked={submissionAgreementChecked}
                                onChange={event => setSubmissionAgreementChecked(event.target.checked)}
                            />
                            <span>I have read and agree to the Client Project Participation and Coordination Agreement.</span>
                        </label>
                        <label className="mt-4 flex items-start gap-2 text-sm leading-5 text-black/75">
                            <input
                                type="checkbox"
                                checked={publicConsentChecked}
                                onChange={event => setPublicConsentChecked(event.target.checked)}
                            />
                            <span>(Optional) I allow my approved design to be shared as a view-only reference for other clients. My name and personal details will not be shown.</span>
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
        </>
    );
}