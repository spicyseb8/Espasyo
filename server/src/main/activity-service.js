import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

const ACTIVITY_COLLECTION = "projectActivity";

export function createActivityEventId(...parts) {
  return createHash("sha256")
    .update(parts.map(value => String(value)).join("\0"))
    .digest("hex");
}

export function getProjectOpenActivityId(actorUid, projectId) {
  return createActivityEventId("project-opened", actorUid, projectId);
}

export async function recordActivityEvent(db, event, eventId = randomUUID()) {
  const reference = db.collection(ACTIVITY_COLLECTION).doc(eventId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) return false;
    transaction.create(reference, {
      projectId: event.projectId ?? null,
      actorUid: event.actorUid ?? event.actorId ?? null,
      actorId: event.actorId ?? event.actorUid ?? null,
      actorRole: event.actorRole ?? null,
      actorName: event.actorName ?? "",
      targetUserUid: event.targetUserUid ?? null,
      activityType: event.activityType ?? event.action,
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

export async function recordProjectOpened(db, {
  actorUid,
  actorRole,
  actorName,
  targetUserUid,
  projectId,
  projectName,
}) {
  const name = typeof actorName === "string" && actorName.trim()
    ? actorName.trim()
    : actorRole === "client" ? "A client" : "An administrator";
  const normalizedProjectName = typeof projectName === "string" && projectName.trim()
    ? projectName.trim()
    : projectId;

  return recordActivityEvent(db, {
    projectId,
    actorUid,
    actorRole,
    actorName: name,
    targetUserUid,
    action: "project-opened",
    activityType: "project-opened",
    projectName: normalizedProjectName,
    description: `${name} opened ${normalizedProjectName}.`,
  }, getProjectOpenActivityId(actorUid, projectId));
}
