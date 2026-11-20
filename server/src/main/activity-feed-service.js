import { FieldPath, Filter, Timestamp } from "firebase-admin/firestore";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export function parseActivityPageSize(value) {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
    const error = new Error(`Activity page size must be between 1 and ${MAX_PAGE_SIZE}.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

export function parseManilaDateBoundary(value, endOfDay = false) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error("Activity date filters must use YYYY-MM-DD.");
    error.status = 400;
    throw error;
  }

  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const date = new Date(`${value}T00:00:00+08:00`);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    const error = new Error("Activity date filter is not a valid calendar date.");
    error.status = 400;
    throw error;
  }
  return endOfDay ? new Date(date.getTime() + 24 * 60 * 60 * 1000) : date;
}

export function encodeActivityCursor(createdAt, id) {
  const date = createdAt instanceof Date ? createdAt : createdAt?.toDate?.();
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || typeof id !== "string" || !id) {
    throw new TypeError("A valid activity timestamp and document ID are required.");
  }
  return Buffer.from(JSON.stringify({ createdAt: date.toISOString(), id })).toString("base64url");
}

export function decodeActivityCursor(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1024) {
    const error = new Error("Activity cursor is invalid.");
    error.status = 400;
    throw error;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const createdAt = new Date(decoded.createdAt);
    if (
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== "string" ||
      !decoded.id
    ) {
      throw new Error("Invalid cursor fields.");
    }
    return { createdAt, id: decoded.id };
  } catch {
    const error = new Error("Activity cursor is invalid.");
    error.status = 400;
    throw error;
  }
}

function timestampToIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  return null;
}

export async function getActivityPage(db, {
  pageSize = DEFAULT_PAGE_SIZE,
  cursor,
  userUid,
  from,
  to,
}) {
  const size = parseActivityPageSize(pageSize);
  const parsedCursor = decodeActivityCursor(cursor);
  const fromDate = parseManilaDateBoundary(from);
  const toDate = parseManilaDateBoundary(to, true);
  if (fromDate && toDate && fromDate >= toDate) {
    const error = new Error("The activity date range is invalid.");
    error.status = 400;
    throw error;
  }

  let activityQuery = db.collection("projectActivity");
  if (userUid) {
    activityQuery = activityQuery.where(Filter.or(
      Filter.where("targetUserUid", "==", userUid),
      Filter.where("actorId", "==", userUid),
    ));
  }
  if (fromDate) activityQuery = activityQuery.where("createdAt", ">=", Timestamp.fromDate(fromDate));
  if (toDate) activityQuery = activityQuery.where("createdAt", "<", Timestamp.fromDate(toDate));
  activityQuery = activityQuery
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  if (parsedCursor) {
    activityQuery = activityQuery.startAfter(
      Timestamp.fromDate(parsedCursor.createdAt),
      parsedCursor.id,
    );
  }

  const snapshot = await activityQuery.limit(size + 1).get();
  const pageDocuments = snapshot.docs.slice(0, size);
  const items = pageDocuments.map(document => {
    const data = document.data();
    return {
      id: document.id,
      ...data,
      createdAt: timestampToIso(data.createdAt),
    };
  });
  const hasMore = snapshot.docs.length > size;
  const lastDocument = pageDocuments[pageDocuments.length - 1];

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastDocument
      ? encodeActivityCursor(lastDocument.get("createdAt"), lastDocument.id)
      : null,
  };
}
