import {
    useEffect,
    useState
} from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle
} from "@/components/ui/dialog";

import {
    Button
} from "@/components/ui/button";

import {
    FolderOpen,
    User,
    CalendarDays,
    Clock,
    PhilippinePeso,
    Download,
    Save
} from "lucide-react";

import type {
    AdminProject
} from "../../../services/assets/projectService";

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
    setAdminProjectPublicVisibility,
    updateProjectDeadline
} from "../../../services/assets/projectService";

import {
    downloadAdminCostBreakdownPDF
} from "../../project-loader/engine/cost/AdminCostBreakdownPDF";
import {
    loadAdminManagedProjectForReview
} from "@/services/assets/managedInteriorReview";

interface ProjectDetailsModalProps {
    project: AdminProject | null;
    onOpenChange: (open: boolean) => void;
    onReviewClientDesign: (project: AdminProject, snapshot?: "submitted" | "approved") => void;
    onProjectReviewed?: (projectId: string, status: string) => void;
    onPublicVisibilityChanged?: (projectId: string, isPublic: boolean) => void;

    // Allows the parent project list to update immediately after saving.
    onDeadlineSaved?: (
        projectId: string,
        deadline: string
    ) => void;
}

export default function ProjectDetailsModal({
    project,
    onOpenChange,
    onReviewClientDesign,
    onDeadlineSaved,
    onProjectReviewed,
    onPublicVisibilityChanged
}: ProjectDetailsModalProps) {
    const [generatingPdf, setGeneratingPdf] =
        useState(false);

    const [pdfError, setPdfError] =
        useState("");

    const [deadlineReason, setDeadlineReason] =
        useState("");

    const [deadlineInput, setDeadlineInput] = useState({
        projectId: project?.projectId ?? null,
        value: normalizeProjectDeadlineForInput(project?.deadline)
    });
    const deadline = project && deadlineInput.projectId === project.projectId
        ? deadlineInput.value
        : normalizeProjectDeadlineForInput(project?.deadline);
    function setDeadline(value: string) {
        setDeadlineInput({
            projectId: project?.projectId ?? null,
            value
        });
    }

    const [savingDeadline, setSavingDeadline] =
        useState(false);

    const [deadlineFeedback, setDeadlineFeedback] = useState({
        projectId: project?.projectId ?? null,
        message: "",
        error: ""
    });
    const deadlineMessage = project && deadlineFeedback.projectId === project.projectId
        ? deadlineFeedback.message
        : "";
    const deadlineError = project && deadlineFeedback.projectId === project.projectId
        ? deadlineFeedback.error
        : "";
    function setDeadlineMessage(message: string) {
        setDeadlineFeedback(current => ({
            projectId: project?.projectId ?? null,
            message,
            error: current.projectId === project?.projectId ? current.error : ""
        }));
    }
    function setDeadlineError(error: string) {
        setDeadlineFeedback(current => ({
            projectId: project?.projectId ?? null,
            message: current.projectId === project?.projectId ? current.message : "",
            error
        }));
    }
    const [reviewReason, setReviewReason] = useState("");
    const [reviewError, setReviewError] = useState("");
    const [reviewing, setReviewing] = useState(false);
    const [savingVisibility, setSavingVisibility] = useState(false);
    const [visibilityError, setVisibilityError] = useState("");
    const [activityState, setActivityState] = useState<{
        projectId: string | null;
        activities: Awaited<ReturnType<typeof getAdminProjectActivity>>;
    }>({
        projectId: project?.projectId ?? null,
        activities: []
    });
    const activities = project && activityState.projectId === project.projectId
        ? activityState.activities
        : [];

    useEffect(() => {
        let active = true;
        const projectId = project?.projectId;
        if (!projectId) return;
        getAdminProjectActivity(projectId)
            .then(result => {
                if (active) setActivityState({ projectId, activities: result });
            })
            .catch(error => {
                console.error("Failed to load project activity:", error);
                if (active) setReviewError("Project activity could not be loaded.");
            });
        return () => {
            active = false;
        };
    }, [project?.projectId]);

    function handleDialogChange(open: boolean) {
        if (!open) {
            onOpenChange(false);
            setPdfError("");
            setDeadlineMessage("");
            setDeadlineError("");
            setDeadlineReason("");
            setReviewReason("");
            setReviewError("");
        }
    }

    async function handleDownloadPdf() {
        if (!project || generatingPdf) {
            return;
        }

        setGeneratingPdf(true);
        setPdfError("");

        try {
            let projectData: unknown;
            if (project.workflowType === "admin-managed") {
                const latestMetadata = await getAdminProject(project.projectId);
                projectData = await loadAdminManagedProjectForReview(latestMetadata);
            } else {
                if (!project.jsonUrl?.trim()) {
                    throw new Error(
                        "This project does not have a valid JSON download URL."
                    );
                }

                const response = await fetch(project.jsonUrl.trim(), {
                    method: "GET",
                    cache: "no-store"
                });
                if (!response.ok) {
                    throw new Error(
                        `Failed to download project data (HTTP ${response.status}).`
                    );
                }
                projectData = await response.json();
            }

            await downloadAdminCostBreakdownPDF(
                projectData,
                project.projectName,
                project.projectId
            );
        } catch (error) {
            console.error(
                "Failed to generate admin cost breakdown PDF:",
                error
            );

            setPdfError(
                error instanceof Error
                    ? error.message
                    : "Failed to generate the cost breakdown PDF."
            );
        } finally {
            setGeneratingPdf(false);
        }
    }

    async function handleSaveDeadline() {
        if (!project || savingDeadline) {
            return;
        }

        setDeadlineMessage("");
        setDeadlineError("");

        // Recheck the local date at save time, not only in the picker.
        const today = getTodayLocalDate();

        if (!isValidProjectDeadline(deadline) || deadline.slice(0, 10) <= today) {
            setDeadlineError(
                "Choose a deadline after today. Deadlines cannot be cleared."
            );
            return;
        }

        setSavingDeadline(true);

        try {
            const savedDeadline = deadline;

            await updateProjectDeadline(
                project.projectId,
                savedDeadline,
                deadlineReason.trim()
            );

            onDeadlineSaved?.(
                project.projectId,
                savedDeadline
            );

            setDeadlineMessage("Deadline saved successfully.");
            setDeadlineReason("");
            try {
                setActivityState({
                    projectId: project.projectId,
                    activities: await getAdminProjectActivity(project.projectId)
                });
            } catch (activityError) {
                console.error("Deadline was saved, but project activity could not be refreshed:", activityError);
            }
        } catch (error) {
            console.error(
                "Failed to save project deadline:",
                error
            );

            setDeadlineError(
                error instanceof Error
                    ? error.message
                    : "Failed to save the deadline. Please try again."
            );
        } finally {
            setSavingDeadline(false);
        }
    }

    async function handleReview(action: "approve" | "request-revision") {
        if (!project || reviewing) return;
        if (action === "approve" && !window.confirm("Approve this submitted design as a reference for professional development? This does not authorize construction.")) return;
        setReviewing(true);
        setReviewError("");
        try {
            await reviewAdminProject(project.projectId, action, reviewReason.trim());
            const nextStatus = action === "approve" ? "approved" : "revision-requested";
            onProjectReviewed?.(project.projectId, nextStatus);
            setReviewReason("");
            onOpenChange(false);
        } catch (error) {
            setReviewError(error instanceof Error ? error.message : "Unable to update project review.");
        } finally {
            setReviewing(false);
        }
    }

    async function handlePublicVisibilityChange(isPublic: boolean) {
        if (!project || savingVisibility) return;
        setSavingVisibility(true);
        setVisibilityError("");
        try {
            const result = await setAdminProjectPublicVisibility(
                project.projectId,
                isPublic
            );
            onPublicVisibilityChanged?.(project.projectId, result.isPublic);
        } catch (error) {
            console.error("Failed to update project public visibility:", error);
            setVisibilityError(error instanceof Error
                ? error.message
                : "Unable to update project visibility.");
        } finally {
            setSavingVisibility(false);
        }
    }

    return (
        <Dialog
            open={project !== null}
            onOpenChange={handleDialogChange}
        >
            <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px]">
                <DialogTitle className="sr-only">
                    {project?.projectName ?? "Project details"}
                </DialogTitle>

                <DialogDescription className="sr-only">
                    Project information, deadline settings, and preview.
                </DialogDescription>

                {project && (
                    <>
                        <div className="h-12 shrink-0 border-b border-border/60" />

                        <div className="grid min-h-0 flex-1 md:grid-cols-[1.6fr_1fr]">
                            <div className="min-h-0 border-b border-border/60 bg-muted/10 p-6 md:border-b-0 md:border-r">
                                <div className="flex h-full items-center justify-center rounded-2xl border border-border/60 bg-background">
                                    <div className="text-center">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border/60 bg-muted/40">
                                            <FolderOpen
                                                size={28}
                                                className="text-muted-foreground"
                                            />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            3D preview
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex min-h-0 flex-col overflow-y-auto p-8">
                                <h2 className="break-words text-2xl font-semibold">
                                    {project.projectName}
                                </h2>

                                <dl className="mt-8 space-y-6">
                                    <InfoRow
                                        icon={<User size={16} />}
                                        label="Created by"
                                        value={project.ownerName || "Unknown User"}
                                    />

                                    <InfoRow
                                        icon={<CalendarDays size={16} />}
                                        label="Created"
                                        value={formatProjectDate(project.createdAt)}
                                    />

                                    <InfoRow
                                        icon={<Clock size={16} />}
                                        label="Last updated"
                                        value={formatProjectDate(project.updatedAt)}
                                    />
                                    <InfoRow
                                        icon={<FolderOpen size={16} />}
                                        label="Workflow status"
                                        value={project.projectStatus?.replaceAll("-", " ") || "Ongoing"}
                                    />
                                    {project.projectStatus === "submitted" && (
                                        <InfoRow
                                            icon={<Clock size={16} />}
                                            label="Submitted"
                                            value={`${formatProjectDate(project.submittedAt)} · Version ${project.submittedVersionNumber ?? "legacy"}`}
                                        />
                                    )}
                                    {["submitted", "approved"].includes(project.projectStatus ?? "") && (
                                        <InfoRow
                                            icon={<Clock size={16} />}
                                            label="Public sharing consent"
                                            value={project.publicConsent === true
                                                ? `Granted · ${project.publicConsentAt
                                                    ? formatProjectDate(project.publicConsentAt)
                                                    : "date unavailable"}`
                                                : "No consent"}
                                        />
                                    )}
                                    {project.workflowType === "admin-managed" && (
                                        <InfoRow
                                            icon={<Save size={16} />}
                                            label="Last saved design"
                                            value={project.currentDesignVersionNumber
                                                ? `Version ${project.currentDesignVersionNumber}`
                                                : project.clientDesignStarted
                                                    ? "Legacy version"
                                                    : "No client design saved"}
                                        />
                                    )}
                                    {project.projectStatus === "approved" && (
                                        <InfoRow
                                            icon={<Clock size={16} />}
                                            label="Approved"
                                            value={`${formatProjectDate(project.approvedAt)} · ${project.approvedByName || project.approvedBy || "Admin"} · Version ${project.approvedVersionNumber ?? "legacy"}`}
                                        />
                                    )}

                                    {/* Deadline picker */}
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 text-muted-foreground">
                                            <CalendarDays size={16} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <label
                                                htmlFor="project-deadline"
                                                className="text-xs text-muted-foreground"
                                            >
                                                Project deadline
                                            </label>

                                            <input
                                                id="project-deadline"
                                                type="datetime-local"
                                                value={deadline}
                                                min={getTomorrowLocalDateTime()}
                                                onChange={event => {
                                                    setDeadline(
                                                        event.target.value
                                                    );
                                                    setDeadlineMessage("");
                                                    setDeadlineError("");
                                                }}
                                                disabled={savingDeadline}
                                                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            />

                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Select a future date and time in Philippine time. Deadline changes are recorded in project activity.
                                            </p>
                                            <input
                                                value={deadlineReason}
                                                onChange={event => setDeadlineReason(event.target.value)}
                                                maxLength={1000}
                                                placeholder="Reason for change (optional)"
                                                aria-label="Reason for deadline change"
                                                className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                                            />

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleSaveDeadline}
                                                    disabled={
                                                        savingDeadline ||
                                                        !deadline ||
                                                        !isValidProjectDeadline(deadline)
                                                    }
                                                >
                                                    <Save size={14} />

                                                    {savingDeadline
                                                        ? "Saving..."
                                                        : "Save Deadline"}
                                                </Button>

                                            </div>

                                            {deadlineMessage && (
                                                <p
                                                    className="mt-2 text-xs text-green-600"
                                                    role="status"
                                                >
                                                    {deadlineMessage}
                                                </p>
                                            )}

                                            {deadlineError && (
                                                <p
                                                    className="mt-2 text-xs text-destructive"
                                                    role="alert"
                                                >
                                                    {deadlineError}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 text-muted-foreground">
                                            <PhilippinePeso size={16} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <dt className="text-xs text-muted-foreground">
                                                Estimated cost
                                            </dt>

                                            <dd className="mt-1 flex flex-wrap items-center justify-between gap-3">
                                                <span className="break-words text-base font-medium">
                                                    {formatCost(project)}
                                                </span>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0"
                                                    onClick={handleDownloadPdf}
                                                    disabled={generatingPdf}
                                                >
                                                    <Download size={15} />

                                                    {generatingPdf
                                                        ? "Generating..."
                                                        : "Download PDF"}
                                                </Button>
                                            </dd>

                                            {pdfError && (
                                                <p
                                                    className="mt-2 text-xs text-destructive"
                                                    role="alert"
                                                >
                                                    {pdfError}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </dl>

                                {project.projectStatus === "submitted" && (
                                    <div className="mt-5 space-y-3 rounded-lg border border-border/60 p-3">
                                        <Button type="button" className="w-full" variant="outline" onClick={() => onReviewClientDesign(project, "submitted")}>
                                            Inspect submitted snapshot · v{project.submittedVersionNumber ?? "legacy"}
                                        </Button>
                                        <label className="grid gap-1 text-xs text-muted-foreground">
                                            Revision feedback (required to request changes)
                                            <textarea
                                                value={reviewReason}
                                                onChange={event => setReviewReason(event.target.value)}
                                                maxLength={2000}
                                                rows={3}
                                                className="rounded-md border border-input bg-background p-2 text-sm text-foreground"
                                            />
                                        </label>
                                        {reviewError && <p role="alert" className="text-xs text-destructive">{reviewError}</p>}
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" className="flex-1" onClick={() => void handleReview("request-revision")} disabled={reviewing || !reviewReason.trim()}>
                                                Request Revision
                                            </Button>
                                            <Button type="button" className="flex-1" onClick={() => void handleReview("approve")} disabled={reviewing}>
                                                Approve
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {project.projectStatus === "approved" && (
                                    <>
                                        <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => onReviewClientDesign(project, "approved")}>
                                            Inspect approved snapshot
                                        </Button>
                                        <section className="mt-5 rounded-lg border border-border/60 p-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <h3 className="text-sm font-medium">Public visibility</h3>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {project.publicConsent === true
                                                            ? "Only consented approved designs can be made public."
                                                            : "Client consent is required before this project can be public."}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={project.isPublic === true}
                                                    aria-label="Make approved project public"
                                                    onClick={() => void handlePublicVisibilityChange(project.isPublic !== true)}
                                                    disabled={savingVisibility || (
                                                        project.isPublic !== true &&
                                                        project.publicConsent !== true
                                                    )}
                                                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                                        project.isPublic === true ? "bg-green-600" : "bg-muted"
                                                    }`}
                                                >
                                                    <span
                                                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                                            project.isPublic === true ? "translate-x-5" : "translate-x-0.5"
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                            <p className="mt-2 text-xs font-medium">
                                                {savingVisibility
                                                    ? "Updating visibility..."
                                                    : project.isPublic === true
                                                        ? "Public"
                                                        : "Private"}
                                            </p>
                                            {visibilityError && (
                                                <p role="alert" className="mt-2 text-xs text-destructive">
                                                    {visibilityError}
                                                </p>
                                            )}
                                        </section>
                                    </>
                                )}
                                <section className="mt-5 space-y-2 border-t border-border/60 pt-4">
                                    <h3 className="text-sm font-medium">Project activity</h3>
                                    {activities.length ? (
                                        <ul className="space-y-2 text-xs text-muted-foreground">
                                            {activities.map(activity => (
                                                <li key={activity.id}>
                                                    <span className="font-medium text-foreground">{activity.action.replaceAll("-", " ")}</span>
                                                    {" · "}{activity.actorName || activity.actorId}
                                                    {" · "}{formatProjectDate(activity.createdAt)}
                                                    {activity.description ? <p>{activity.description}</p> : null}
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
                                    ) : <p className="text-xs text-muted-foreground">No recorded activity yet.</p>}
                                </section>

                                <div className="mt-auto pt-8">
                                    {project.workflowType === "admin-managed" &&
                                        !["submitted", "approved"].includes(project.projectStatus ?? "") && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="mb-2 w-full"
                                            size="lg"
                                            onClick={() => onReviewClientDesign(project)}
                                        >
                                            Review Latest Saved Design
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function InfoRow({
    icon,
    label,
    value
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 text-muted-foreground">
                {icon}
            </div>

            <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                    {label}
                </dt>

                <dd className="mt-0.5 break-words text-base font-medium">
                    {value}
                </dd>
            </div>
        </div>
    );
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