import { useEffect, useMemo, useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { AlertCircle, Bell, BellOff, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/firebase/firebase";
import {
  useRecipientNotificationFeed,
  type RecipientFeedRow,
} from "@/hooks/useRecipientNotificationFeed";

type NotificationRecord = RecipientFeedRow & {
  notificationId: string;
  recipientUid: string;
  title: string;
  message: string;
  actorName?: string;
  clientName?: string;
  eventType?: string;
  type?: string;
  category: string;
  targetType?: string;
  targetId?: string;
  projectId?: string;
  assetType?: string;
  createdAt?: { toDate?: () => Date };
  lastActivityAt?: { toDate?: () => Date };
};
const categories = ["All", "Accounts", "Projects", "Assets", "Deadlines"];

function isRead(item: NotificationRecord) {
  return item.read ?? item.isRead ?? false;
}

function getActivityDate(item: NotificationRecord) {
  return item.lastActivityAt?.toDate?.() ?? item.createdAt?.toDate?.();
}

function isClientProjectActivity(item: NotificationRecord) {
  return ["project_updated", "project_opened"].includes(item.type ?? "") ||
    ["project-updated", "project-opened"].includes(item.eventType ?? "");
}

function getClientName(item: NotificationRecord) {
  const name = item.clientName?.trim() || item.actorName?.trim();
  return name && !/^(client|unknown client|espasyo)$/i.test(name)
    ? name
    : "Unknown client";
}

function getNotificationTitle(item: NotificationRecord) {
  if (!isClientProjectActivity(item)) return item.title;
  const action = item.type === "project_opened" || item.eventType === "project-opened"
    ? "opened"
    : "updated";
  return `${getClientName(item)} ${action} a project`;
}

function getNotificationMessage(item: NotificationRecord) {
  if (!isClientProjectActivity(item)) return item.message;
  const clientName = getClientName(item);
  if (item.message.startsWith(`${clientName} `)) return item.message;
  const match = item.message.match(/^(?:client|unknown client|espasyo)\s+(updated|opened)\s+(.+)$/i);
  return match ? `${clientName} ${match[1].toLowerCase()} ${match[2]}` : item.message;
}

function timeAgo(date?: Date) {
  if (!date) return "Just now";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationCenter({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    mode,
    changeMode,
    items,
    unreadCount,
    loadState,
    retry,
    pageError,
    actionError,
    loadingMore,
    markingAllRead,
    hasMore,
    loadMore,
    markAllRead,
  } = useRecipientNotificationFeed<NotificationRecord>(db, uid, 20);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"all" | "unread">("all");

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const visible = useMemo(
    () => items.filter(item => (category === "All" || item.category === category) && (tab === "all" || !isRead(item))),
    [items, category, tab]
  );

  const markRead = async (item: NotificationRecord) => {
    if (isRead(item)) return;
    try { await updateDoc(doc(db, "notifications", item.notificationId, "recipients", uid), { read: true, readAt: serverTimestamp() }); }
    catch (error) { console.error("Unable to mark notification as read:", error); }
  };
  const hasUnreadInCurrentFeed = items.some(item => !isRead(item));

  const openItem = async (item: NotificationRecord) => {
    await markRead(item); setOpen(false);
    const target = item.targetType === "account" ? "customers" : item.targetType === "asset" ? (item.assetType === "floor" ? "floors" : item.assetType === "wall" ? "walls" : "furniture") : item.category === "Projects" || item.category === "Deadlines" ? "projects" : "dashboard";
    navigate(target === "dashboard" ? "/" : `/?tab=${target}`);
  };

  const tabClass = (active: boolean) => `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`;

  return <div className="relative" ref={rootRef}>
    <button type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)} className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>

    {open && <section aria-label="Notification history" className="absolute right-0 top-11 z-[70] flex max-h-[min(400px,70vh)] w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <strong className="text-sm font-semibold">Notifications</strong>
        <button type="button" onClick={() => void markAllRead()} disabled={!hasUnreadInCurrentFeed || markingAllRead} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
          <CheckCheck className="h-3.5 w-3.5" />Mark all read
        </button>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex gap-1" role="tablist" aria-label="Read status">
          <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={tabClass(tab === "all")}>All</button>
          <button type="button" role="tab" aria-selected={tab === "unread"} onClick={() => setTab("unread")} className={tabClass(tab === "unread")}>Unread</button>
        </div>
        <select aria-label="Filter category" value={category} onChange={event => setCategory(event.target.value)} className="h-8 max-w-[50%] rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {categories.map(value => <option key={value} value={value}>{value === "All" ? "All categories" : value}</option>)}
        </select>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => changeMode(mode === "today" ? "recent" : "today")}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "today" ? "View Recent Notifications" : "Today's Notifications"}
        </button>
        {hasMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load More"}
          </button>
        )}
      </div>

      {/* min-h-0 + flex-1 lets this area shrink and scroll inside the panel */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loadState === "loading" ? (
          <div aria-busy="true" aria-label="Loading notifications" className="grid gap-2 p-3">
            {[0, 1].map(n => <div key={n} className="h-14 animate-pulse rounded-md bg-muted" />)}
          </div>
        ) : loadState === "error" ? (
          <div role="alert" className="grid justify-items-center gap-1.5 px-5 py-8 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span>Couldn't load notifications.</span>
            <button type="button" onClick={retry} className="mt-1 rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-muted">Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="grid justify-items-center gap-1.5 px-5 py-8 text-center text-sm text-muted-foreground">
            <BellOff className="h-5 w-5" />
            <span>{items.length === 0 ? mode === "today" ? "No notifications today." : "No recent notifications." : "No notifications here"}</span>
          </div>
        ) : visible.map(item => (
          <button key={item.notificationId} type="button" onClick={() => void openItem(item)}
            className={`flex w-full items-start justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${isRead(item) ? "hover:bg-muted/50" : "bg-muted/40 hover:bg-muted/70"}`}>
            <span className="grid min-w-0 gap-0.5">
              <strong className={`text-sm ${isRead(item) ? "font-normal text-muted-foreground" : "font-semibold text-foreground"}`}>{getNotificationTitle(item)}</strong>
              <span className={`line-clamp-2 break-words text-xs ${isRead(item) ? "text-muted-foreground/80" : "text-muted-foreground"}`}>{getNotificationMessage(item)}</span>
              <small className="mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(getActivityDate(item))}</small>
            </span>
            {!isRead(item) && <span role="img" aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />}
          </button>
        ))}
      </div>
      {(pageError || actionError) && (
        <div role="alert" className="shrink-0 border-t border-border px-3 py-2 text-xs text-destructive">
          {pageError || actionError}
          {pageError && (
            <button type="button" onClick={() => void loadMore()} className="ml-2 underline">
              Retry
            </button>
          )}
        </div>
      )}
    </section>}
  </div>;
}