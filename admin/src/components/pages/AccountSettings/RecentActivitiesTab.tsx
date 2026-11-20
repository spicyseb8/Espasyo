import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  getAdminActivityPage,
  type ActivityRecord,
} from "@/services/activityService";

interface RecentActivitiesTabProps {
  userUid: string;
  displayName?: string;
}

interface ActivityFeedState {
  userUid: string;
  activities: ActivityRecord[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
}

function createActivityFeedState(userUid: string, loading = true): ActivityFeedState {
  return {
    userUid,
    activities: [],
    cursor: null,
    hasMore: false,
    loading,
    loadingMore: false,
    error: "",
  };
}

function activityDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getActivityText(activity: ActivityRecord, displayName?: string) {
  if (activity.description?.trim()) return activity.description;
  const action = (activity.activityType ?? activity.action).replaceAll("-", " ");
  const actor = activity.actorName || displayName || "Account";
  const project = activity.projectName || activity.projectId;
  return `${actor} ${action}${project ? ` - ${project}` : ""}`;
}

export default function RecentActivitiesTab({
  userUid,
  displayName,
}: RecentActivitiesTabProps) {
  const [feed, setFeed] = useState<ActivityFeedState>(() => createActivityFeedState(""));
  const currentFeed = feed.userUid === userUid
    ? feed
    : createActivityFeedState(userUid);

  useEffect(() => {
    if (!userUid) return;
    let active = true;
    void getAdminActivityPage({ userUid })
      .then(page => {
        if (!active) return;
        setFeed({
          userUid,
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
        console.error("Unable to load account activity:", loadError);
        setFeed({
          ...createActivityFeedState(userUid, false),
          error: "Unable to load this account's activity.",
        });
      });

    return () => {
      active = false;
    };
  }, [userUid]);

  const loadMore = useCallback(async () => {
    if (!currentFeed.cursor || currentFeed.loadingMore) return;
    setFeed(previous => ({
      ...(previous.userUid === userUid ? previous : currentFeed),
      loadingMore: true,
      error: "",
    }));
    try {
      const page = await getAdminActivityPage({
        userUid,
        cursor: currentFeed.cursor,
      });
      setFeed(previous => {
        if (previous.userUid !== userUid) return previous;
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
      console.error("Unable to load more account activity:", loadError);
      setFeed(previous => previous.userUid === userUid
        ? { ...previous, error: "Unable to load more activity. Please try again." }
        : previous);
    } finally {
      setFeed(previous => previous.userUid === userUid
        ? { ...previous, loadingMore: false }
        : previous);
    }
  }, [currentFeed, userUid]);

  if (!userUid) {
    return <p role="alert" className="max-w-2xl rounded-lg border border-zinc-800 px-4 py-3 text-sm text-destructive">This account has no Firebase UID.</p>;
  }
  if (currentFeed.loading) {
    return <div className="max-w-2xl rounded-lg border border-zinc-800 p-6 text-sm text-muted-foreground" aria-busy="true">Loading activity…</div>;
  }

  return (
    <div className="max-w-2xl rounded-lg border border-zinc-800">
      {currentFeed.error && <p role="alert" className="px-4 py-3 text-sm text-destructive">{currentFeed.error}</p>}
      {!currentFeed.error && currentFeed.activities.length === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground">No activity recorded for this account.</p>
      )}
      {currentFeed.activities.map((activity, index) => {
        const date = activityDate(activity.createdAt);
        return (
          <div key={activity.id}>
            <article className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block break-words">{getActivityText(activity, displayName)}</span>
                {activity.projectId && activity.description && (
                  <span className="mt-1 block text-xs text-muted-foreground">Project {activity.projectId}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                <time dateTime={activity.createdAt ?? undefined}>
                  {date
                    ? date.toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Time unavailable"}
                </time>
                <ChevronRight className="h-4 w-4" />
              </span>
            </article>
            {index < currentFeed.activities.length - 1 && <Separator className="bg-zinc-800" />}
          </div>
        );
      })}
      {currentFeed.hasMore && (
        <div className="border-t border-zinc-800 p-3 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={currentFeed.loadingMore}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {currentFeed.loadingMore ? "Loading…" : "Load More Activities"}
          </button>
        </div>
      )}
    </div>
  );
}
