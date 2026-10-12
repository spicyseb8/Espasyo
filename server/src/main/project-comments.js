import express from "express";
import { adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";

const router = express.Router();

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

    if (typeof targetType !== "string" || typeof targetLabel !== "string") {
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
      const comment = await adminDb.collection("adminComments").add({
        projectId,
        targetType,
        targetId,
        targetLabel: targetLabel.trim(),
        regionId: regionId?.trim() || null,
        text: text.trim(),
        adminId: req.adminUser.uid,
        adminName: req.adminUser.name || "Admin",
        status: "open",
        createdAt: new Date(),
      });

      return res.status(201).json({
        success: true,
        commentId: comment.id,
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
