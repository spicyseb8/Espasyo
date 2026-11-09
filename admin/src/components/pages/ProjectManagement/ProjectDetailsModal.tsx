import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
    FolderOpen,
    Download,
    Save,
    Eye,
    ChevronDown
} from "lucide-react";

import type { AdminProject } from "../../../services/assets/projectService";

import {
    formatCost,
    formatProjectDate
} from "./ProjectManagement";

import {
    getAdminProject,
    getAdminProjectActivity,
    getTomorrowLocalDateTime,
    getTodayLocalDate,
    isValidProjectDeadline,
    normalizeProjectDeadlineForInput,
    reviewAdminProject,
    updateProjectDeadline
} from "../../../services/assets/projectService";

import { downloadAdminCostBreakdownPDF } from "../../project-loader/engine/cost/AdminCostBreakdownPDF";
import { loadAdminManagedProjectForReview } from "@/services/assets/managedInteriorReview";

type Activity = Awaited<ReturnType<typeof getAdminProjectActivity>>;

interface ProjectDetailsModalProps {
    project: AdminProject | null;
    onOpenChange: (open: boolean) => void;
    onReviewClientDesign: (project: AdminProject, snapshot?: "submitted" | "approved") => void;
    onProjectReviewed?: (projectId: string, status: string) => void;
    onDeadlineSaved?: (projectId: string, deadline: string) => void;
}

export default function ProjectDetailsModal({
    project,
    onOpenChange,
    ...rest
}: ProjectDetailsModalProps) {
    return (
        <Dialog open={project !== null} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]">
                <DialogTitle className="sr-only">
                    {project?.projectName ?? "Project details"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Project preview, review actions, deadline and activity.
                </DialogDescription>

                {/* Keyed by project so all local state resets when a different project opens */}
                {project && (
                    <ModalBody
                        key={project.projectId}
                        project={project}
                        onClose={() => onOpenChange(false)}
                        {...rest}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function ModalBody({
    project,
    onClose,
    onReviewClientDesign,
    onProjectReviewed,
    onDeadlineSaved
}: Omit<ProjectDetailsModalProps, "project" | "onOpenChange"> & {
    project: AdminProject;
    onClose: () => void;
}) {
    const status = project.projectStatus ?? "ongoing";
    const isSubmitted = status === "submitted";
    const isApproved = status === "approved";
    const isAdminManaged = project.workflowType === "admin-managed";

    // ---- Preview ----
    const [imgError, setImgError] = useState(false);
    const hasThumbnail = Boolean(project.thumbnailUrl?.trim()) && !imgError;

    // ---- Cost PDF ----
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState("");

    // ---- Deadline ----
    const [editingDeadline, setEditingDeadline] = useState(false);
    const [deadline, setDeadline] = useState(normalizeProjectDeadlineForInput(project.deadline));
    const [deadlineReason, setDeadlineReason] = useState("");
    const [savingDeadline, setSavingDeadline] = useState(false);
    const [deadlineError, setDeadlineError] = useState("");
    const [deadlineSaved, setDeadlineSaved] = useState(false);

    // ---- Review ----
    const [reviewReason, setReviewReason] = useState("");
    const [reviewError, setReviewError] = useState("");
    const [reviewing, setReviewing] = useState(false);

    // ---- Activity ----
    const [activities, setActivities] = useState<Activity>([]);
    const [activityError, setActivityError] = useState("");

    useEffect(() => {
        let active = true;
        getAdminProjectActivity(project.projectId)
            .then(result => { if (active) setActivities(result); })
            .catch(error => {
                console.error("Failed to load project activity:", error);
                if (active) setActivityError("Activity could not be loaded.");
            });
        return () => { active = false; };
    }, [project.projectId]);

    async function handleDownloadPdf() {
        if (generatingPdf) return;
        setGeneratingPdf(true);
        setPdfError("");
        try {
            let projectData: unknown;
            if (isAdminManaged) {
                const latest = await getAdminProject(project.projectId);
                projectData = await loadAdminManagedProjectForReview(latest);
            } else {
                if (!project.jsonUrl?.trim()) {
                    throw new Error("This project does not have a valid JSON download URL.");
                }
                const response = await fetch(project.jsonUrl.trim(), { method: "GET", cache: "no-store" });
                if (!response.ok) {
                    throw new Error(`Failed to download project data (HTTP ${response.status}).`);
                }
                projectData = await response.json();
            }
            await downloadAdminCostBreakdownPDF(projectData, project.projectName, project.projectId);
        } catch (error) {
            console.error("Failed to generate admin cost breakdown PDF:", error);
            setPdfError(error instanceof Error ? error.message : "Failed to generate the cost breakdown PDF.");
        } finally {
            setGeneratingPdf(false);
        }
    }

    async function handleSaveDeadline() {
        if (savingDeadline) return;
        setDeadlineError("");
        setDeadlineSaved(false);

        // Recheck the local date at save time, not only in the picker.
        if (!isValidProjectDeadline(deadline) || deadline.slice(0, 10) <= getTodayLocalDate()) {
            setDeadlineError("Choose a deadline after today. Deadlines cannot be cleared.");
            return;
        }

        setSavingDeadline(true);
        try {
            await updateProjectDeadline(project.projectId, deadline, deadlineReason.trim());
            onDeadlineSaved?.(project.projectId, deadline);
            setDeadlineReason("");
            setEditingDeadline(false);
            setDeadlineSaved(true);
            try {
                setActivities(await getAdminProjectActivity(project.projectId));
            } catch (activityErr) {
                console.error("Deadline saved, but activity could not be refreshed:", activityErr);
            }
        } catch (error) {
            console.error("Failed to save project deadline:", error);
            setDeadlineError(error instanceof Error ? error.message : "Failed to save the deadline. Please try again.");
        } finally {
            setSavingDeadline(false);
        }
    }

    async function handleReview(action: "approve" | "request-revision") {
        if (reviewing) return;
        if (
            action === "approve" &&
            !window.confirm("Approve this submitted design as a reference for professional development? This does not authorize construction.")
        ) return;

        setReviewing(true);
        setReviewError("");
        try {
            await reviewAdminProject(project.projectId, action, reviewReason.trim());
            onProjectReviewed?.(
                project.projectId,
                action === "approve" ? "approved" : "revision-requested"
            );
            onClose();
        } catch (error) {
            setReviewError(error instanceof Error ? error.message : "Unable to update project review.");
        } finally {
            setReviewing(false);
        }
    }

    // The one "open the design" button, labelled by what it will open.
    const viewDesign = isSubmitted
        ? { label: `View submitted design (v${project.submittedVersionNumber ?? "legacy"})`, snapshot: "submitted" as const }
        : isApproved
            ? { label: "View approved design", snapshot: "approved" as const }
            : isAdminManaged
                ? { label: "View latest saved design", snapshot: undefined }
                : null;

    return (
        <div className="grid min-h-0 flex-1 md:grid-cols-[1.3fr_1fr]">
            {/* LEFT: preview + open design */}
            <div className="flex min-h-0 flex-col gap-4 border-b border-border/60 bg-muted/10 p-6 md:border-b-0 md:border-r">
                <div className="flex min-h-48 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background">
                    {hasThumbnail ? (
                        <img
                            src={project.thumbnailUrl}
                            alt={`${project.projectName} preview`}
                            onError={() => setImgError(true)}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <FolderOpen size={32} className="mx-auto mb-2" />
                            <p className="text-sm">No preview available</p>
                        </div>
                    )}
                </div>

                {viewDesign && (
                    <Button
                        type="button"
                        size="lg"
                        className="w-full"
                        onClick={() => onReviewClientDesign(project, viewDesign.snapshot)}
                    >
                        <Eye size={16} />
                        {viewDesign.label}
                    </Button>
                )}
            </div>

            {/* RIGHT: details */}
            <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-6 pr-12 md:p-8 md:pr-12">
                {/* Title + status */}
                <header>
                    <Badge variant="outline" className="mb-2 capitalize">
                        {status.replaceAll("-", " ")}
                    </Badge>
                    <h2 className="break-words text-2xl font-semibold">{project.projectName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {project.ownerName || "Unknown user"} · Updated {formatProjectDate(project.updatedAt)}
                    </p>
                    {isApproved && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            Approved {formatProjectDate(project.approvedAt)} by{" "}
                            {project.approvedByName || project.approvedBy || "Admin"}
                        </p>
                    )}
                </header>

                {/* Review (only when something needs a decision) */}
                {isSubmitted && (
                    <section className="space-y-3 rounded-lg border border-border/60 p-4">
                        <h3 className="text-sm font-medium">Review this submission</h3>
                        <label className="grid gap-1 text-xs text-muted-foreground">
                            Feedback (required only if you request changes)
                            <textarea
                                value={reviewReason}
                                onChange={event => setReviewReason(event.target.value)}
                                maxLength={2000}
                                rows={3}
                                placeholder="What should the client change?"
                                className="rounded-md border border-input bg-background p-2 text-sm text-foreground"
                            />
                        </label>
                        {reviewError && (
                            <p role="alert" className="text-xs text-destructive">{reviewError}</p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => void handleReview("request-revision")}
                                disabled={reviewing || !reviewReason.trim()}
                            >
                                Request changes
                            </Button>
                            <Button
                                type="button"
                                className="flex-1"
                                onClick={() => void handleReview("approve")}
                                disabled={reviewing}
                            >
                                Approve
                            </Button>
                        </div>
                    </section>
                )}

                {/* Key facts */}
                <dl className="space-y-5">
                    <div>
                        <dt className="text-xs text-muted-foreground">Estimated cost</dt>
                        <dd className="mt-1 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-lg font-medium">{formatCost(project)}</span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadPdf}
                                disabled={generatingPdf}
                            >
                                <Download size={14} />
                                {generatingPdf ? "Generating..." : "Cost breakdown PDF"}
                            </Button>
                        </dd>
                        {pdfError && (
                            <p className="mt-2 text-xs text-destructive" role="alert">{pdfError}</p>
                        )}
                    </div>

                    <div>
                        <dt className="text-xs text-muted-foreground">Deadline (Philippine time)</dt>
                        <dd className="mt-1">
                            {!editingDeadline ? (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-base font-medium">
                                        {project.deadline ? formatProjectDate(project.deadline) : "Not set"}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setDeadlineSaved(false);
                                            setEditingDeadline(true);
                                        }}
                                    >
                                        {project.deadline ? "Change" : "Set deadline"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        id="project-deadline"
                                        type="datetime-local"
                                        aria-label="Project deadline"
                                        value={deadline}
                                        min={getTomorrowLocalDateTime()}
                                        onChange={event => {
                                            setDeadline(event.target.value);
                                            setDeadlineError("");
                                        }}
                                        disabled={savingDeadline}
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                    />
                                    <input
                                        value={deadlineReason}
                                        onChange={event => setDeadlineReason(event.target.value)}
                                        maxLength={1000}
                                        placeholder="Reason for change (optional)"
                                        aria-label="Reason for deadline change"
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleSaveDeadline}
                                            disabled={savingDeadline || !deadline || !isValidProjectDeadline(deadline)}
                                        >
                                            <Save size={14} />
                                            {savingDeadline ? "Saving..." : "Save"}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingDeadline(false);
                                                setDeadline(normalizeProjectDeadlineForInput(project.deadline));
                                                setDeadlineError("");
                                            }}
                                            disabled={savingDeadline}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {deadlineSaved && (
                                <p className="mt-2 text-xs text-green-600" role="status">Deadline saved.</p>
                            )}
                            {deadlineError && (
                                <p className="mt-2 text-xs text-destructive" role="alert">{deadlineError}</p>
                            )}
                        </dd>
                    </div>
                </dl>

                <ActivityTimeline activities={activities} error={activityError} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------
const INITIAL_ACTIVITY_COUNT = 3;

const ACTION_LABELS: Record<string, string> = {
    "deadline-updated": "Deadline changed",
    "deadline-changed": "Deadline changed",
    "deadline-set": "Deadline set",
    "approve": "Design approved",
    "approved": "Design approved",
    "request-revision": "Changes requested",
    "revision-requested": "Changes requested",
    "submitted": "Design submitted",
    "submit": "Design submitted",
    "created": "Project created",
    "assigned": "Project assigned"
};

function actionLabel(action: string): string {
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    const text = action.replaceAll("-", " ").replaceAll("_", " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function toMillis(value: unknown): number {
    if (!value) return 0;
    if (typeof value === "object" && value !== null) {
        const v = value as { toMillis?: () => number; toDate?: () => Date };
        if (typeof v.toMillis === "function") return v.toMillis();
        if (typeof v.toDate === "function") return v.toDate().getTime();
        if (value instanceof Date) return value.getTime();
    }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const ms = new Date(value).getTime();
        if (!Number.isNaN(ms)) return ms;
    }
    return 0;
}

function formatWhen(value: unknown): string {
    const ms = toMillis(value);
    if (!ms) return "Unknown time";
    const diff = Date.now() - ms;
    const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
    if (diff < MIN) return "Just now";
    if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)} hr ago`;
    if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} day${Math.floor(diff / DAY) > 1 ? "s" : ""} ago`;
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatFullWhen(value: unknown): string {
    const ms = toMillis(value);
    return ms
        ? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : "Unknown time";
}

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/;

function isSimpleValue(value: unknown): boolean {
    return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function formatActivityValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "none";
    if (typeof value === "string" && ISO_LIKE.test(value)) {
        // Deadlines are stored as Philippine local time without an offset.
        const date = new Date(value.length > 10 && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}+08:00` : value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: value.length > 10 ? "short" : undefined,
                timeZone: "Asia/Manila"
            });
        }
    }
    if (typeof value !== "object") return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return "value unavailable";
    }
}

function ActivityTimeline({
    activities,
    error
}: {
    activities: Activity;
    error: string;
}) {
    const [showAll, setShowAll] = useState(false);

    // Newest first.
    const sorted = [...activities].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    const visible = showAll ? sorted : sorted.slice(0, INITIAL_ACTIVITY_COUNT);
    const hiddenCount = sorted.length - visible.length;

    return (
        <details className="group border-t border-border/60 pt-4">
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between text-sm font-medium text-muted-foreground">
                Recent activity{sorted.length ? ` (${sorted.length})` : ""}
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>

            {error ? (
                <p className="text-xs text-destructive">{error}</p>
            ) : sorted.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing has happened on this project yet.</p>
            ) : (
                <>
                    <ol className="relative space-y-4 border-l border-border/60 pl-5">
                        {visible.map(activity => {
                            // Only show simple before/after values (e.g. dates).
                            // Technical objects such as submission IDs are hidden.
                            const prev = isSimpleValue(activity.previousValue) ? activity.previousValue : undefined;
                            const next = isSimpleValue(activity.newValue) ? activity.newValue : undefined;
                            const hasChange = prev !== undefined || next !== undefined;
                            return (
                                <li key={activity.id} className="relative">
                                    <span
                                        aria-hidden="true"
                                        className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/40"
                                    />
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                        <p className="text-sm font-medium text-muted-foreground">{actionLabel(activity.action)}</p>
                                        <time
                                            className="text-xs text-muted-foreground"
                                            title={formatFullWhen(activity.createdAt)}
                                        >
                                            {formatWhen(activity.createdAt)}
                                        </time>
                                    </div>
                                    {activity.actorName ? (
                                        <p className="text-xs text-muted-foreground">
                                            by {activity.actorName}
                                        </p>
                                    ) : null}
                                    {activity.description ? (
                                        <p className="mt-1 text-xs text-muted-foreground/80">{activity.description}</p>
                                    ) : null}
                                    {hasChange && (
                                        <p className="mt-1 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground/80">
                                            {prev !== undefined && (
                                                <span>{formatActivityValue(prev)}</span>
                                            )}
                                            {prev !== undefined && next !== undefined && (
                                                <span className="mx-1.5">→</span>
                                            )}
                                            {next !== undefined && (
                                                <span className="font-medium">
                                                    {formatActivityValue(next)}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ol>

                    {(hiddenCount > 0 || showAll) && sorted.length > INITIAL_ACTIVITY_COUNT && (
                        <button
                            type="button"
                            onClick={() => setShowAll(current => !current)}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            {showAll ? "Show less" : `Show ${hiddenCount} older`}
                            <ChevronDown
                                size={14}
                                className={showAll ? "rotate-180" : ""}
                            />
                        </button>
                    )}
                </>
            )}
        </details>
    );
}