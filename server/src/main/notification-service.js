import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "notifications";
const COUNTERS = "notificationCounters";
const EVENT_KEYS = "notificationEventKeys";

export function getNotificationDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (name) => parts.find((part) => part.type === name)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

export function formatNotificationId(dateKey, sequence) {
  return `NTF-${dateKey}-${String(sequence).padStart(6, "0")}`;
}

export function notificationEventKeyId(eventKey) {
  return createHash("sha256").update(String(eventKey)).digest("hex");
}

// Call inside an existing Firestore transaction. Recipients must be resolved
// before entering the transaction so every read happens before writes.
export async function addNotificationToTransaction(transaction, db, {
  eventKey, eventType, category, title, message, actor, targetType, targetId,
  projectId = null, recipients = [], createdAt = FieldValue.serverTimestamp(),
}) {
  const uniqueRecipients = [...new Set(recipients.filter((uid) => typeof uid === "string" && uid))];
  if (!eventKey || !eventType || !category || !title || !message || !uniqueRecipients.length) return null;
  const keyRef = db.collection(EVENT_KEYS).doc(notificationEventKeyId(eventKey));
  const dateKey = getNotificationDateKey();
  const counterRef = db.collection(COUNTERS).doc(dateKey);
  const [keySnapshot, counterSnapshot] = await Promise.all([
    transaction.get(keyRef), transaction.get(counterRef),
  ]);
  if (keySnapshot.exists) return keySnapshot.data().notificationId;

  const sequence = Number(counterSnapshot.exists ? counterSnapshot.data().lastSequence : 0) + 1;
  if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error("Notification counter is invalid.");
  const notificationId = formatNotificationId(dateKey, sequence);
  const notificationRef = db.collection(COLLECTION).doc(notificationId);
  const recipientRefs = uniqueRecipients.map((uid) => notificationRef.collection("recipients").doc(uid));
  const recipientSnapshots = await Promise.all(recipientRefs.map((ref) => transaction.get(ref)));
  // A counter document and readable ID advance atomically, so a collision is
  // treated as an invariant failure rather than silently overwriting history.
  if (recipientSnapshots.some((snapshot) => snapshot.exists)) throw new Error(`Notification recipient collision: ${notificationId}`);

  const record = {
    notificationId, eventType, category, title, message,
    actorUid: actor?.uid || null, actorName: actor?.name || "Espasyo",
    targetType, targetId, projectId,
    createdAt,
  };
  transaction.create(notificationRef, record);
  transaction.create(keyRef, { notificationId, createdAt });
  transaction.set(counterRef, { lastSequence: sequence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  recipientRefs.forEach((ref, index) => transaction.create(ref, {
    ...record, recipientUid: uniqueRecipients[index], read: false, readAt: null,
  }));
  return notificationId;
}

export async function getAdminRecipientUids(db, roles = ["admin", "superadmin"]) {
  const snapshot = await db.collection("adminEmployees").get();
  return [...new Set(snapshot.docs
    .filter((doc) => roles.includes(doc.data().role) && doc.data().account_status === "active")
    .map((doc) => doc.data().uid || doc.id)
    .filter(Boolean))];
}

function getGroupedNotificationId(clientId, projectId, type) {
  const encodePart = (value) => encodeURIComponent(value).replaceAll("_", "%5F");
  return `${encodePart(clientId)}_${encodePart(projectId)}_${type}`;
}

export async function upsertNotification(db, {
  eventKey, type, clientId, clientName, projectId, projectName, recipients = [],
}) {
  if (
    typeof eventKey !== "string" || !eventKey ||
    type !== "project_updated" ||
    typeof clientId !== "string" || !clientId ||
    typeof projectId !== "string" || !projectId
  ) {
    throw new Error("Grouped client notifications require an event key, client, project, and supported type.");
  }
  const uniqueRecipients = [...new Set(recipients.filter((uid) => typeof uid === "string" && uid))];
  if (!uniqueRecipients.length) return null;

  const notificationId = getGroupedNotificationId(clientId, projectId, type);
  const notificationRef = db.collection(COLLECTION).doc(notificationId);
  const eventKeyRef = db.collection(EVENT_KEYS).doc(notificationEventKeyId(eventKey));
  const suffix = "updated";
  const countLabel = "updates";
  const title = `${clientName} ${suffix} a project`;
  const projectDescription = `${clientName} ${suffix} ${projectName}.`;

  return db.runTransaction(async (transaction) => {
    const recipientRefs = uniqueRecipients.map((uid) => notificationRef.collection("recipients").doc(uid));
    const [eventKeySnapshot, notificationSnapshot, recipientSnapshots] = await Promise.all([
      transaction.get(eventKeyRef),
      transaction.get(notificationRef),
      Promise.all(recipientRefs.map((ref) => transaction.get(ref))),
    ]);
    if (eventKeySnapshot.exists) return eventKeySnapshot.data().notificationId;

    const hasUnreadRecipient = recipientSnapshots.some(snapshot =>
      snapshot.exists && snapshot.data().read !== true && snapshot.data().isRead !== true,
    );
    const count = hasUnreadRecipient
      ? Math.max(1, Number(notificationSnapshot.data()?.count) || 1) + 1
      : 1;
    const message = count > 1
      ? `${clientName} ${suffix} ${projectName} (${count} ${countLabel}).`
      : projectDescription;
    const now = FieldValue.serverTimestamp();
    const record = {
      notificationId,
      eventType: "project-updated",
      type,
      category: "Projects",
      title,
      message,
      clientId,
      clientName,
      actorUid: clientId,
      actorName: clientName,
      projectId,
      projectName,
      targetType: "project",
      targetId: projectId,
      count,
      lastActivityAt: now,
    };

    if (hasUnreadRecipient) {
      transaction.set(notificationRef, record, { merge: true });
    } else {
      transaction.set(notificationRef, { ...record, createdAt: now });
    }
    transaction.create(eventKeyRef, { notificationId, createdAt: now });
    recipientRefs.forEach((ref, index) => {
      const recipientRecord = {
        ...record,
        recipientUid: uniqueRecipients[index],
        read: false,
        isRead: false,
        readAt: null,
        ...(hasUnreadRecipient ? {} : { createdAt: now }),
      };
      transaction.set(ref, recipientRecord, { merge: true });
    });
    return notificationId;
  });
}

export async function createNotification(db, payload) {
  const { eventKey, ...event } = payload;
  const recipients = [...new Set((event.recipients || []).filter((uid) => typeof uid === "string" && uid))];
  if (typeof eventKey !== "string" || !eventKey || !event.eventType || !event.category || !event.title || !event.message || recipients.length === 0) return null;
  const keyRef = db.collection(EVENT_KEYS).doc(notificationEventKeyId(eventKey));
  const existing = await keyRef.get();
  if (existing.exists) return existing.data().notificationId;
  const dateKey = getNotificationDateKey();
  const counterRef = db.collection(COUNTERS).doc(dateKey);
  return db.runTransaction(async (transaction) => {
    const [keySnapshot, counterSnapshot] = await Promise.all([transaction.get(keyRef), transaction.get(counterRef)]);
    if (keySnapshot.exists) return keySnapshot.data().notificationId;
    const sequence = Number(counterSnapshot.exists ? counterSnapshot.data().lastSequence : 0) + 1;
    if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error("Notification counter is invalid.");
    const notificationId = formatNotificationId(dateKey, sequence);
    const notificationRef = db.collection(COLLECTION).doc(notificationId);
    const refs = recipients.map((uid) => notificationRef.collection("recipients").doc(uid));
    const existingRecipients = await Promise.all(refs.map((ref) => transaction.get(ref)));
    if (existingRecipients.some((snapshot) => snapshot.exists)) throw new Error(`Notification recipient collision: ${notificationId}`);
    const record = { ...event, notificationId, createdAt: FieldValue.serverTimestamp() };
    delete record.recipients;
    transaction.create(notificationRef, record);
    transaction.create(keyRef, { notificationId, createdAt: FieldValue.serverTimestamp() });
    transaction.set(counterRef, { lastSequence: sequence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    refs.forEach((ref, index) => transaction.create(ref, { ...record, recipientUid: recipients[index], read: false, readAt: null }));
    return notificationId;
  });
}
