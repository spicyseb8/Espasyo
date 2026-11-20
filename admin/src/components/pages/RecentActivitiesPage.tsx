import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarDays, ChevronDown, Filter, RotateCcw } from "lucide-react";

import {
  getAdminActivityPage,
  type ActivityRecord,
} from "@/services/activityService";

const categories = [
  "All Activities",
  "Accounts",
  "Projects",
  "Floor Plans",
  "Submissions",
  "Approvals",
  "Revisions",
  "Administrative Actions",
];

const actionCategories: Record<string, string> = {
  "account-created": "Accounts",
  "account-updated": "Accounts",
  "account-suspended": "Accounts",
  "account-reactivated": "Accounts",
  "project-assigned": "Projects",
  "floor-plan-published": "Floor Plans",
  "floor-plan-updated": "Floor Plans",
  "design-saved": "Projects",
  "design-version-created": "Projects",
  "project-opened": "Projects",
  "project-acknowledged": "Projects",
  "submission-agreement-acknowledged": "Submissions",
  "project-submitted": "Submissions",
  "project-resubmitted": "Submissions",
  "project-approved": "Approvals",
  "revision-requested": "Revisions",
  "project-made-public": "Administrative Actions",
  "project-made-private": "Administrative Actions",
  "deadline-created": "Administrative Actions",
  "deadline-changed": "Administrative Actions",
};

const actionDescriptions: Record<string, string> = {
  "account-created": "Created an account",
  "account-updated": "Updated an account",
  "account-suspended": "Suspended an account",
  "account-reactivated": "Reactivated an account",
  "project-assigned": "Assigned a project",
  "floor-plan-published": "Published a floor plan",
  "floor-plan-updated": "Updated a floor plan",
  "design-saved": "Saved a project design",
  "design-version-created": "Created a project design version",
  "project-opened": "Opened a project",
  "project-acknowledged": "Acknowledged project access",
  "submission-agreement-acknowledged": "Acknowledged the submission agreement",
  "project-submitted": "Submitted a project for review",
  "project-resubmitted": "Resubmitted a project for review",
  "project-approved": "Approved a project",
  "revision-requested": "Requested project revisions",
  "project-made-public": "Made a project public",
  "project-made-private": "Made a project private",
  "deadline-created": "Set a project deadline",
  "deadline-changed": "Changed a project deadline",
};

interface ActivityFeedState {
  filterKey: string;
  activities: ActivityRecord[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
}

function createActivityFeedState(filterKey: string): ActivityFeedState {
  return {
    filterKey,
    activities: [],
    cursor: null,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: "",
  };
}

function getActivityCategory(activity: ActivityRecord) {
  return actionCategories[activity.activityType ?? activity.action] ?? "Administrative Actions";
}

function getActivityDescription(activity: ActivityRecord) {
  const action = activity.activityType ?? activity.action;
  const description = actionDescriptions[action] ?? activity.description ?? action.replaceAll("-", " ");
  const project = activity.projectName || activity.projectId;
  return project ? `${description} · ${project}` : description;
}

function activityDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateGroupKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatGroupDate(key: string) {
  const date = new Date(`${key}T12:00:00+08:00`);
  const today = dateGroupKey(new Date());
  const yesterday = dateGroupKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatActivityTime(date: Date) {
  return date.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecentActivitiesPage() {
  const [category, setCategory] = useState("All Activities");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filterKey = `${from}\0${to}`;
  const filterKeyRef = useRef("\0");
  const [feed, setFeed] = useState<ActivityFeedState>(() => createActivityFeedState(""));
  const currentFeed = feed.filterKey === filterKey
    ? feed
    : createActivityFeedState(filterKey);

  useEffect(() => {
    let active = true;
    void getAdminActivityPage({ from: from || undefined, to: to || undefined })
      .then(page => {
        if (!active) return;
        setFeed({
          filterKey,
          activities: page.items,
          cursor: page.nextCursor,
          hasMore: page.hasMore,
          loading: false,
          loadingMore: false,
          error: "",
        });
      })
      .catch(loadError => {
        if (!active) return;
        console.error("Unable to load platform activities:", loadError);
        setFeed({
          ...createActivityFeedState(filterKey),
          loading: false,
          error: "Unable to load activity history. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [from, to, filterKey]);

  const loadMore = useCallback(async () => {
    if (!currentFeed.cursor || currentFeed.loadingMore) return;
    setFeed(previous => previous.filterKey === filterKey
      ? { ...previous, loadingMore: true, error: "" }
      : previous);
    try {
      const page = await getAdminActivityPage({
        from: from || undefined,
        to: to || undefined,
        cursor: currentFeed.cursor,
      });
      if (filterKeyRef.current !== filterKey) return;
      setFeed(previous => {
        if (previous.filterKey !== filterKey) return previous;
        const byId = new Map(previous.activities.map(activity => [activity.id, activity]));
        page.items.forEach(activity => byId.set(activity.id, activity));
        return {
          ...previous,
          activities: [...byId.values()].sort(
            (first, second) =>
              (activityDate(second.createdAt)?.getTime() ?? 0) -
              (activityDate(first.createdAt)?.getTime() ?? 0),
          ),
          cursor: page.nextCursor,
          hasMore: page.hasMore,
        };
      });
    } catch (loadError) {
      if (filterKeyRef.current !== filterKey) return;
      console.error("Unable to load more platform activities:", loadError);
      setFeed(previous => previous.filterKey === filterKey
        ? { ...previous, error: "Unable to load more activity. Please try again." }
        : previous);
    } finally {
      setFeed(previous => previous.filterKey === filterKey
        ? { ...previous, loadingMore: false }
        : previous);
    }
  }, [currentFeed.cursor, currentFeed.loadingMore, from, to, filterKey]);

  const handleFromChange = (value: string) => {
    filterKeyRef.current = `${value}\0${to}`;
    setFrom(value);
  };

  const handleToChange = (value: string) => {
    filterKeyRef.current = `${from}\0${value}`;
    setTo(value);
  };

  const visibleActivities = useMemo(
    () => currentFeed.activities.filter(activity => {
      const action = activity.activityType ?? activity.action;
      return action !== "admin-comment-added" &&
        (category === "All Activities" || getActivityCategory(activity) === category);
    }
    ),
    [currentFeed.activities, category],
  );
  const groups = useMemo(() => {
    const grouped = new Map<string, ActivityRecord[]>();
    visibleActivities.forEach(activity => {
      const date = activityDate(activity.createdAt);
      const key = date ? dateGroupKey(date) : "unknown";
      const values = grouped.get(key) ?? [];
      values.push(activity);
      grouped.set(key, values);
    });
    return [...grouped.entries()];
  }, [visibleActivities]);

  const clearFilters = () => {
    filterKeyRef.current = "\0";
    setCategory("All Activities");
    setFrom("");
    setTo("");
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            Platform history
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Recent Activities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A chronological history of meaningful platform activity.
          </p>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          Clear filters
        </button>
      </header>

      <section aria-label="Activity filters" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-4">
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Category</span>
          <span className="relative">
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
              className="h-9 min-w-48 appearance-none rounded-md border border-border bg-background px-3 pr-8 text-sm text-foreground"
            >
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4" />
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />From (Manila)</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={event => handleFromChange(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />To (Manila)</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={event => handleToChange(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      </section>

      {currentFeed.error && <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{currentFeed.error}</p>}

      {currentFeed.loading ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground" aria-busy="true">
          Loading activity history…
        </div>
      ) : visibleActivities.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          {currentFeed.activities.length ? "No activities match these filters." : "No activities recorded yet."}
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map(([key, group]) => (
            <section key={key} aria-label={key === "unknown" ? "Date unavailable" : formatGroupDate(key)}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {key === "unknown" ? "Date unavailable" : formatGroupDate(key)}
              </h2>
              <div className="divide-y divide-border rounded-lg border border-border bg-background">
                {group.map(activity => {
                  const date = activityDate(activity.createdAt);
                  return (
                    <article key={activity.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{getActivityDescription(activity)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activity.actorName || (activity.actorRole === "client" ? "Client" : "System")}
                          {activity.actorRole ? ` · ${activity.actorRole}` : ""}
                          {activity.targetUserUid && activity.targetUserUid !== activity.actorUid
                            ? ` · ${activity.targetName || `Account ${activity.targetUserUid}`}`
                            : ""}
                        </p>
                      </div>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={activity.createdAt ?? undefined}
                      >
                        {date ? formatActivityTime(date) : "Time unavailable"}
                      </time>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {currentFeed.hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={currentFeed.loadingMore}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {currentFeed.loadingMore ? "Loading…" : "Load More Activities"}
          </button>
        </div>
      )}
    </main>
  );
}
