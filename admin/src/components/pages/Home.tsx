import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  LayoutGrid,
  List,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAdminProjects,
  type AdminProject,
} from "@/services/assets/projectService";
import {
  getAvailableFloorPlanProjects,
  getUnverifiedManagedProjects,
} from "@/services/assets/projectLifecycle";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import NewFloorPlanProjectButton from "@/components/project-editor/NewFloorPlanProjectButton";
import {
  formatCost,
  formatProjectDate,
} from "./ProjectManagement/ProjectManagement";

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
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);
  const [deadlinesError, setDeadlinesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setProjects([]);
      setDeadlinesLoading(false);
      setDeadlinesError("");
      return () => {
        cancelled = true;
      };
    }

    setDeadlinesLoading(true);
    setDeadlinesError("");

    getAdminProjects()
      .then((projects) => {
        if (cancelled) return;

        setProjects(projects);
      })
      .catch((error: unknown) => {
        console.error("Failed to load project deadlines:", error);

        if (!cancelled) {
          setProjects([]);
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

  const availableProjects = useMemo(
    () => getAvailableFloorPlanProjects(projects),
    [projects],
  );
  const unverifiedProjects = useMemo(
    () => getUnverifiedManagedProjects(projects),
    [projects],
  );

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
          projects={availableProjects}
          unverifiedProjects={unverifiedProjects}
          loading={deadlinesLoading}
          error={deadlinesError}
          onOpenProject={project => navigate(`/projects/edit/${project.projectId}`, {
            state: { ownerName: project.ownerName },
          })}
        />
      </div>
    </div>
  );
}

function AvailableFloorPlanProjectsCard({
  projects,
  unverifiedProjects,
  loading,
  error,
  onOpenProject,
}: {
  projects: AdminProject[];
  unverifiedProjects: AdminProject[];
  loading: boolean;
  error: string;
  onOpenProject: (project: AdminProject) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"modified" | "created" | "name">("modified");
  const [ascending, setAscending] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = projects.filter(project =>
      !query ||
      project.projectName.toLowerCase().includes(query) ||
      project.projectId.toLowerCase().includes(query) ||
      (project.ownerName ?? "").toLowerCase().includes(query) ||
      project.ownerId.toLowerCase().includes(query)
    );
    return filtered.sort((first, second) => {
      let difference: number;
      if (sortBy === "name") {
        difference = first.projectName.localeCompare(second.projectName);
      } else {
        difference = projectTimestamp(first[sortBy === "created" ? "createdAt" : "updatedAt"]) -
          projectTimestamp(second[sortBy === "created" ? "createdAt" : "updatedAt"]);
      }
      if (difference === 0) difference = first.projectId.localeCompare(second.projectId);
      return ascending ? difference : -difference;
    });
  }, [projects, search, sortBy, ascending]);

  return (
    <Card className={`${CARD} min-w-0 lg:col-span-2`}>
      <CardHeader className="gap-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Available Floor-Plan Projects</CardTitle>
            <CardDescription className="text-xs">
              Published floor plans waiting for their client to begin designing.
            </CardDescription>
          </div>
          <NewFloorPlanProjectButton />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search projects..."
              className="border-border/60 pl-9"
              aria-label="Search available floor-plan projects"
            />
          </div>
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm"
            value={sortBy}
            onChange={event => setSortBy(event.target.value as typeof sortBy)}
            aria-label="Sort available projects"
          >
            <option value="modified">Date Modified</option>
            <option value="created">Date Created</option>
            <option value="name">Project Name</option>
          </select>
          <button
            type="button"
            onClick={() => setAscending(current => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted"
            aria-label={ascending ? "Sort descending" : "Sort ascending"}
            title={ascending ? "Ascending" : "Descending"}
          >
            {ascending ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />}
          </button>
          <div className="flex items-center rounded-md border border-border/60 bg-background p-0.5" role="group" aria-label="Available project view">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-sm ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-sm ${view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-[460px] p-0">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading available floor plans...</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-destructive" role="alert">{error}</p>
        ) : filteredProjects.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <FolderOpen size={24} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {search ? "No matching floor plans" : "No available floor plans"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? "Try a different search."
                  : "There are no unused floor plans currently waiting for a client."}
              </p>
            </div>
            {!search && <NewFloorPlanProjectButton />}
          </div>
        ) : view === "list" ? (
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
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
                    onClick={() => onOpenProject(project)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProjectPreview project={project} className="h-12 w-16 rounded-md" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{project.projectName}</p>
                          <p className="truncate text-xs text-muted-foreground">ID: {project.projectId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{project.ownerName || "Unknown User"}</p>
                      <p className="text-xs text-muted-foreground">{project.ownerId}</p>
                    </TableCell>
                    <TableCell>{formatProjectDate(project.createdAt)}</TableCell>
                    <TableCell>{formatProjectDate(project.updatedAt)}</TableCell>
                    <TableCell>{formatCost(project)}</TableCell>
                    <TableCell><Badge variant="outline">Available for Client</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ScrollArea className="max-h-[520px] px-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map(project => (
                <button
                  key={project.projectId}
                  type="button"
                  className="rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/30"
                  onClick={() => onOpenProject(project)}
                >
                  <ProjectPreview project={project} className="mb-3 h-32 w-full rounded-md" />
                  <p className="truncate text-sm font-medium">{project.projectName}</p>
                  <p className="text-xs text-muted-foreground">ID: {project.projectId}</p>
                  <p className="mt-2 truncate text-xs">{project.ownerName || "Unknown User"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Modified {formatProjectDate(project.updatedAt)}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs">{formatCost(project)}</span>
                    <Badge variant="outline">Available</Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
        {!loading && !error && unverifiedProjects.length > 0 && (
          <div className="mx-4 mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-medium">
              {unverifiedProjects.length} project(s) need lifecycle verification and are excluded from both lists.
            </p>
            <ul className="mt-1 list-inside list-disc">
              {unverifiedProjects.map(project => (
                <li key={project.projectId}>
                  {project.projectName} ({project.projectId}) — {project.lifecycleError || "Project assignment or publication metadata could not be verified."}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
        !/^\d{4}-\d{2}-\d{2}$/.test(deadline)
      ) {
        continue;
      }

      const existing = groups.get(deadline) ?? [];
      existing.push(project);
      groups.set(deadline, existing);
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
          {deadlinesByDate.size > 0
            ? "Select a highlighted date to view due projects."
            : "Here's what's happening in your workspace today."}
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

        <div className="grid grid-cols-7 gap-1">
          {calendarDates.map((date) => {
            const dateKey = localDateKey(date);
            const isCurrentMonth = date.getMonth() === viewMonth.getMonth();
            const hasDeadline = deadlinesByDate.has(dateKey);
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayKey;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => selectDate(date)}
                aria-label={`${formatCalendarDate(dateKey)}${
                  hasDeadline
                    ? `, ${deadlinesByDate.get(dateKey)?.length} project deadline(s)`
                    : ""
                }`}
                aria-pressed={isSelected}
                className={[
                  "relative flex h-8 w-full items-center justify-center rounded-md text-xs transition-colors",
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : hasDeadline
                      ? "bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                      : "hover:bg-muted",
                  !isCurrentMonth && !isSelected
                    ? "text-muted-foreground/40"
                    : "",
                  isToday && !isSelected ? "ring-1 ring-primary/50" : "",
                ].join(" ")}
              >
                {date.getDate()}
                {hasDeadline && (
                  <span
                    className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-border pt-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">
              {selectedDate === todayKey
                ? "Due today"
                : formatCalendarDate(selectedDate)}
            </p>
            {selectedProjects.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {selectedProjects.length}
              </Badge>
            )}
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
            <ScrollArea className="h-[88px] w-full">
              <ul className="space-y-1 pr-2">
                {selectedProjects.map((project) => (
                  <li key={project.projectId}>
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.projectId)}
                      className="flex h-[40px] w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={`Open ${project.projectName}`}
                    >
                      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="line-clamp-2 text-xs leading-snug">
                        <span className="font-medium">
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