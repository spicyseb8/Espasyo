import { useEffect, useMemo, useRef, useState } from "react";
import { collectionGroup, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Bell, BellOff, CheckCheck, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/firebase/firebase";
import "./NotificationCenter.css";

type NotificationRecord = {
  notificationId: string; recipientUid: string; title: string; message: string;
  actorName?: string; category: string; targetType?: string; targetId?: string;
  projectId?: string | null; read: boolean; createdAt?: { toDate?: () => Date };
};

const categories = ["All", "Accounts", "Projects", "Assets", "Deadlines"];

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
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"all" | "unread">("all");

  useEffect(() => {
    setLoadState("loading");
    return onSnapshot(
      query(collectionGroup(db, "recipients"), where("recipientUid", "==", uid)),
      snapshot => {
        setItems(
          snapshot.docs
            .map(item => item.data() as NotificationRecord)
            .sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0))
        );
        setLoadState("loaded");
      },
      error => {
        console.error("[Client notifications] Listener failed", { code: error.code, message: error.message });
        setLoadState("error");
      }
    );
  }, [uid, retryKey]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadCount = items.filter(item => !item.read).length;
  const visible = useMemo(
    () => items.filter(item => (category === "All" || item.category === category) && (tab === "all" || !item.read)),
    [items, category, tab]
  );

  const markRead = async (item: NotificationRecord) => {
    if (item.read) return;
    try {
      await updateDoc(doc(db, "notifications", item.notificationId, "recipients", uid), { read: true, readAt: serverTimestamp() });
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    }
  };
  const markAllRead = async () => { await Promise.all(items.filter(item => !item.read).map(markRead)); };

  const openItem = async (item: NotificationRecord) => {
    await markRead(item);
    setOpen(false);
    if (item.targetType === "account") navigate("/settings");
    else if (item.projectId || item.targetType === "project") navigate("/studio");
    else navigate("/library");
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className="notification-bell"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-panel" aria-label="Notification history">
          <header>
            <strong>Notifications</strong>
            <button type="button" onClick={markAllRead} disabled={!unreadCount} title="Mark all as read">
              <CheckCheck size={14} /> Mark all read
            </button>
          </header>

          <div className="notification-filters">
            <div className="notification-tabs" role="tablist" aria-label="Read status">
              <button type="button" role="tab" aria-selected={tab === "all"} className={tab === "all" ? "is-active" : ""} onClick={() => setTab("all")}>All</button>
              <button type="button" role="tab" aria-selected={tab === "unread"} className={tab === "unread" ? "is-active" : ""} onClick={() => setTab("unread")}>Unread</button>
            </div>
            <select aria-label="Filter category" value={category} onChange={event => setCategory(event.target.value)}>
              {categories.map(value => <option key={value} value={value}>{value === "All" ? "All categories" : value}</option>)}
            </select>
          </div>

          <div className="notification-list">
            {loadState === "loading" ? (
              <div className="notification-skeletons" aria-busy="true" aria-label="Loading notifications">
                {[0, 1].map(n => <div key={n} className="notification-skeleton" />)}
              </div>
            ) : loadState === "error" ? (
              <div className="notification-state" role="alert">
                <AlertCircle size={22} />
                <span>Couldn't load notifications.</span>
                <button type="button" onClick={() => setRetryKey(key => key + 1)}>Retry</button>
              </div>
            ) : visible.length === 0 ? (
              <div className="notification-state">
                <BellOff size={22} />
                <span>{items.length === 0 ? "You're all caught up" : "No notifications here"}</span>
              </div>
            ) : (
              visible.map(item => (
                <button
                  key={item.notificationId}
                  type="button"
                  className={`notification-item${item.read ? "" : " is-unread"}`}
                  onClick={() => void openItem(item)}
                >
                  <span className="notification-copy">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{timeAgo(item.createdAt?.toDate?.())}</small>
                  </span>
                  {!item.read && <span className="notification-dot" role="img" aria-label="Unread" />}
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}