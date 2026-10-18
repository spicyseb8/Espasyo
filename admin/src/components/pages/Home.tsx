import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  getAdminProjects,
  type AdminProject,
} from "@/services/assets/projectService";

import { useAuth } from "@/context/AuthContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ------------------------------------------------------------------ */
/* Shared line styles (same as UserTable)                              */
/* ------------------------------------------------------------------ */

// Outer cards: same border as the UserTable container
const CARD =
  "gap-3 rounded-lg border border-border bg-background py-4 shadow-none ring-0";

// Boxes inside cards
const INNER = "rounded-lg border border-border bg-muted/40";

// Controls (inputs, chips): softer, like the UserTable select/sort button
const CONTROL = "border border-border/60 bg-background";

/* ------------------------------------------------------------------ */
/* Types + sample data (replace with Firestore data later)             */
/* ------------------------------------------------------------------ */

interface AppNotification {
  id: string;
  message: string;
  createdAt: Date;
}

const dailyActive = [240, 300, 200, 278, 189, 239, 278, 189];

const stats = [
  { label: "Daily active users", value: "3,450", change: 12.1 },
  { label: "Weekly sessions", value: "1,342", change: -9.8 },
  { label: "Duration", value: "5.2min", change: 7.7 },
  { label: "Conversion rate", value: "2.8%", change: 4.3 },
];

const trend = [40, 62, 55, 78, 70, 92, 85, 104, 96, 118];

const initialNotifications: AppNotification[] = [
  {
    id: "x1",
    message: "Weekly report is ready to export",
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: "x2",
    message: "3 new sign-ups today",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
];

const timeAgo = (date: Date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// Use local calendar dates instead of UTC to prevent a deadline from
// shifting to the previous or next day because of timezone conversion.
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

  const [notifications, setNotifications] =
    useState<AppNotification[]>(initialNotifications);

  const [deadlineProjects, setDeadlineProjects] =
    useState<AdminProject[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);
  const [deadlinesError, setDeadlinesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setDeadlineProjects([]);
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

        setDeadlineProjects(
          projects.filter(
            (project) =>
              typeof project.deadline === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(project.deadline),
          ),
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load project deadlines:", error);

        if (!cancelled) {
          setDeadlineProjects([]);
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

  const handleProjectCreated = (name: string) => {
    setNotifications((prev) => [
      {
        id: crypto.randomUUID(),
        message: `Project "${name}" was created`,
        createdAt: new Date(),
      },
      ...prev,
    ]);

    // Mini notification
    toast.success("Project created", {
      description: `"${name}" has been added to your workspace.`,
    });
  };

  // Last 28 days, ending today
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 27);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${CONTROL}`}
          >
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            {fmt(start)} - {fmt(end)}
          </div>
          <Button size="sm">Export</Button>
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
        <HelloCard
          userName={userName}
          onProjectCreated={handleProjectCreated}
        />
        <DailyActiveCard />
        <NotificationsCard notifications={notifications} />
      </div>

      {/* Row 2 */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:-mt-12">
          <DeadlineCalendarCard
            projects={deadlineProjects}
            loading={deadlinesLoading}
            error={deadlinesError}
            onOpenProject={(projectId) =>
              navigate(`/projects/view/${projectId}`)
            }
          />
        </div>
        <AnalyticsCard />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hello + New project                                                 */
/* ------------------------------------------------------------------ */

function HelloCard({
  userName,
  onProjectCreated,
}: {
  userName: string;
  onProjectCreated: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();

    const name = projectName.trim();
    if (!name) return;

    // TODO: save the project to Firestore here.

    onProjectCreated(name);
    setOpen(false);
    setProjectName("");
  };

  return (
    <>
      <Card className={CARD}>
        <CardHeader className="px-4">
          <CardDescription className="text-xs">{today}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-4 pb-4">
          <div>
            <h2 className="truncate text-2xl font-semibold tracking-tight">
              Hello, {userName}!
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Here's what's happening in your workspace today.
            </p>
          </div>

          <Button size="sm" className="w-fit" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New project
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create a new project</DialogTitle>
              <DialogDescription>
                Give your project a name to get started.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                placeholder="e.g. Website redesign"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!projectName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Daily active users (bar chart)                                      */
/* ------------------------------------------------------------------ */

function DailyActiveCard() {
  const max = Math.max(...dailyActive);

  return (
    <Card className={CARD}>
      <CardHeader className="px-4">
        <CardDescription className="text-xs font-medium text-foreground">
          Daily active
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4">
        <p className="text-2xl font-semibold tracking-tight">+4850</p>
        <p className="text-[11px] text-green-600">
          +180.1% <span className="text-muted-foreground">from last month</span>
        </p>

        <div className="mt-3 flex h-24 items-end gap-1.5">
          {dailyActive.map((value, index) => (
            <div
              key={index}
              className="flex flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[10px] font-medium text-muted-foreground">
                {value}
              </span>
              <div
                className="w-full rounded-sm bg-primary"
                style={{ height: `${(value / max) * 64}px` }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

function NotificationsCard({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  return (
    <Card className={CARD}>
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardDescription className="text-xs font-medium text-foreground">
          Notifications
        </CardDescription>
        <Badge variant="secondary" className="h-5 px-2 text-[10px]">
          {notifications.length}
        </Badge>
      </CardHeader>

      <CardContent className="px-4">
        <ScrollArea className="h-36">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            <ul className="space-y-2 pr-3">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-2 px-3 py-2 ${INNER}`}
                >
                  <span className="mt-0.5 rounded-full bg-primary/10 p-1 text-primary">
                    {item.message.startsWith("Project") ? (
                      <FolderPlus className="h-3 w-3" />
                    ) : (
                      <Bell className="h-3 w-3" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Project deadline calendar                                           */
/* ------------------------------------------------------------------ */

function DeadlineCalendarCard({
  projects,
  loading,
  error,
  onOpenProject,
}: {
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
        [...items].sort((a, b) =>
          a.projectName.localeCompare(b.projectName),
        ),
      );
    }

    return groups;
  }, [projects]);

  const calendarDates = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    // Keep the calendar at its original full six-week size.
    const totalCells = 42;

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
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1,
        ),
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
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 pb-0">
        <div className="min-w-0">
          <CardTitle className="text-sm">Project deadlines</CardTitle>
          <CardDescription className="text-xs">
            Select a highlighted date to view due projects.
          </CardDescription>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {deadlinesByDate.size}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <div className="flex items-center justify-between gap-2">
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
            const isCurrentMonth =
              date.getMonth() === viewMonth.getMonth();
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
                  isToday && !isSelected
                    ? "ring-1 ring-primary/50"
                    : "",
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

/* Website analytics (stats + line chart)                              */
/* ------------------------------------------------------------------ */

function AnalyticsCard() {
  // Build the line chart path
  const width = 600;
  const height = 120;
  const pad = 10;
  const max = Math.max(...trend);
  const min = Math.min(...trend);

  const points = trend.map((value, index) => ({
    x: pad + (index / (trend.length - 1)) * (width - pad * 2),
    y: height - pad - ((value - min) / (max - min)) * (height - pad * 2),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <Card className={`${CARD} lg:col-span-2`}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Website Analytics</CardTitle>
        <CardDescription className="text-xs">
          Your traffic is ahead of where it normally is.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((stat) => {
            const positive = stat.change >= 0;

            return (
              <div key={stat.label} className={`px-3 py-2 ${INNER}`}>
                <p className="truncate text-[11px] text-muted-foreground">
                  {stat.label}
                </p>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold tracking-tight">
                    {stat.value}
                  </span>
                  <span
                    className={
                      positive
                        ? "text-[11px] font-medium text-green-600"
                        : "text-[11px] font-medium text-red-600"
                    }
                  >
                    {positive ? "+" : ""}
                    {stat.change}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`p-2 ${INNER}`}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label="Traffic trend"
          >
            <path d={area} className="fill-primary/10" />
            <path
              d={line}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-primary"
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                className="fill-background stroke-primary"
                strokeWidth={1.5}
              />
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}