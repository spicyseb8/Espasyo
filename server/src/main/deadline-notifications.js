import { getPhilippineDateKey, isValidDeadlineValue } from "./project-deadline-service.js";
import { createNotification } from "./notification-service.js";
import { findClientAccountByIdentifier } from "./client-account.js";

function dayNumber(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getDeadlineReminder(deadline, today) {
  if (!isValidDeadlineValue(deadline)) return null;
  const daysRemaining = dayNumber(deadline.slice(0, 10)) - dayNumber(today.slice(0, 10));
  if (daysRemaining === 3) return { key: "3-days", title: "Project deadline in 3 days", message: "Your project deadline is approaching in 3 days." };
  if (daysRemaining === 1) return { key: "1-day", title: "Project deadline tomorrow", message: "Your project deadline is approaching tomorrow." };
  if (daysRemaining === 0) return { key: "due", title: "Project deadline is today", message: "Your project deadline is today." };
  if (daysRemaining < 0) return { key: "expired", title: "Project deadline expired", message: "Your project deadline has expired. Contact your admin if you need an extension." };
  return null;
}

export async function sendDeadlineNotifications(db, now = new Date()) {
  const today = getPhilippineDateKey(now).slice(0, 10);
  const projects = await db.collection("projects").get();
  let sent = 0;
  for (const snapshot of projects.docs) {
    const project = snapshot.data();
    const deadline = project.deadline;
    const ownerId = project.ownerId;
    if (!ownerId || !isValidDeadlineValue(deadline)) continue;
    const client = await findClientAccountByIdentifier(db, ownerId);
    if (!client?.uid) continue;
    const recipientUid = client.uid;
    const deadlineDate = deadline.slice(0, 10);
    const reminder = getDeadlineReminder(deadline, today);
    if (!reminder) continue;
    const notificationId = await createNotification(db, {
      eventKey: `deadline:${snapshot.id}:${deadline}:${reminder.key}`,
      eventType: `deadline-${reminder.key}`, category: "Deadlines",
      title: reminder.title, message: reminder.message,
      actorUid: null, actorName: "Espasyo", targetType: "project",
      targetId: snapshot.id, projectId: snapshot.id, recipients: [recipientUid],
    });
    if (notificationId) sent += 1;
  }
  return { checked: projects.size, sent };
}
