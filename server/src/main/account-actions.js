import express from "express";
import { adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";

const router = express.Router();

router.post(
  "/accounts/:id/suspend",
  requireRole("superadmin"),
  async (req, res) => {
    const accountId = req.params.id;

    if (typeof accountId !== "string" || !accountId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required.",
      });
    }

    try {
      const accountRef = adminDb.collection("users").doc(accountId);
      const account = await accountRef.get();

      if (!account.exists) {
        return res.status(404).json({
          success: false,
          message: "Customer account was not found.",
        });
      }

      await accountRef.update({
        account_status: "suspended",
        updated_at: new Date(),
      });

      return res.json({
        success: true,
        message: "Customer account suspended successfully.",
      });
    } catch (error) {
      console.error("Customer account suspension failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to suspend customer account.",
      });
    }
  }
);

export default router;
