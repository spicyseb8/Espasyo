import express from "express";
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
  requireRole("admin"),
  async (req, res) => {
    const projectId = req.params.projectId.trim();

    const {
      targetType,
      targetId,
      targetLabel,
      regionId,
      text,
    } = req.body;

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

    if (
      typeof targetType !== "string" ||
      typeof targetLabel !== "string"
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

      return res.status(500).json({
        success: false,
        message: "Failed to save comment.",
      });
    }
  }
);

export default router;