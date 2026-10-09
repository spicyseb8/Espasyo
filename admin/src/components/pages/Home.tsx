import { useState } from "react";
import {
  Bell,
  CalendarDays,
  Clock,
  FolderPlus,
  Plus,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { Separator } from "@/components/ui/separator";

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

interface Note {
  id: string;
  text: string;
  createdAt: Date;
}

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

const initialNotes: Note[] = [
  { id: "n1", text: "Review pending project requests", createdAt: new Date(2026, 9, 8) },
  { id: "n2", text: "Staff meeting at 2 PM", createdAt: new Date(2026, 9, 1) },
  { id: "n3", text: "Inventory check", createdAt: new Date(2026, 8, 16) },
];

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

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const timeAgo = (date: Date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user } = useAuth();
  const userName = user?.displayName || user?.email?.split("@")[0] || "Admin";

  const [notifications, setNotifications] =
    useState<AppNotification[]>(initialNotifications);

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <HelloCard
          userName={userName}
          onProjectCreated={handleProjectCreated}
        />
        <DailyActiveCard />
        <NotificationsCard notifications={notifications} />
      </div>

      {/* Row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <NotesCard />
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

        <CardContent className="flex flex-1 flex-col justify-between gap-4 px-4">
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
/* Notes                                                               */
/* ------------------------------------------------------------------ */

function NotesCard() {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;

    setNotes((prev) => [
      { id: crypto.randomUUID(), text, createdAt: new Date() },
      ...prev,
    ]);
    setDraft("");
  };

  const removeNote = (id: string) =>
    setNotes((prev) => prev.filter((note) => note.id !== id));

  return (
    <Card className={CARD}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Notes</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4">
        <ScrollArea className={`h-44 ${INNER} bg-background`}>
          {notes.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No notes yet.
            </p>
          ) : (
            <ul className="px-3">
              {notes.map((note, index) => (
                <li key={note.id}>
                  <div className="group flex items-center justify-between gap-2 py-2">
                    <span className="truncate text-xs font-medium">
                      {note.text}
                    </span>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDate(note.createdAt)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeNote(note.id)}
                        aria-label="Delete note"
                        className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {index < notes.length - 1 && (
                    <Separator className="bg-border" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div
          className={`flex items-center gap-1 rounded-lg pl-3 pr-1 ${CONTROL}`}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addNote();
            }}
            placeholder="Add a new note"
            className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={addNote}
            disabled={!draft.trim()}
          >
            <PlusCircle className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
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