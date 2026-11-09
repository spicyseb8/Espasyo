import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Search,
  Ellipsis,
  ExternalLink,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAdminProjects,
  getAdminFloorPlans,
  type AdminProject,
} from "@/services/assets/projectService";

import { useAuth } from "@/context/AuthContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import NewFloorPlanProjectButton from "@/components/project-editor/NewFloorPlanProjectButton";
import { deleteManagedFloorPlanDraft } from "@/services/assets/projectStructureService";

/* ------------------------------------------------------------------ */
/* Shared line styles (same as UserTable)                              */
/* ------------------------------------------------------------------ */

const CARD =
  "gap-3 rounded-lg border border-border bg-background py-4 shadow-none ring-0";

// Local calendar dates (not UTC) so deadlines never shift a day.
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return "Unknown date";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userName = user?.displayName || user?.email?.split("@")[0] || "Admin";

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [floorPlans, setFloorPlans] = useState<AdminProject[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);
  const [deadlinesError, setDeadlinesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setProjects([]);
      setFloorPlans([]);
      setDeadlinesLoading(false);
      setDeadlinesError("");
      return () => {
        cancelled = true;
      };
    }

    setDeadlinesLoading(true);
    setDeadlinesError("");

    Promise.all([getAdminProjects(), getAdminFloorPlans()])
      .then(([projects, floorPlans]) => {
        if (cancelled) return;

        setProjects(projects);
        setFloorPlans(floorPlans);
      })
      .catch((error: unknown) => {
        console.error("Failed to load project deadlines:", error);

        if (!cancelled) {
          setProjects([]);
          setFloorPlans([]);
          setDeadlinesError("Unable to load project deadlines.");
        }
      })
      .finally(() => {
        if (!cancelled) setDeadlinesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <GreetingCalendarCard
          userName={userName}
          projects={projects}
          loading={deadlinesLoading}
          error={deadlinesError}
          onOpenProject={(projectId) => navigate(`/projects/view/${projectId}`)}
        />
        <AvailableFloorPlanProjectsCard
          projects={floorPlans}
          currentUserId={user?.uid ?? ""}
          loading={deadlinesLoading}
          error={deadlinesError}
          onOpenProject={(project, focusName) => {
            if (project.recordType === "draft") {
              navigate(`/projects/draft/${encodeURIComponent(project.projectId)}`, {
                state: {
                  ownerName: project.ownerName,
                  showInitializationLoading: true,
                  focusProjectName: focusName === true,
                },
              });
              return;
            }
            navigate(`/projects/edit/${encodeURIComponent(project.projectId)}`, {
              state: { ownerName: project.ownerName, focusProjectName: focusName === true },
            });
          }}
        />
      </div>
    </div>
  );
}

function AvailableFloorPlanProjectsCard({
  projects,
  currentUserId,
  loading,
  error,
  onOpenProject,
}: {
  projects: AdminProject[];
  currentUserId: string;
  loading: boolean;
  error: string;
  onOpenProject: (project: AdminProject, focusName?: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"modified" | "created" | "name">("modified");
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [detailsProject, setDetailsProject] = useState<AdminProject | null>(null);
  const [deletedDraftIds, setDeletedDraftIds] = useState<string[]>([]);
  const [draftDeleteError, setDraftDeleteError] = useState("");

  const visibleProjects = useMemo(
    () => (tab === "all"
      ? projects.filter(project => project.structuralStatus === "draft")
      : projects.filter(project => project.createdBy === currentUserId))
      .filter(project => !deletedDraftIds.includes(project.projectId)),
    [projects, tab, currentUserId, deletedDraftIds],
  );

  async function handleDeleteDraft(project: AdminProject) {
    if (project.createdBy !== currentUserId) return;
    if (!window.confirm(`Delete the unpublished draft "${project.projectName}"? This cannot be undone.`)) return;
    setDraftDeleteError("");
    try {
      await deleteManagedFloorPlanDraft(project.projectId);
      setDeletedDraftIds(current => [...current, project.projectId]);
    } catch (error) {
      setDraftDeleteError(error instanceof Error ? error.message : "Unable to delete draft.");
    }
  }

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = visibleProjects.filter(project =>
      !query ||
      project.projectName.toLowerCase().includes(query) ||
      (project.ownerName ?? "").toLowerCase().includes(query) ||
      (project.intendedClientEmail ?? "").toLowerCase().includes(query) ||
      (project.creatorName ?? "").toLowerCase().includes(query)
    );
    return filtered.sort((first, second) => {
      if (sortBy === "name") {
        return first.projectName.localeCompare(second.projectName);
      }
      let difference = projectTimestamp(first[sortBy === "created" ? "createdAt" : "updatedAt"]) -
        projectTimestamp(second[sortBy === "created" ? "createdAt" : "updatedAt"]);
      if (difference === 0) difference = first.projectId.localeCompare(second.projectId);
      return -difference;
    });
  }, [visibleProjects, search, sortBy]);

  return (
    <Card className={`${CARD} min-w-0 lg:col-span-2`}>
      <CardHeader className="gap-3 px-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Floor-Plan Drafts</CardTitle>
            <CardDescription className="text-xs">
              Unpublished plans stay here until they are published from the editor.
            </CardDescription>
          </div>
          <NewFloorPlanProjectButton />
        </div>
        <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Floor-plan drafts">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${tab === "all" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("all")}
          >
            All Drafts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${tab === "mine" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("mine")}
          >
            My Drafts
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search drafts, creators, or clients..."
              className="h-9 border-border/60 pl-9"
              aria-label="Search floor-plan drafts"
            />
          </div>
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm"
            value={sortBy}
            onChange={event => setSortBy(event.target.value as typeof sortBy)}
            aria-label="Sort floor-plan drafts"
          >
            <option value="modified">Recently Modified</option>
            <option value="created">Recently Created</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="min-h-[300px] px-4 pb-4 pt-0">
        {draftDeleteError && <p className="mb-3 text-sm text-destructive" role="alert">{draftDeleteError}</p>}
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading drafts...</p>
        ) : error ? (
          <p className="py-12 text-center text-sm text-destructive" role="alert">{error}</p>
        ) : filteredProjects.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <FolderOpen size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {search ? "No matching drafts" : tab === "mine" ? "You have no drafts yet" : "No floor-plan drafts"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? "Try a different search."
                  : tab === "mine"
                    ? "Drafts you create will appear here."
                    : "Create a floor plan to get started."}
              </p>
            </div>
            {!search && tab === "all" && <NewFloorPlanProjectButton />}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="[&_tr]:border-border/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[220px] px-3 text-xs">Floor Plan</TableHead>
                  <TableHead className="min-w-[130px] px-3 text-xs">Created By</TableHead>
                  <TableHead className="min-w-[130px] px-3 text-xs">Client</TableHead>
                  <TableHead className="min-w-[130px] px-3 text-xs">Last Modified</TableHead>
                  <TableHead className="w-[150px] px-3 text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map(project => (
                  <TableRow key={project.projectId} className="border-border/60">
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <ProjectPreview project={project} className="h-10 w-14 rounded-md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{project.projectName}</p>
                          <Badge variant="outline" className="mt-1 h-4 rounded px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
                            Draft
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-sm">
                      <span className={!project.creatorName ? "text-muted-foreground" : ""}>
                        {project.creatorName || "Unknown creator"}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-sm">
                      {project.intendedClientId
                        ? project.ownerName || "Unknown client"
                        : "Unassigned"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                      {formatDraftDate(project.updatedAt)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5 text-xs"
                          onClick={() => onOpenProject(project)}
                        >
                          <ExternalLink size={14} />
                          Open
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`More actions for ${project.projectName}`}
                          >
                            <Ellipsis size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {project.createdBy === currentUserId && (
                              <DropdownMenuItem onClick={() => onOpenProject(project, true)}>
                                <Pencil size={14} />
                                Rename
                              </DropdownMenuItem>
                            )}
                            {project.createdBy === currentUserId && project.recordType === "draft" && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => void handleDeleteDraft(project)}
                              >
                                <Trash2 size={14} />
                                Delete draft
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setDetailsProject(project)}>
                              <Info size={14} />
                              Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog open={Boolean(detailsProject)} onOpenChange={open => {
        if (!open) setDetailsProject(null);
      }}>
        <DialogContent>
          {detailsProject && (
            <>
              <DialogHeader>
                <DialogTitle>{detailsProject.projectName}</DialogTitle>
                <DialogDescription>Draft details and technical identifiers.</DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 text-sm">
                <DraftDetail label="Draft ID" value={detailsProject.projectId} />
                <DraftDetail label="Creator" value={detailsProject.creatorName || "Unknown creator"} />
                <DraftDetail label="Creator ID" value={detailsProject.createdBy || "Unavailable"} />
                <DraftDetail
                  label="Client"
                  value={detailsProject.intendedClientId
                    ? detailsProject.ownerName === "Unknown User"
                      ? "Unknown client"
                      : detailsProject.ownerName || "Unknown client"
                    : "Unassigned"}
                />
                <DraftDetail label="Client ID" value={detailsProject.intendedClientId || "Unassigned"} />
                <DraftDetail label="Client email" value={detailsProject.intendedClientEmail || "Unavailable"} />
                <DraftDetail label="Created" value={formatDraftDate(detailsProject.createdAt)} />
                <DraftDetail label="Last modified" value={formatDraftDate(detailsProject.updatedAt)} />
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DraftDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}

function formatDraftDate(value: unknown): string {
  const timestamp = projectTimestamp(value);
  if (!timestamp) return "Unknown date";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ProjectPreview({
  project,
  className,
}: {
  project: AdminProject;
  className: string;
}) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-border/60 bg-muted/40 ${className}`}>
      {project.thumbnailUrl ? (
        <img
          src={project.thumbnailUrl}
          alt={`${project.projectName} preview`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <FolderOpen size={20} className="text-muted-foreground" />
      )}
    </div>
  );
}

function projectTimestamp(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Greeting + project deadline calendar (combined)                     */
/* ------------------------------------------------------------------ */

function GreetingCalendarCard({
  userName,
  projects,
  loading,
  error,
  onOpenProject,
}: {
  userName: string;
  projects: AdminProject[];
  loading: boolean;
  error: string;
  onOpenProject: (projectId: string) => void;
}) {
  const todayKey = localDateKey(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const deadlinesByDate = useMemo(() => {
    const groups = new Map<string, AdminProject[]>();

    for (const project of projects) {
      const deadline = project.deadline;

      if (
        typeof deadline !== "string" ||
        !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/.test(deadline)
      ) {
        continue;
      }

      const deadlineDate = deadline.slice(0, 10);
      const existing = groups.get(deadlineDate) ?? [];
      existing.push(project);
      groups.set(deadlineDate, existing);
    }

    for (const [date, items] of groups) {
      groups.set(
        date,
        [...items].sort((a, b) => a.projectName.localeCompare(b.projectName)),
      );
    }

    return groups;
  }, [projects]);

  const calendarDates = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalCells = 42; // fixed six-week grid

    return Array.from(
      { length: totalCells },
      (_, index) => new Date(year, month, index - firstWeekday + 1),
    );
  }, [viewMonth]);

  // How many deadlines fall inside the month being viewed.
  const monthDeadlineCount = useMemo(() => {
    const prefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}-`;
    let total = 0;
    for (const [date, items] of deadlinesByDate) {
      if (date.startsWith(prefix)) total += items.length;
    }
    return total;
  }, [deadlinesByDate, viewMonth]);

  const selectedProjects = deadlinesByDate.get(selectedDate) ?? [];
  const monthLabel = viewMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const goToMonth = (offset: number) => {
    setViewMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  };

  const selectDate = (date: Date) => {
    setSelectedDate(localDateKey(date));

    if (
      date.getMonth() !== viewMonth.getMonth() ||
      date.getFullYear() !== viewMonth.getFullYear()
    ) {
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  return (
    <Card className={`${CARD} min-w-0`}>
      <CardHeader className="px-4 pb-0">
        <CardDescription className="text-xs">{todayLabel}</CardDescription>
        <CardTitle className="truncate text-2xl font-semibold tracking-tight">
          Hello, {userName}!
        </CardTitle>
        <CardDescription className="text-xs">
          {monthDeadlineCount > 0
            ? `${monthDeadlineCount} project deadline${monthDeadlineCount === 1 ? "" : "s"} in ${viewMonth.toLocaleDateString("en-US", { month: "long" })}. Select a marked date to see them.`
            : `No project deadlines in ${viewMonth.toLocaleDateString("en-US", { month: "long" })}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => goToMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <p className="text-sm font-semibold">{monthLabel}</p>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            onClick={() => goToMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[10px] font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarDates.map((date) => {
            const dateKey = localDateKey(date);
            const isCurrentMonth = date.getMonth() === viewMonth.getMonth();
            const count = deadlinesByDate.get(dateKey)?.length ?? 0;
            const hasDeadline = count > 0;
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayKey;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => selectDate(date)}
                aria-label={`${formatCalendarDate(dateKey)}${
                  hasDeadline
                    ? `, ${count} project deadline${count === 1 ? "" : "s"}`
                    : ""
                }`}
                aria-pressed={isSelected}
                className={[
                  "relative flex h-10 w-full items-center justify-center rounded-lg text-sm transition-colors",
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                    : hasDeadline
                      ? "bg-primary/15 font-bold text-primary ring-1 ring-primary/50 hover:bg-primary/25"
                      : "text-foreground hover:bg-muted",
                  !isCurrentMonth && !isSelected && !hasDeadline
                    ? "text-muted-foreground/40"
                    : "",
                  !isCurrentMonth && hasDeadline && !isSelected
                    ? "opacity-70"
                    : "",
                  isToday && !isSelected && !hasDeadline
                    ? "ring-1 ring-foreground/30 font-semibold"
                    : "",
                ].join(" ")}
              >
                {date.getDate()}

                {/* Number of projects due on this date */}
                {hasDeadline && (
                  <span
                    aria-hidden="true"
                    className={[
                      "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow",
                      isSelected
                        ? "bg-background text-primary ring-1 ring-primary"
                        : "bg-primary text-primary-foreground",
                    ].join(" ")}
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-block h-4 w-4 rounded bg-primary/15 ring-1 ring-primary/50" />
            Has a deadline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              3
            </span>
            Projects due that day
          </span>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {selectedDate === todayKey
                ? "Due today"
                : formatCalendarDate(selectedDate)}
            </p>
            <Badge
              variant={selectedProjects.length > 0 ? "default" : "outline"}
              className="text-[11px]"
            >
              {selectedProjects.length === 0
                ? "None due"
                : `${selectedProjects.length} project${selectedProjects.length === 1 ? "" : "s"} due`}
            </Badge>
          </div>

          {loading ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Loading deadlines...
            </p>
          ) : error ? (
            <p className="py-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : selectedProjects.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">
              No project deadlines on this date.
            </p>
          ) : (
            <ScrollArea className="h-[112px] w-full">
              <ul className="space-y-1 pr-2">
                {selectedProjects.map((project) => (
                  <li key={project.projectId}>
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.projectId)}
                      className="flex min-h-[40px] w-full items-center gap-2 overflow-hidden rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={`Open ${project.projectName}`}
                    >
                      <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                      <span className="line-clamp-2 text-xs leading-snug">
                        <span className="font-semibold">
                          {project.projectName}
                        </span>{" "}
                        {selectedDate === todayKey
                          ? "is due today."
                          : `is due on ${formatCalendarDate(selectedDate)}.`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}