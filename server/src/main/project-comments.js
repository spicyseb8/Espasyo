import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";

const router = express.Router();

const COMMENTS_COLLECTION = "adminComments";
const COUNTERS_COLLECTION = "idCounters";

// Use Philippine time to determine the year suffix.
function getCurrentPhilippineYear() {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(new Date());

  return Number(year);
}

// CM-00126 = comment sequence 001, year 2026.
function formatCommentId(sequence, year) {
  const yearCode = String(year % 100).padStart(2, "0");
  const sequenceCode = String(sequence).padStart(3, "0");

  return `CM-${sequenceCode}${yearCode}`;
}

router.post(
  "/projects/:projectId/comments",
  requireRole("admin", "superadmin"),
  async (req, res) => {
    const projectId = req.params.projectId.trim();

    const {
      targetType,
      targetId,
      targetLabel,
      regionId,
      text,
    } = req.body ?? {};

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty.",
      });
    }
    if (text.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment must be 2,000 characters or fewer.",
      });
    }

    if (
      typeof targetType !== "string" ||
      !["project", "wall", "floor", "furniture", "door", "window", "opening"].includes(targetType) ||
      typeof targetLabel !== "string" ||
      !targetLabel.trim() ||
      targetLabel.trim().length > 120
    ) {
      return res.status(400).json({
        success: false,
        message: "Comment target information is required.",
      });
    }

    if (targetId !== null && typeof targetId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Comment target ID is invalid.",
      });
    }

    if (regionId != null && typeof regionId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Comment region ID is invalid.",
      });
    }

    try {
      const year = getCurrentPhilippineYear();
      const yearCode = String(year % 100).padStart(2, "0");

      // A separate counter is maintained for each year.
      // Example document: idCounters/comments-2026
      const counterRef = adminDb
        .collection(COUNTERS_COLLECTION)
        .doc(`comments-${year}`);

      const commentId = await adminDb.runTransaction(
        async (transaction) => {
          // Read the current sequence.
          const counterSnapshot =
            await transaction.get(counterRef);

          const lastSequence =
            counterSnapshot.exists
              ? Number(
                  counterSnapshot.data().lastSequence ?? 0
                )
              : 0;

          if (
            !Number.isSafeInteger(lastSequence) ||
            lastSequence < 0
          ) {
            throw new Error(
              "The comment ID counter is invalid."
            );
          }

          const nextSequence = lastSequence + 1;

          const nextCommentId = formatCommentId(
            nextSequence,
            year
          );

          const commentRef = adminDb
            .collection(COMMENTS_COLLECTION)
            .doc(nextCommentId);
          const projectRef = adminDb.collection("projects").doc(projectId);
          const projectSnapshot = await transaction.get(projectRef);
          if (!projectSnapshot.exists) {
            const error = new Error("Project does not exist.");
            error.status = 404;
            throw error;
          }
          const activityRef = adminDb.collection("projectActivity").doc();

          // Create the comment and update its counter
          // atomically, preventing duplicate sequence IDs.
          transaction.create(commentRef, {
            id: nextCommentId,
            projectId,
            targetType,
            targetId: targetId ?? null,
            targetLabel: targetLabel.trim(),
            regionId: regionId?.trim() || null,
            text: text.trim(),
            adminId: req.adminUser.uid,
            adminName: req.adminUser.name || "Admin",
            status: "open",
            createdAt: new Date(),
          });
          transaction.create(activityRef, {
            projectId,
            actorId: req.adminUser.uid,
            actorRole: req.adminUser.role,
            actorName: req.adminUser.name || "",
            action: "admin-comment-added",
            description: text.trim(),
            createdAt: FieldValue.serverTimestamp(),
          });

          transaction.set(
            counterRef,
            {
              lastSequence: nextSequence,
              year,
              yearCode,
              updatedAt: new Date(),
            },
            { merge: true }
          );

          return nextCommentId;
        }
      );

      return res.status(201).json({
        success: true,
        commentId,
      });
    } catch (error) {
      console.error("Admin comment creation failed:", error);

      return res.status(error.status ?? 500).json({
        success: false,
        message: error.status ? error.message : "Failed to save comment.",
      });
    }
  }
);

router.get(
  "/admin/projects/:projectId/comments",
  requireRole("admin", "superadmin"),
  async (req, res) => {
    const projectId = req.params.projectId.trim();
    if (!projectId) {
      return res.status(400).json({ success: false, message: "Project ID is required." });
    }
    try {
      const project = await adminDb.collection("projects").doc(projectId).get();
      if (!project.exists) return res.status(404).json({ success: false, message: "Project does not exist." });
      const snapshot = await adminDb.collection(COMMENTS_COLLECTION)
        .where("projectId", "==", projectId)
        .get();
      const comments = snapshot.docs
        .map(document => {
          const data = document.data();
          return {
            id: document.id,
            ...data,
            createdAt: data.createdAt instanceof Date
              ? data.createdAt.toISOString()
              : data.createdAt?.toDate?.().toISOString() ?? null,
          };
        })
        .sort((first, second) => {
          const firstTime = first.createdAt?.toMillis?.() ?? 0;
          const secondTime = second.createdAt?.toMillis?.() ?? 0;
          return firstTime - secondTime;
        });
      return res.json({ success: true, comments });
    } catch (error) {
      console.error("Admin project comments load failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load project comments." });
    }
  }
);

export default router;