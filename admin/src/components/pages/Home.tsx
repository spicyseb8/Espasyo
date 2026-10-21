import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LogIn,
  Settings,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

/* ------------------------------------------------------------------ */
/* Shared line styles (same as UserTable)                              */
/* ------------------------------------------------------------------ */

const CARD =
  "gap-3 rounded-lg border border-border bg-background py-4 shadow-none ring-0";
const INNER = "rounded-lg border border-border bg-muted/40";

/* ------------------------------------------------------------------ */
/* Types + sample data (replace with Firestore data later)             */
/* ------------------------------------------------------------------ */

type ActivityTab = "projects" | "users" | "admins";

interface ActivityItem {
  id: string;
  tab: ActivityTab;
  icon: LucideIcon;
  actor: string;
  action: string;
  createdAt: Date;
}

const minutesAgo = (m: number) => new Date(Date.now() - 1000 * 60 * m);

const sampleActivity: ActivityItem[] = [
  { id: "a1", tab: "users", icon: UserPlus, actor: "Maria Santos", action: "signed up", createdAt: minutesAgo(12) },
  { id: "a2", tab: "users", icon: LogIn, actor: "John Reyes", action: "logged in", createdAt: minutesAgo(45) },
  { id: "a3", tab: "users", icon: UserPlus, actor: "Ana Cruz", action: "signed up", createdAt: minutesAgo(60 * 5) },
  { id: "a4", tab: "users", icon: Settings, actor: "Paolo Lim", action: "updated their profile", createdAt: minutesAgo(60 * 9) },
  { id: "a5", tab: "admins", icon: ShieldCheck, actor: "Admin Dela Cruz", action: "granted admin access to Ken Tan", createdAt: minutesAgo(30) },
  { id: "a6", tab: "admins", icon: Settings, actor: "Admin Rivera", action: "changed workspace settings", createdAt: minutesAgo(60 * 3) },
  { id: "a7", tab: "admins", icon: LogIn, actor: "Admin Dela Cruz", action: "logged in", createdAt: minutesAgo(60 * 26) },
  { id: "a8", tab: "projects", icon: FolderKanban, actor: "Website redesign", action: "was created", createdAt: minutesAgo(20) },
  { id: "a9", tab: "projects", icon: FolderKanban, actor: "Mobile app v2", action: "deadline was updated", createdAt: minutesAgo(60 * 4) },
  { id: "a10", tab: "projects", icon: FolderKanban, actor: "Brand guidelines", action: "was marked complete", createdAt: minutesAgo(60 * 30) },
];

const TABS: { value: ActivityTab; label: string }[] = [
  { value: "projects", label: "Projects" },
  { value: "users", label: "Users" },
  { value: "admins", label: "Admins" },
];

const timeAgo = (date: Date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

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

  const [deadlineProjects, setDeadlineProjects] = useState<AdminProject[]>([]);
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

  // Last 28 days, ending today
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 27);

  return (
    <div className="space-y-4">
    

      {/* Calendar (with greeting) + big recent activity */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <GreetingCalendarCard
          userName={userName}
          projects={deadlineProjects}
          loading={deadlinesLoading}
          error={deadlinesError}
          onOpenProject={(projectId) => navigate(`/projects/view/${projectId}`)}
        />
        <RecentActivityCard items={sampleActivity} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recent activity (tabs: Projects / Users / Admins)                   */
/* ------------------------------------------------------------------ */

function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  const [tab, setTab] = useState<ActivityTab>("projects");

  const counts = useMemo(() => {
    const result: Record<ActivityTab, number> = {
      projects: 0,
      users: 0,
      admins: 0,
    };
    for (const item of items) result[item.tab] += 1;
    return result;
  }, [items]);

  const visible = useMemo(
    () =>
      items
        .filter((item) => item.tab === tab)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [items, tab],
  );

  return (
    <Card className={`${CARD} min-w-0 lg:col-span-2`}>
      <CardHeader className="px-4">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription className="text-xs">
          Latest events across your workspace.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Activity type"
          className={`flex w-fit items-center gap-1 rounded-lg p-1 ${INNER}`}
        >
          {TABS.map(({ value, label }) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(value)}
                className={[
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-4 px-1.5 text-[10px]"
                >
                  {counts[value]}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* List */}
        <ScrollArea className="h-[460px] w-full">
          {visible.length === 0 ? (
            <p className="py-16 text-center text-xs text-muted-foreground">
              No recent activity yet.
            </p>
          ) : (
            <ul role="tabpanel" className="space-y-2 pr-3">
              {visible.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-3 ${INNER}`}
                  >
                    <span className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>

                    <p className="min-w-0 flex-1 text-sm leading-snug">
                      <span className="font-medium">{item.actor}</span>{" "}
                      <span className="text-muted-foreground">
                        {item.action}
                      </span>
                    </p>

                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(item.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
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