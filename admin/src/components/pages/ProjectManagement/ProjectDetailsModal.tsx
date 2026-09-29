import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FolderOpen, User, CalendarDays, Clock, PhilippinePeso, FileJson } from "lucide-react";
import type { AdminProject } from "./ProjectManagement";
import { formatCost, formatProjectDate } from "./ProjectManagement";

interface ProjectDetailsModalProps {
    project: AdminProject | null;
    onOpenChange: (open: boolean) => void;
    onOpenProject: (project: AdminProject) => void;
}

export default function ProjectDetailsModal({ project, onOpenChange, onOpenProject }: ProjectDetailsModalProps) {
    return (
        <Dialog open={project !== null} onOpenChange={(open) => { if (!open) onOpenChange(false); }}>
            <DialogContent className="flex h-[90vh] max-h-[90vh] w-[95vw] max-w-[1400px] sm:max-w-[1400px] flex-col gap-0 overflow-hidden p-0">
                {project && (
                    <div className="flex h-full min-h-0 flex-col">
                        <DialogHeader className="shrink-0 border-b border-border/60 px-10 py-7">
                            <DialogTitle className="text-2xl">{project.projectName}</DialogTitle>
                            <DialogDescription className="text-sm">Project information and saved project data.</DialogDescription>
                        </DialogHeader>

                        <div className="grid min-h-0 flex-1 md:grid-cols-[1.4fr_1fr]">
                            {/* Preview panel */}
                            <div className="min-h-0 border-b border-border/60 bg-muted/10 p-10 md:border-b-0 md:border-r">
                                <div className="flex h-full min-h-0 flex-col">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-base font-medium">Project Preview</p>
                                            <p className="mt-1 text-sm text-muted-foreground">Saved project scene</p>
                                        </div>
                                        <Badge variant="secondary" className="text-sm">3D</Badge>
                                    </div>

                                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background">
                                        <div className="text-center">
                                            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-border/60 bg-muted/40">
                                                <FolderOpen size={32} className="text-muted-foreground" />
                                            </div>
                                            <p className="text-lg font-medium">Project Preview</p>
                                            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                                                The saved project can be opened to view its complete 3D scene.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Details panel */}
                            <div className="min-h-0 overflow-y-auto">
                                <div className="flex h-full flex-col p-10">
                                    <div className="mb-8">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Project Information
                                        </p>
                                        <h2 className="mt-2 text-2xl font-semibold">{project.projectName}</h2>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-border/60 p-5">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <User size={16} />
                                                <p className="text-xs">Created by</p>
                                            </div>
                                            <p className="mt-3 break-words text-base font-medium">{project.ownerName}</p>
                                            <p className="mt-1 break-all text-xs text-muted-foreground">{project.ownerId}</p>
                                        </div>

                                        <div className="rounded-2xl border border-border/60 p-5">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <CalendarDays size={16} />
                                                <p className="text-xs">Created</p>
                                            </div>
                                            <p className="mt-3 text-base font-medium">{formatProjectDate(project.createdAt)}</p>
                                        </div>

                                        <div className="rounded-2xl border border-border/60 p-5">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Clock size={16} />
                                                <p className="text-xs">Last Updated</p>
                                            </div>
                                            <p className="mt-3 text-base font-medium">{formatProjectDate(project.updatedAt)}</p>
                                        </div>

                                        <div className="rounded-2xl border border-border/60 p-5">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <PhilippinePeso size={16} />
                                                <p className="text-xs">Estimated Cost</p>
                                            </div>
                                            <p className="mt-3 text-base font-medium">{formatCost(project)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 rounded-2xl border border-border/60 p-6">
                                        <div className="flex items-center gap-2">
                                            <FileJson size={18} className="text-muted-foreground" />
                                            <p className="text-sm font-medium">Project File</p>
                                        </div>

                                        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Schema Version</p>
                                                <p className="mt-1.5 text-sm font-medium">v{project.schemaVersion}</p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-muted-foreground">Storage Path</p>
                                                <p className="mt-1.5 break-all text-sm font-medium">{project.jsonPath || "Not available"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-8">
                                        <Button className="w-full" size="lg" onClick={() => onOpenProject(project)}>
                                            <ExternalLink size={16} />
                                            Open Project
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}