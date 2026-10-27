import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "@/firebase/firebase";
import LoadingScreen from "@/components/LoadingScreen";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

import {
    Search,
    FolderOpen,
    Plus,
    User,
    ArrowDownAZ,
    ArrowUpAZ,
    LayoutGrid,
    List
} from "lucide-react";

import {
    getAdminClients,
    getAdminProjects,
    type AdminClient,
    type AdminProject
} from "../../../services/assets/projectService";

import ProjectDetailsModal from "./ProjectDetailsModal";


//==================================================
// SORT
//==================================================

type SortField =
    | "Project Name"
    | "Date Modified"
    | "Date Created"
    | "User";

type SortDirection = "asc" | "desc";

type ProjectView = "list" | "tiles";

const SORT_FIELDS: {
    value: SortField;
    label: string;
}[] = [
    { value: "Project Name", label: "Project Name" },
    { value: "Date Modified", label: "Date modified" },
    { value: "Date Created", label: "Date created" },
    { value: "User", label: "User" }
];


//==================================================
// DATE
//==================================================

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric"
};

export function formatProjectDate(value: unknown): string {

    if (!value) {
        return "Unknown";
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof (value as { toDate: unknown }).toDate === "function"
    ) {
        return (value as { toDate: () => Date })
            .toDate()
            .toLocaleDateString(undefined, DATE_FORMAT);
    }

    if (value instanceof Date) {
        return value.toLocaleDateString(undefined, DATE_FORMAT);
    }

    if (typeof value === "string") {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleDateString(undefined, DATE_FORMAT);
        }
    }

    return "Unknown";
}


//==================================================
// PROJECT TIME
//==================================================

function getProjectTime(value: unknown): number {

    if (!value) {
        return 0;
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "toMillis" in value &&
        typeof (value as { toMillis: unknown }).toMillis === "function"
    ) {
        return (value as { toMillis: () => number }).toMillis();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "string") {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date.getTime();
        }
    }

    return 0;
}


//==================================================
// COST
//==================================================

export function formatCost(project: AdminProject): string {

    const cost = project.totalCost ?? project.estimatedCost;

    if (typeof cost !== "number" || !Number.isFinite(cost)) {
        return "Not available";
    }

    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2
    }).format(cost);
}


//==================================================
// PREVIEW
//==================================================
//
// Shows project.thumbnailUrl when available,
// otherwise falls back to the folder icon.
//
//==================================================

function ProjectPreview({
    project,
    className,
    iconSize
}: {
    project: AdminProject;
    className: string;
    iconSize: number;
}) {

    return (
        <div
            className={`flex shrink-0 items-center justify-center overflow-hidden border border-border/60 bg-muted/40 ${className}`}
        >
            {project.thumbnailUrl ? (
                <img
                    src={project.thumbnailUrl}
                    alt={`${project.projectName} preview`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            ) : (
                <FolderOpen
                    size={iconSize}
                    className="text-muted-foreground"
                />
            )}
        </div>
    );
}


//==================================================
// PROJECT MANAGEMENT
//==================================================

export default function ProjectManagement() {

    const navigate = useNavigate();

    const [projects, setProjects] = useState<AdminProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState<AdminClient[]>([]);
    const [clientDialogOpen, setClientDialogOpen] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [openingFloorPlan, setOpeningFloorPlan] = useState(false);
    const openingFloorPlanRef = useRef(false);
    const openingFloorPlanTimeoutRef = useRef<number | null>(null);

    const [sortField, setSortField] = useState<SortField>("Date Modified");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [projectView, setProjectView] = useState<ProjectView>("tiles");

    const [selectedProject, setSelectedProject] =
        useState<AdminProject | null>(null);


    //==================================================
    // LOAD ALL PROJECTS
    //==================================================

    useEffect(() => {

        let cancelled = false;

        const unsubscribe = onAuthStateChanged(auth, async user => {

            if (!user) {
                if (!cancelled) {
                    setProjects([]);
                    setError("Please log in to view projects.");
                    setLoading(false);
                }
                return;
            }

            try {
                if (!cancelled) {
                    setLoading(true);
                    setError("");
                }

                // Admin project list: returns ALL projects.
                const [loadedProjects, loadedClients] = await Promise.all([
                    getAdminProjects(),
                    getAdminClients()
                ]);

                if (!cancelled) {
                    setProjects(loadedProjects);
                    setClients(loadedClients);
                }

            } catch (loadError) {

                console.error("Failed to load projects:", loadError);

                if (!cancelled) {
                    const firebaseError = loadError as { code?: string };

                    setError(
                        firebaseError.code
                            ? `Failed to load projects: ${firebaseError.code}`
                            : "Failed to load projects."
                    );
                }

            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };

    }, []);

    useEffect(() => () => {
        if (openingFloorPlanTimeoutRef.current !== null) {
            window.clearTimeout(openingFloorPlanTimeoutRef.current);
        }
    }, []);


    //==================================================
    // FILTER + SORT
    //==================================================

    const filteredProjects = useMemo(() => {

        const value = search.trim().toLowerCase();

        const base = !value
            ? projects
            : projects.filter(
                project =>
                    project.projectName.toLowerCase().includes(value) ||
                    (project.ownerName ?? "").toLowerCase().includes(value) ||
                    project.ownerId.toLowerCase().includes(value) ||
                    project.projectId.toLowerCase().includes(value)
            );

        const sorted = [...base];

        sorted.sort((a, b) => {
            let comparison: number;

            if (sortField === "Project Name") {
                comparison = a.projectName.localeCompare(b.projectName);
            } else if (sortField === "Date Modified") {
                comparison = getProjectTime(a.updatedAt) - getProjectTime(b.updatedAt);
            } else if (sortField === "Date Created") {
                comparison = getProjectTime(a.createdAt) - getProjectTime(b.createdAt);
            } else {
                comparison = (a.ownerName ?? "Unknown User").localeCompare(
                    b.ownerName ?? "Unknown User"
                );
            }

            if (comparison === 0) {
                comparison = a.projectId.localeCompare(b.projectId);
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;

    }, [projects, search, sortField, sortDirection]);


    //==================================================
    // OPEN PROJECT
    //==================================================
    //
    // Opens the ADMIN view-only loader,
    // NOT /studio/load/:projectId
    //
    //==================================================

    function handleOpenProject(project: AdminProject) {
        setSelectedProject(null);
        if (project.workflowType === "admin-managed") {
            navigate(`/projects/edit/${project.projectId}`, {
                state: { ownerName: project.ownerName }
            });
            return;
        }
        navigate(`/projects/view/${project.projectId}`);
    }

    function createProjectForClient() {
        if (openingFloorPlanRef.current) return;
        const client = clients.find(item => item.id === selectedClientId);
        if (!client) return;
        openingFloorPlanRef.current = true;
        setOpeningFloorPlan(true);
        setClientDialogOpen(false);
        openingFloorPlanTimeoutRef.current = window.setTimeout(() => {
            openingFloorPlanRef.current = false;
            openingFloorPlanTimeoutRef.current = null;
            setOpeningFloorPlan(false);
            setError("The floor-plan editor did not open. Please try again.");
        }, 15_000);
        try {
            navigate(`/projects/new/${encodeURIComponent(client.uid)}`, {
                state: { ownerName: client.name }
            });
        } catch (navigationError) {
            if (openingFloorPlanTimeoutRef.current !== null) {
                window.clearTimeout(openingFloorPlanTimeoutRef.current);
                openingFloorPlanTimeoutRef.current = null;
            }
            openingFloorPlanRef.current = false;
            setOpeningFloorPlan(false);
            setError(navigationError instanceof Error
                ? `Unable to open the floor plan: ${navigationError.message}`
                : "Unable to open the floor plan.");
        }
    }

    if (openingFloorPlan) {
        return <LoadingScreen label="Preparing Floor Plan" />;
    }


    //==================================================
    // RENDER
    //==================================================

    return (

        <div className="w-full">

            <Card className="border-border/60 shadow-none">

                <CardHeader className="border-b border-border/60">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                            <CardTitle className="text-base">
                                User Projects
                            </CardTitle>

                            <CardDescription>
                                Select a project to view its details.
                            </CardDescription>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <button
                                type="button"
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                                onClick={() => setClientDialogOpen(true)}
                            >
                                <Plus size={16} />
                                New floor-plan project
                            </button>

                            <div className="relative w-full sm:w-64">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />

                                <Input
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search projects..."
                                    className="border-border/60 pl-9"
                                />
                            </div>

                            <div className="flex items-center gap-2">

                                <Select
                                    value={sortField}
                                    onValueChange={value => setSortField(value as SortField)}
                                >
                                    <SelectTrigger className="w-full border-border/60 sm:w-56">
                                        <SelectValue placeholder="Sort by" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {SORT_FIELDS.map(option => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSortDirection(current =>
                                            current === "asc" ? "desc" : "asc"
                                        )
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                                    title={sortDirection === "asc" ? "Ascending" : "Descending"}
                                    aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
                                >
                                    {sortDirection === "asc"
                                        ? <ArrowUpAZ size={16} />
                                        : <ArrowDownAZ size={16} />}
                                </button>

                                <div
                                    className="flex items-center rounded-md border border-border/60 bg-background p-0.5"
                                    role="group"
                                    aria-label="Project view"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setProjectView("list")}
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-sm ${projectView === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
                                        title="List view"
                                        aria-label="List view"
                                        aria-pressed={projectView === "list"}
                                    >
                                        <List size={16} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setProjectView("tiles")}
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-sm ${projectView === "tiles" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
                                        title="Tiles view"
                                        aria-label="Tiles view"
                                        aria-pressed={projectView === "tiles"}
                                    >
                                        <LayoutGrid size={16} />
                                    </button>
                                </div>

                            </div>

                        </div>

                    </div>

                </CardHeader>


                <CardContent className="p-0">
                    {clientDialogOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                            <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg">
                                <div className="mb-4">
                                    <p className="font-medium">Create floor-plan project</p>
                                    <p className="mt-1 text-sm text-muted-foreground">Select the client who will own the project.</p>
                                </div>
                                <label className="grid gap-2 text-sm">
                                    Client
                                    <select
                                        className="h-9 rounded-md border border-border bg-background px-3"
                                        value={selectedClientId}
                                        onChange={event => setSelectedClientId(event.target.value)}
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>
                                                {client.name}{client.email ? ` (${client.email})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button type="button" className="h-9 rounded-md border border-border px-3 text-sm" onClick={() => setClientDialogOpen(false)}>Cancel</button>
                                    <button type="button" className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50" disabled={!selectedClientId || openingFloorPlan} onClick={createProjectForClient}>
                                        Create local draft
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LOADING */}
                    {loading && (
                        <div className="flex min-h-64 items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                Loading projects...
                            </p>
                        </div>
                    )}


                    {/* ERROR */}
                    {!loading && error && (
                        <div className="flex min-h-64 items-center justify-center p-6">
                            <div className="text-center">
                                <p className="text-sm font-medium">
                                    Unable to load projects
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}


                    {/* EMPTY */}
                    {!loading && !error && filteredProjects.length === 0 && (
                        <div className="flex min-h-64 flex-col items-center justify-center gap-3">
                            <div className="rounded-full bg-muted p-3">
                                <FolderOpen
                                    size={24}
                                    className="text-muted-foreground"
                                />
                            </div>

                            <div className="text-center">
                                <p className="text-sm font-medium">
                                    No projects found
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    {search
                                        ? "Try a different search."
                                        : "There are no saved projects yet."}
                                </p>
                            </div>
                        </div>
                    )}


                    {/* LIST */}
                    {!loading &&
                        !error &&
                        filteredProjects.length > 0 &&
                        projectView === "list" && (

                        <div className="overflow-x-auto">

                            <Table>

                                <TableHeader>
                                    <TableRow className="border-border/60 hover:bg-transparent">
                                        <TableHead>Project</TableHead>
                                        <TableHead>Owner</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        <TableHead>Estimated Cost</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filteredProjects.map(project => (

                                        <TableRow
                                            key={project.projectId}
                                            className="cursor-pointer border-border/60 hover:bg-muted/30"
                                            onClick={() => setSelectedProject(project)}
                                        >

                                            <TableCell>
                                                <div className="flex items-center gap-3">

                                                    <ProjectPreview
                                                        project={project}
                                                        iconSize={19}
                                                        className="h-14 w-20 rounded-md"
                                                    />

                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium">
                                                            {project.projectName}
                                                        </p>

                                                        <p className="truncate text-xs text-muted-foreground">
                                                            ID: {project.projectId}
                                                        </p>
                                                    </div>

                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User
                                                        size={14}
                                                        className="text-muted-foreground"
                                                    />

                                                    <span className="max-w-40 truncate text-sm">
                                                        {project.ownerName || "Unknown User"}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {formatProjectDate(project.createdAt)}
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {formatProjectDate(project.updatedAt)}
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <span className="text-sm font-medium">
                                                    {formatCost(project)}
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <Badge variant="outline">
                                                    Saved
                                                </Badge>
                                            </TableCell>

                                        </TableRow>

                                    ))}
                                </TableBody>

                            </Table>

                        </div>
                    )}


                    {/* TILES */}
                    {!loading &&
                        !error &&
                        filteredProjects.length > 0 &&
                        projectView === "tiles" && (

                        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                            {filteredProjects.map(project => (
                                <button
                                    key={project.projectId}
                                    type="button"
                                    onClick={() => setSelectedProject(project)}
                                    className="w-full text-left"
                                >
                                    <Card className="h-full overflow-hidden border-border/60 shadow-none transition-colors hover:bg-muted/20">

                                        <ProjectPreview
                                            project={project}
                                            iconSize={28}
                                            className="aspect-video w-full rounded-none border-0 border-b"
                                        />

                                        <CardHeader className="pb-3">
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-sm">
                                                    {project.projectName}
                                                </CardTitle>

                                                <CardDescription className="mt-1 truncate text-xs">
                                                    {project.projectId}
                                                </CardDescription>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-3 pt-0">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <User size={14} />
                                                <span className="truncate">
                                                    {project.ownerName || "Unknown User"}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-3 text-xs">
                                                <span className="text-muted-foreground">
                                                    Date modified
                                                </span>
                                                <span className="truncate text-right">
                                                    {formatProjectDate(project.updatedAt)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                                                <span className="text-xs text-muted-foreground">
                                                    {formatCost(project)}
                                                </span>
                                                <Badge variant="outline">
                                                    Saved
                                                </Badge>
                                            </div>
                                        </CardContent>

                                    </Card>
                                </button>
                            ))}
                        </div>
                    )}

                </CardContent>

            </Card>


            {/* PROJECT DETAILS MODAL */}
            <ProjectDetailsModal
                project={selectedProject}
                onOpenChange={open => {
                    if (!open) {
                        setSelectedProject(null);
                    }
                }}
                onOpenProject={handleOpenProject}
                onDeadlineSaved={(projectId, deadline) => {
                    setProjects(current =>
                        current.map(project =>
                            project.projectId === projectId
                                ? { ...project, deadline }
                                : project
                        )
                    );

                    setSelectedProject(current =>
                        current?.projectId === projectId
                            ? { ...current, deadline }
                            : current
                    );
                }}
            />

        </div>

    );

}