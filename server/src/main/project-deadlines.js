import express from "express";
import { adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";
import {
  saveProjectDeadline,
  validateDeadlineUpdate,
} from "./project-deadline-service.js";

const router = express.Router();

router.patch(
  "/projects/:projectId/deadline",
  requireRole("admin", "superadmin"),
  async (req, res) => {
    const projectId = req.params.projectId.trim();

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (
      !req.body ||
      !Object.prototype.hasOwnProperty.call(req.body, "deadline")
    ) {
      return res.status(400).json({
        success: false,
        message: "A deadline value is required.",
      });
    }

    const validation = validateDeadlineUpdate(req.body.deadline);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    try {
      const saved = await saveProjectDeadline(
        adminDb,
        projectId,
        validation.deadline
      );

      if (!saved) {
        return res.status(404).json({
          success: false,
          message: "Project does not exist.",
        });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Project deadline update failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update the project deadline.",
      });
    }
  }
);

export default router;
