import express from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../firebase-admin.js";
import { getManilaDateBounds } from "../../../shared/notifications/manilaTime.mjs";

const router = express.Router();
const READ_BATCH_SIZE = 450;

async function requireAuthenticatedRecipient(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Sign in to update notifications." });
  }

  try {
    const token = await adminAuth.verifyIdToken(match[1], true);
    if (typeof token.uid !== "string" || !token.uid) {
      return res.status(401).json({ success: false, message: "Your session is invalid. Sign in again." });
    }
    req.recipientUid = token.uid;
    return next();
  } catch (error) {
    console.error("[Notifications] Recipient token verification failed:", error);
    return res.status(401).json({ success: false, message: "Your session is invalid. Sign in again." });
  }
}

export async function markNotificationRead(db, notificationId, recipientUid) {
  const recipientRef = db
    .collection("notifications")
    .doc(notificationId)
    .collection("recipients")
    .doc(recipientUid);
  const snapshot = await recipientRef.get();
  if (!snapshot.exists || snapshot.data()?.recipientUid !== recipientUid) return false;
  if (snapshot.data()?.read === true) return true;

  await recipientRef.update({
    read: true,
    readAt: FieldValue.serverTimestamp(),
  });
  return true;
}

router.patch(
  "/notifications/:notificationId/read",
  requireAuthenticatedRecipient,
  async (req, res) => {
    const notificationId = req.params.notificationId.trim();
    if (!notificationId) {
      return res.status(400).json({ success: false, message: "Notification ID is required." });
    }

    try {
      const updated = await markNotificationRead(adminDb, notificationId, req.recipientUid);
      if (!updated) {
        return res.status(404).json({ success: false, message: "Notification was not found." });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[Notifications] Unable to mark notification as read:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to mark this notification as read. Please try again.",
      });
    }
  },
);

router.post(
  "/notifications/mark-all-read",
  requireAuthenticatedRecipient,
  async (req, res) => {
    const mode = req.body?.mode;
    if (mode !== "today" && mode !== "recent") {
      return res.status(400).json({ success: false, message: "A valid notification view is required." });
    }

    try {
      const { start, end } = getManilaDateBounds();
      let unreadQuery = adminDb
        .collectionGroup("recipients")
        .where("recipientUid", "==", req.recipientUid)
        .where("read", "==", false);

      unreadQuery = mode === "today"
        ? unreadQuery
          .where("createdAt", ">=", Timestamp.fromDate(start))
          .where("createdAt", "<", Timestamp.fromDate(end))
        : unreadQuery.where("createdAt", "<", Timestamp.fromDate(start));
      unreadQuery = unreadQuery.orderBy("createdAt", "desc");

      let cursor = null;
      let updatedCount = 0;
      while (true) {
        let pageQuery = unreadQuery.limit(READ_BATCH_SIZE);
        if (cursor) pageQuery = pageQuery.startAfter(cursor);
        const page = await pageQuery.get();
        if (page.empty) break;

        const batch = adminDb.batch();
        for (const recipient of page.docs) {
          batch.update(recipient.ref, {
            read: true,
            readAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        updatedCount += page.size;
        cursor = page.docs[page.docs.length - 1];
        if (page.size < READ_BATCH_SIZE) break;
      }

      return res.json({ success: true, updatedCount });
    } catch (error) {
      console.error("[Notifications] Unable to mark all notifications as read:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to mark all notifications as read. Please try again.",
      });
    }
  },
);

export default router;
