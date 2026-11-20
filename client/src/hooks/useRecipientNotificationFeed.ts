import { useCallback, useEffect, useRef, useState } from "react";
import {
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";

import { getManilaDateBounds, getManilaDateKey } from "../../../shared/notifications/manilaTime.mjs";

export type RecipientFeedMode = "today" | "recent";
export type RecipientFeedRow = Record<string, unknown> & {
  notificationId?: string;
  recipientUid?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt?: unknown;
};

interface FeedState<T> {
  key: string;
  items: T[];
  loadState: "loading" | "loaded" | "error";
  hasMore: boolean;
  liveLimit: number;
  pageError: string;
  actionError: string;
  loadingMore: boolean;
  markingAllRead: boolean;
}

function createFeedState<T>(key: string, pageSize: number): FeedState<T> {
  return {
    key,
    items: [],
    loadState: "loading",
    hasMore: false,
    liveLimit: pageSize,
    pageError: "",
    actionError: "",
    loadingMore: false,
    markingAllRead: false,
  };
}

function createRecipientFeedQuery(
  db: Firestore,
  uid: string,
  mode: RecipientFeedMode,
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
  unreadOnly = false,
) {
  const { start, end } = getManilaDateBounds();
  const constraints: QueryConstraint[] = [where("recipientUid", "==", uid)];
  if (unreadOnly) constraints.push(where("read", "==", false));
  if (mode === "today") {
    constraints.push(
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<", Timestamp.fromDate(end)),
    );
  } else {
    constraints.push(where("createdAt", "<", Timestamp.fromDate(start)));
  }
  constraints.push(orderBy("createdAt", "desc"));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  return query(collectionGroup(db, "recipients"), ...constraints);
}

function getFeedRow<T extends RecipientFeedRow>(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): T {
  const data = snapshot.data() as T;
  const notificationId =
    typeof data.notificationId === "string"
      ? data.notificationId
      : snapshot.ref.parent.parent?.id;
  return { ...data, ...(notificationId ? { notificationId } : {}) } as T;
}

function getFeedRowTime(value: RecipientFeedRow): number {
  const createdAt = value.createdAt;
  if (
    createdAt &&
    typeof createdAt === "object" &&
    "toMillis" in createdAt &&
    typeof createdAt.toMillis === "function"
  ) {
    return createdAt.toMillis();
  }
  if (createdAt instanceof Date) return createdAt.getTime();
  return 0;
}

function mergeRows<T extends RecipientFeedRow>(current: T[], incoming: T[]): T[] {
  const rows = new Map<string, T>();
  for (const row of current) {
    if (row.notificationId) rows.set(row.notificationId, row);
  }
  for (const row of incoming) {
    if (row.notificationId) rows.set(row.notificationId, row);
  }
  return [...rows.values()].sort(
    (first, second) => getFeedRowTime(second) - getFeedRowTime(first),
  );
}

export function useRecipientNotificationFeed<T extends RecipientFeedRow>(
  db: Firestore,
  uid: string,
  pageSize: number,
) {
  const [mode, setMode] = useState<RecipientFeedMode>("today");
  const [retryKey, setRetryKey] = useState(0);
  const [dayKey, setDayKey] = useState(() => getManilaDateKey());
  const feedKey = `${uid}\0${mode}\0${dayKey}\0${retryKey}`;
  const [feedState, setFeedState] = useState<FeedState<T>>(() => createFeedState("", pageSize));
  const [todayBadgeState, setTodayBadgeState] = useState<{ key: string; items: T[] }>({
    key: "",
    items: [],
  });
  const cursorRef = useRef<{
    key: string;
    cursor: QueryDocumentSnapshot<DocumentData> | null;
  } | null>(null);
  const currentFeed = feedState.key === feedKey
    ? feedState
    : createFeedState<T>(feedKey, pageSize);
  const updateFeedState = useCallback((
    update: (current: FeedState<T>) => FeedState<T>,
  ) => {
    setFeedState(previous => update(
      previous.key === feedKey
        ? previous
        : createFeedState<T>(feedKey, pageSize),
    ));
  }, [feedKey, pageSize]);
  const todayBadgeKey = `${uid}\0${dayKey}`;

  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      const currentDayKey = getManilaDateKey();
      setDayKey(previous => previous === currentDayKey ? previous : currentDayKey);
    }, 60_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    if (cursorRef.current?.key !== feedKey) {
      cursorRef.current = { key: feedKey, cursor: null };
    }
    const unsubscribe = onSnapshot(
      createRecipientFeedQuery(db, uid, mode, currentFeed.liveLimit),
      snapshot => {
        if (!active) return;
        const rows = snapshot.docs.map(value => getFeedRow<T>(value));
        cursorRef.current = {
          key: feedKey,
          cursor: snapshot.docs[snapshot.docs.length - 1] ?? null,
        };
        updateFeedState(previous => ({
          ...previous,
          items: rows,
          loadState: "loaded",
          hasMore: currentFeed.liveLimit === pageSize
            ? snapshot.size === currentFeed.liveLimit
            : previous.hasMore,
        }));
      },
      error => {
        if (!active) return;
        console.error("[Notifications] Listener failed", {
          code: error.code,
          message: error.message,
        });
        updateFeedState(previous => ({ ...previous, loadState: "error" }));
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [db, uid, mode, pageSize, dayKey, retryKey, feedKey, currentFeed.liveLimit, updateFeedState]);

  useEffect(() => {
    if (!uid || mode !== "recent") return;
    return onSnapshot(
      createRecipientFeedQuery(db, uid, "today", pageSize),
      snapshot => setTodayBadgeState({
        key: todayBadgeKey,
        items: snapshot.docs.map(value => getFeedRow<T>(value)),
      }),
      error => {
        console.error("[Notifications] Today's unread-count listener failed", {
          code: error.code,
          message: error.message,
        });
      },
    );
  }, [db, uid, mode, pageSize, dayKey, retryKey, todayBadgeKey]);

  const changeMode = useCallback((nextMode: RecipientFeedMode) => {
    if (nextMode !== mode) setMode(nextMode);
  }, [mode]);

  const retry = useCallback(() => {
    setRetryKey(key => key + 1);
  }, []);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current?.key === feedKey ? cursorRef.current.cursor : null;
    if (!uid || !cursor || currentFeed.loadingMore || !currentFeed.hasMore) return;
    updateFeedState(previous => ({ ...previous, loadingMore: true, pageError: "" }));
    try {
      const page: QuerySnapshot<DocumentData> = await getDocs(
        createRecipientFeedQuery(db, uid, mode, pageSize, cursor),
      );
      const rows = page.docs.map(value => getFeedRow<T>(value));
      const lastDocument = page.docs[page.docs.length - 1] ?? null;
      if (cursorRef.current?.key === feedKey && lastDocument) {
        cursorRef.current = { key: feedKey, cursor: lastDocument };
      }
      updateFeedState(previous => ({
        ...previous,
        items: mergeRows(previous.items, rows),
        liveLimit: previous.liveLimit + page.docs.length,
        hasMore: page.docs.length === pageSize,
      }));
    } catch (error) {
      console.error("[Notifications] Unable to load another page:", error);
      updateFeedState(previous => ({
        ...previous,
        pageError: "Couldn't load more notifications. Please try again.",
      }));
    } finally {
      updateFeedState(previous => ({ ...previous, loadingMore: false }));
    }
  }, [
    db,
    uid,
    mode,
    pageSize,
    feedKey,
    currentFeed.loadingMore,
    currentFeed.hasMore,
    updateFeedState,
  ]);

  const markAllRead = useCallback(async () => {
    if (!uid || currentFeed.markingAllRead) return;
    updateFeedState(previous => ({ ...previous, markingAllRead: true, actionError: "" }));
    try {
      let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
      while (true) {
        const page: QuerySnapshot<DocumentData> = await getDocs(
          createRecipientFeedQuery(db, uid, mode, 450, cursor, true),
        );
        if (!page.docs.length) break;
        const batch = writeBatch(db);
        page.docs.forEach((snapshot: QueryDocumentSnapshot<DocumentData>) => {
          batch.update(snapshot.ref, {
            read: true,
            readAt: serverTimestamp(),
          });
        });
        await batch.commit();
        cursor = page.docs[page.docs.length - 1];
        if (page.docs.length < 450) break;
      }
    } catch (error) {
      console.error("[Notifications] Unable to mark all as read:", error);
      updateFeedState(previous => ({
        ...previous,
        actionError: "Couldn't mark all notifications as read. Please try again.",
      }));
    } finally {
      updateFeedState(previous => ({ ...previous, markingAllRead: false }));
    }
  }, [db, uid, mode, currentFeed.markingAllRead, updateFeedState]);

  const todayBadgeItems = todayBadgeState.key === todayBadgeKey
    ? todayBadgeState.items
    : [];
  const badgeItems = mode === "today" ? currentFeed.items : todayBadgeItems;
  const unreadCount = badgeItems.filter(item => item.read !== true && item.isRead !== true).length;

  return {
    mode,
    changeMode,
    items: currentFeed.items,
    unreadCount,
    loadState: uid ? currentFeed.loadState : "loaded" as const,
    retry,
    pageError: currentFeed.pageError,
    actionError: currentFeed.actionError,
    loadingMore: currentFeed.loadingMore,
    markingAllRead: currentFeed.markingAllRead,
    hasMore: currentFeed.hasMore,
    loadMore,
    markAllRead,
  };
}
