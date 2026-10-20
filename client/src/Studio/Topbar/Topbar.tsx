import "./Topbar.css";

import {
    ArrowLeft,
    ChevronDown,
    Download,
    Loader2,
    Redo2,
    Save,
    Undo2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    setDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";

import useEditor from "../../context/editor/useEditor";
import { calculateCostEstimate } from "../../engine/cost/CostEstimator";
import { downloadCostBreakdownPdf } from "../../engine/cost/CostBreakdownPDF";
import type { CostCategory } from "../../engine/cost/CostTypes";
import { auth, db, storage } from "../../firebase/firebase";
import AdminComments from "../../scene/Comment/AdminComments";
import { deleteDraft, getDraft } from "../../services/projectDraftService";
import {
    isDeadlinePassed,
    isProjectReadOnlyByDeadline,
    isValidProjectDeadline,
    setActiveProjectDeadline,
    subscribeToProjectDeadline
} from "../../services/projectDeadlineService";
import { saveProjectBaseline } from "../../services/projectEditSessionService";
import { createProjectData } from "../../services/projectSerializer";
import { captureSceneThumbnail } from "../../services/projectThumbnail";

const CATEGORY_LABELS: Record<CostCategory, string> = {
    furniture: "Furniture",
    flooring: "Flooring",
    wallFinish: "Wall finish",
    doors: "Doors",
    windows: "Windows"
};

const CATEGORY_ORDER: CostCategory[] = [
    "furniture",
    "flooring",
    "wallFinish",
    "doors",
    "windows"
];

const formatCurrency = (amount: number, decimals = 2) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);

//======================================================
// PROJECT ID FORMAT (same as ProjectPanel)
//
// PRJ-00126
//     001 = sequence number
//      26 = year 2026
//======================================================

function getPhilippineYear(): number {
    const year = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric"
    }).format(new Date());

    return Number(year);
}

function formatProjectId(sequence: number, year: number): string {
    const sequenceCode = String(sequence).padStart(3, "0");
    const yearCode = String(year % 100).padStart(2, "0");

    return `PRJ-${sequenceCode}${yearCode}`;
}

async function generateNextProjectId(): Promise<string> {
    const year = getPhilippineYear();

    const counterRef = doc(db, "idCounters", "projects-${year}");

    return runTransaction(db, async transaction => {
        const counterSnapshot = await transaction.get(counterRef);

        const storedSequence = counterSnapshot.exists()
            ? Number(counterSnapshot.data().lastSequence ?? 0)
            : 0;

        if (!Number.isSafeInteger(storedSequence) || storedSequence < 0) {
            throw new Error("The project ID counter is invalid.");
        }

        let nextSequence = storedSequence + 1;
        let nextProjectId = formatProjectId(nextSequence, year);

        let destinationRef = doc(db, "projects", nextProjectId);
        let destinationSnapshot = await transaction.get(destinationRef);

        // Skip existing IDs instead of overwriting projects.
        while (destinationSnapshot.exists()) {
            nextSequence += 1;

            if (!Number.isSafeInteger(nextSequence)) {
                throw new Error("Unable to generate another project ID.");
            }

            nextProjectId = formatProjectId(nextSequence, year);
            destinationRef = doc(db, "projects", nextProjectId);
            destinationSnapshot = await transaction.get(destinationRef);
        }

        transaction.set(
            counterRef,
            {
                lastSequence: nextSequence,
                year,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        return nextProjectId;
    });
}

function usesProjectIdFormat(value: string): boolean {
    return /^PRJ-\d{3,}\d{2}$/.test(value);
}

export default function Topbar() {
    const { state, undo, redo, canUndo, canRedo } = useEditor();

    const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get("draft");

    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    const [projectName, setProjectName] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem("espasyo_project_name") || "";
    });

    const [projectId, setProjectId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [deadlineLocked, setDeadlineLocked] = useState(
        isProjectReadOnlyByDeadline()
    );

    const isExistingProject = Boolean(routeProjectId);
    const isDraftProject = Boolean(draftId);

    useEffect(() => {
        localStorage.setItem("espasyo_project_name", projectName);
    }, [projectName]);

    const handleProjectNameChange = (event: ChangeEvent<HTMLInputElement>) => {
        setProjectName(event.target.value);
    };

    //==================================================
    // WATCH DEADLINE LOCK STATUS
    //==================================================

    useEffect(() => {
        const updateLockStatus = () => {
            setDeadlineLocked(isProjectReadOnlyByDeadline());
        };

        updateLockStatus();

        const unsubscribe = subscribeToProjectDeadline(updateLockStatus);
        const timer = window.setInterval(updateLockStatus, 15_000);

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
                setProjectId(routeProjectId);

                try {
                    const projectSnapshot = await getDoc(
                        doc(db, "projects", routeProjectId)
                    );

                    if (cancelled || !projectSnapshot.exists()) return;

                    const data = projectSnapshot.data();

                    const currentDeadline = isValidProjectDeadline(
                        data.deadline
                    )
                        ? data.deadline
                        : null;

                    setActiveProjectDeadline(routeProjectId, currentDeadline);
                    setDeadlineLocked(isDeadlinePassed(currentDeadline));

                    if (
                        typeof data.projectName === "string" &&
                        data.projectName.trim() !== ""
                    ) {
                        setProjectName(data.projectName);
                    }
                } catch (error: unknown) {
                    console.error("Failed to load existing project:", error);
                }

                return;
            }

            if (!draftId) return;

            const ownerId =
                auth.currentUser?.uid ??
                localStorage.getItem("espasyo_current_user_uid");

            if (!ownerId) return;

            const draft = getDraft(ownerId, draftId);

            if (!draft || cancelled) return;

            setProjectId(draft.projectId);
            setProjectName(draft.projectName);
        }

        void initializeProject();

        return () => {
            cancelled = true;
        };
    }, [routeProjectId, draftId]);

    //==================================================
    // AUTO-HIDE THE SAVE MESSAGE
    //==================================================

    useEffect(() => {
        if (!message || saving) return;

        const timer = window.setTimeout(() => setMessage(""), 5000);

        return () => window.clearTimeout(timer);
    }, [message, saving]);

    //==================================================
    // SAVE PROJECT (copied from ProjectPanel)
    //==================================================

    async function handleSave() {
        const user = auth.currentUser;

        if (!user) {
            setMessage("Please log in before saving a project.");
            return;
        }

        const trimmedName = projectName.trim();

        if (!trimmedName) {
            setMessage("Please enter a project name.");
            return;
        }

        if (saving) return;

        try {
            setSaving(true);
            setMessage("Preparing project...");

            // Check the current Firestore deadline
            if (routeProjectId) {
                const projectSnapshot = await getDoc(
                    doc(db, "projects", routeProjectId)
                );

                if (!projectSnapshot.exists()) {
                    throw new Error("This project no longer exists.");
                }

                const metadata = projectSnapshot.data();

                if (metadata.ownerId !== user.uid) {
                    throw new Error(
                        "You do not have permission to edit this project."
                    );
                }

                const currentDeadline = isValidProjectDeadline(
                    metadata.deadline
                )
                    ? metadata.deadline
                    : null;

                setActiveProjectDeadline(routeProjectId, currentDeadline);
                setDeadlineLocked(isDeadlinePassed(currentDeadline));

                if (isDeadlinePassed(currentDeadline)) {
                    setMessage(
                        "Deadline passed. This project is read-only, and your changes cannot be saved."
                    );
                    return;
                }
            }

            if (isProjectReadOnlyByDeadline()) {
                setDeadlineLocked(true);
                setMessage(
                    "Deadline passed. This project is read-only, and your changes cannot be saved."
                );
                return;
            }

            // Existing projects keep their original ID. New projects get
            // a formatted ID, reused after an unsuccessful save attempt.
            let currentProjectId: string;

            if (routeProjectId) {
                currentProjectId = routeProjectId;
            } else if (projectId && usesProjectIdFormat(projectId)) {
                currentProjectId = projectId;
            } else {
                currentProjectId = await generateNextProjectId();
                setProjectId(currentProjectId);
            }

            const isNewProject = !routeProjectId;

            // Prepare project JSON
            const projectData = {
                ...createProjectData(
                    state,
                    currentProjectId,
                    trimmedName,
                    user.uid
                ),

                // Explicitly include both wall-side finishes.
                wallFinishes: state.wallFinishes
            };

            const estimatedCost = projectData.costEstimate.total;
            const json = JSON.stringify(projectData, null, 2);

            // Upload project JSON
            const storagePath = `projects/${user.uid}/${currentProjectId}.json`;
            const storageRef = ref(storage, storagePath);

            setMessage("Saving project...");

            await uploadString(storageRef, json, "raw", {
                contentType: "application/json"
            });

            const downloadUrl = await getDownloadURL(storageRef);

            // Capture and upload thumbnail
            const thumbnailDataUrl = captureSceneThumbnail();

            let thumbnailPath: string | undefined;
            let thumbnailUrl: string | undefined;

            if (thumbnailDataUrl) {
                thumbnailPath = `projects/${user.uid}/${currentProjectId}.jpg`;

                const thumbnailRef = ref(storage, thumbnailPath);

                setMessage("Saving project thumbnail...");

                await uploadString(
                    thumbnailRef,
                    thumbnailDataUrl,
                    "data_url",
                    { contentType: "image/jpeg" }
                );

                thumbnailUrl = await getDownloadURL(thumbnailRef);
            }

            // Firestore project metadata
            const projectMetadata: Record<string, unknown> = {
                projectId: currentProjectId,
                projectName: trimmedName,
                ownerId: user.uid,
                jsonPath: storagePath,
                jsonUrl: downloadUrl,
                schemaVersion: 1,
                estimatedCost,
                wallFinishes: state.wallFinishes,
                updatedAt: serverTimestamp()
            };

            if (thumbnailPath) projectMetadata.thumbnailPath = thumbnailPath;
            if (thumbnailUrl) projectMetadata.thumbnailUrl = thumbnailUrl;
            if (isNewProject) projectMetadata.createdAt = serverTimestamp();

            await setDoc(doc(db, "projects", currentProjectId), projectMetadata, {
                merge: true
            });

            saveProjectBaseline(currentProjectId, projectData);

            localStorage.setItem("espasyo_project_name", trimmedName);

            // Delete draft after a successful save
            if (draftId) {
                deleteDraft(user.uid, draftId);
            }

            setMessage(
                isExistingProject
                    ? "Project updated successfully."
                    : isDraftProject
                        ? "Draft saved successfully."
                        : "Project saved successfully."
            );
        } catch (error: unknown) {
            console.error("Failed to save project:", error);

            const firebaseError = error as {
                code?: string;
                message?: string;
            };

            setMessage(
                `Save failed: ${firebaseError.code ?? "unknown"} - ${
                    firebaseError.message ?? "Unknown error"
                }`
            );
        } finally {
            setSaving(false);
        }
    }

    //==================================================
    // COST ESTIMATE
    //==================================================

    const estimate = useMemo(() => calculateCostEstimate(state), [state]);

    const furnitureCount = state.furniture.length;

    // Close the estimate dropdown on outside click or Escape
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, []);

    const groupedItems = useMemo(() => {
        const groups: Record<CostCategory, typeof estimate.items> = {
            furniture: [],
            flooring: [],
            wallFinish: [],
            doors: [],
            windows: []
        };

        for (const item of estimate.items) {
            groups[item.category].push(item);
        }

        return groups;
    }, [estimate.items]);

    const handleDownloadReport = () => {
        try {
            downloadCostBreakdownPdf(estimate, projectName, routeProjectId);

            setOpen(false);
        } catch (error) {
            console.error("Failed to generate cost breakdown PDF:", error);

            window.alert(
                "Unable to generate the cost breakdown report. Please try again."
            );
        }
    };

    return (
        <header className="topbar">
            {/* Left — back to Studio, project name, save */}
            <div className="topbar-left">
                <Link
                    to="/studio"
                    className="topbar-back"
                    title="Back to Studio"
                    aria-label="Back to Studio"
                >
                    <ArrowLeft size={15} strokeWidth={1.75} />
                    <span>Studio</span>
                </Link>

                <input
                    type="text"
                    className="project-title-input"
                    placeholder="Untitled project"
                    value={projectName}
                    onChange={handleProjectNameChange}
                    onKeyDown={event => {
                        if (event.key === "Enter") void handleSave();
                    }}
                    disabled={saving || deadlineLocked}
                    aria-label="Project name"
                    spellCheck={false}
                />

                <div className="topbar-save">
                    <button
                        type="button"
                        className="topbar-save-button"
                        onClick={() => void handleSave()}
                        disabled={saving || deadlineLocked}
                        title={
                            deadlineLocked
                                ? "Deadline passed. This project is read-only."
                                : isExistingProject
                                    ? "Save changes"
                                    : "Save project"
                        }
                    >
                        {saving ? (
                            <Loader2
                                size={15}
                                strokeWidth={1.75}
                                className="topbar-save-spinner"
                            />
                        ) : (
                            <Save size={15} strokeWidth={1.75} />
                        )}
                        <span>
                            {deadlineLocked
                                ? "Read only"
                                : saving
                                    ? "Saving…"
                                    : "Save"}
                        </span>
                    </button>

                    {message && (
                        <div className="topbar-save-message" role="status">
                            {message}
                        </div>
                    )}
                </div>
            </div>

            {/* Right — history, comments, estimate */}
            <div className="topbar-actions">
                <div className="history-group" role="group" aria-label="History">
                    <button
                        type="button"
                        className="history-button"
                        onClick={undo}
                        disabled={!canUndo}
                        title="Undo"
                        aria-label="Undo"
                    >
                        <Undo2 size={15} strokeWidth={1.75} />
                    </button>

                    <button
                        type="button"
                        className="history-button"
                        onClick={redo}
                        disabled={!canRedo}
                        title="Redo"
                        aria-label="Redo"
                    >
                        <Redo2 size={15} strokeWidth={1.75} />
                    </button>
                </div>

                <div className="admin-comments-icon-only">
                    <AdminComments projectId={routeProjectId ?? null} />
                </div>

                <div className="cost-estimator" ref={dropdownRef}>
                    <button
                        type="button"
                        className="cost-estimator-button"
                        onClick={() => setOpen((value) => !value)}
                        aria-expanded={open}
                        aria-haspopup="true"
                    >
                        <span className="cost-estimator-label">Estimate</span>
                        <span className="cost-estimator-amount">
                            {formatCurrency(estimate.total, 0)}
                        </span>
                        <ChevronDown
                            size={14}
                            strokeWidth={1.75}
                            className={open ? "cost-chevron open" : "cost-chevron"}
                        />
                    </button>

                    {open && (
                        <div className="cost-estimator-dropdown">
                            <div className="cost-estimator-header">
                                <p className="cost-eyebrow">Cost estimate</p>
                                <p className="cost-summary">
                                    {furnitureCount} furniture{" "}
                                    {furnitureCount !== 1 ? "items" : "item"} ·{" "}
                                    {estimate.items.length} cost{" "}
                                    {estimate.items.length !== 1 ? "items" : "item"}
                                </p>
                            </div>

                            <div className="cost-estimator-list">
                                {estimate.items.length === 0 ? (
                                    <div className="cost-empty">
                                        No cost items yet. Add furniture or finishes to see your
                                        estimate.
                                    </div>
                                ) : (
                                    CATEGORY_ORDER.map((category) => {
                                        const items = groupedItems[category];
                                        if (items.length === 0) return null;

                                        const categoryTotal = items.reduce(
                                            (sum, item) => sum + item.subtotal,
                                            0
                                        );

                                        return (
                                            <section key={category} className="cost-category">
                                                <div className="cost-category-header">
                                                    <span>{CATEGORY_LABELS[category]}</span>
                                                    <strong>{formatCurrency(categoryTotal)}</strong>
                                                </div>

                                                {items.map((item, index) => (
                                                    <div
                                                        key={`${item.name}-${index}`}
                                                        className="cost-item"
                                                    >
                                                        <div className="cost-item-info">
                                                            <span className="cost-item-name">
                                                                {item.name}
                                                            </span>
                                                            <span className="cost-item-quantity">
                                                                {item.quantity.toFixed(
                                                                    item.unit === "m²" ? 2 : 0
                                                                )}{" "}
                                                                {item.unit} × {formatCurrency(item.rate)}/
                                                                {item.unit}
                                                            </span>
                                                        </div>

                                                        <span className="cost-item-total">
                                                            {formatCurrency(item.subtotal)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </section>
                                        );
                                    })
                                )}
                            </div>

                            <div className="cost-estimator-total">
                                <span>Estimated total</span>
                                <strong>{formatCurrency(estimate.total)}</strong>
                            </div>

                            <div className="cost-estimator-footer">
                                <button
                                    type="button"
                                    className="cost-estimator-export-button"
                                    onClick={handleDownloadReport}
                                >
                                    <Download size={15} strokeWidth={1.75} />
                                    <span>Download cost breakdown PDF</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}