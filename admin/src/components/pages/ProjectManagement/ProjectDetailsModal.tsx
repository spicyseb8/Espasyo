
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
    ExternalLink,
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
    getTodayLocalDate,
    updateProjectDeadline
} from "../../../services/assets/projectService";

import {
    downloadAdminCostBreakdownPDF
} from "../../project-loader/engine/cost/AdminCostBreakdownPDF";

interface ProjectDetailsModalProps {
    project: AdminProject | null;
    onOpenChange: (open: boolean) => void;
    onOpenProject: (project: AdminProject) => void;

    // Allows the parent project list to update immediately after saving.
    onDeadlineSaved?: (
        projectId: string,
        deadline: string | null
    ) => void;
}

export default function ProjectDetailsModal({
    project,
    onOpenChange,
    onOpenProject,
    onDeadlineSaved
}: ProjectDetailsModalProps) {
    const [generatingPdf, setGeneratingPdf] =
        useState(false);

    const [pdfError, setPdfError] =
        useState("");

    const [deadline, setDeadline] =
        useState("");

    const [savingDeadline, setSavingDeadline] =
        useState(false);

    const [deadlineMessage, setDeadlineMessage] =
        useState("");

    const [deadlineError, setDeadlineError] =
        useState("");

    // Load the stored deadline whenever a different project is opened.
    useEffect(() => {
        setDeadline(project?.deadline ?? "");
        setDeadlineMessage("");
        setDeadlineError("");
    }, [
        project?.projectId,
        project?.deadline
    ]);

    function handleDialogChange(open: boolean) {
        if (!open) {
            onOpenChange(false);
            setPdfError("");
            setDeadlineMessage("");
            setDeadlineError("");
        }
    }

    async function handleDownloadPdf() {
        if (!project || generatingPdf) {
            return;
        }

        setGeneratingPdf(true);
        setPdfError("");

        try {
            if (!project.jsonUrl?.trim()) {
                throw new Error(
                    "This project does not have a valid JSON download URL."
                );
            }

            const response = await fetch(
                project.jsonUrl.trim(),
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to download project data (HTTP ${response.status}).`
                );
            }

            const projectData: unknown =
                await response.json();

            downloadAdminCostBreakdownPDF(
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

        if (deadline && deadline < today) {
            setDeadlineError(
                "Past dates are not allowed. Please choose today or a future date."
            );
            return;
        }

        setSavingDeadline(true);

        try {
            const savedDeadline = deadline || null;

            await updateProjectDeadline(
                project.projectId,
                savedDeadline
            );

            onDeadlineSaved?.(
                project.projectId,
                savedDeadline
            );

            setDeadlineMessage(
                savedDeadline
                    ? "Deadline saved successfully."
                    : "Deadline removed successfully."
            );
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
                                                type="date"
                                                value={deadline}
                                                min={getTodayLocalDate()}
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
                                                Select today or a future date.
                                            </p>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleSaveDeadline}
                                                    disabled={
                                                        savingDeadline ||
                                                        Boolean(
                                                            deadline &&
                                                            deadline < getTodayLocalDate()
                                                        )
                                                    }
                                                >
                                                    <Save size={14} />

                                                    {savingDeadline
                                                        ? "Saving..."
                                                        : "Save Deadline"}
                                                </Button>

                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setDeadline("");
                                                        setDeadlineMessage("");
                                                        setDeadlineError("");
                                                    }}
                                                    disabled={
                                                        savingDeadline ||
                                                        !deadline
                                                    }
                                                >
                                                    Clear
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

                                <div className="mt-auto pt-8">
                                    <Button
                                        className="w-full"
                                        size="lg"
                                        onClick={() => onOpenProject(project)}
                                    >
                                        <ExternalLink size={16} />
                                        Open Project
                                    </Button>
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
