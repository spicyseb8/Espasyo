import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, FolderOpen, User, CalendarDays, Clock, PhilippinePeso } from "lucide-react";
import type { AdminProject } from "../../../services/assets/projectService";
import { formatCost, formatProjectDate } from "./ProjectManagement";

interface ProjectDetailsModalProps {
    project: AdminProject | null;
    onOpenChange: (open: boolean) => void;
    onOpenProject: (project: AdminProject) => void;
}

export default function ProjectDetailsModal({ project, onOpenChange, onOpenProject }: ProjectDetailsModalProps) {
    return (
        <Dialog open={project !== null} onOpenChange={(open) => { if (!open) onOpenChange(false); }}>
            <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-[1200px] sm:max-w-[1200px] flex-col gap-0 overflow-hidden p-0">
                {/* Required for accessibility, visually hidden */}
                <DialogTitle className="sr-only">{project?.projectName ?? "Project details"}</DialogTitle>
                <DialogDescription className="sr-only">Project information and preview.</DialogDescription>

                {project && (
                    <>
                        {/* Slim top bar: empty, the dialog's default close (X) sits at the top right */}
                        <div className="h-12 shrink-0 border-b border-border/60" />

                        <div className="grid min-h-0 flex-1 md:grid-cols-[1.6fr_1fr]">
                            {/* Left: preview only */}
                            <div className="min-h-0 border-b border-border/60 bg-muted/10 p-6 md:border-b-0 md:border-r">
                                <div className="flex h-full items-center justify-center rounded-2xl border border-border/60 bg-background">
                                    <div className="text-center">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border/60 bg-muted/40">
                                            <FolderOpen size={28} className="text-muted-foreground" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">3D preview</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: essential info */}
                            <div className="flex min-h-0 flex-col overflow-y-auto p-8">
                                <h2 className="break-words text-2xl font-semibold">{project.projectName}</h2>

                                <dl className="mt-8 space-y-6">
                                    <InfoRow icon={<User size={16} />} label="Created by" value={project.ownerName} />
                                    <InfoRow icon={<CalendarDays size={16} />} label="Created" value={formatProjectDate(project.createdAt)} />
                                    <InfoRow icon={<Clock size={16} />} label="Last updated" value={formatProjectDate(project.updatedAt)} />
                                    <InfoRow icon={<PhilippinePeso size={16} />} label="Estimated cost" value={formatCost(project)} />
                                </dl>

                                <div className="mt-auto pt-8">
                                    <Button className="w-full" size="lg" onClick={() => onOpenProject(project)}>
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 text-muted-foreground">{icon}</div>
            <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 break-words text-base font-medium">{value}</dd>
            </div>
        </div>
    );
}