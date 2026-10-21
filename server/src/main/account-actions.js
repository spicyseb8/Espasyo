import express from "express";
import { adminAuth, adminDb } from "../firebase-admin.js";
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

      const accountData = account.data();
      const uid =
        typeof accountData.uid === "string"
          ? accountData.uid
          : account.id;

      await adminAuth.updateUser(uid, { disabled: true });
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

router.post(
  "/accounts/:id/reactivate",
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

      const accountData = account.data();
      const uid =
        typeof accountData.uid === "string"
          ? accountData.uid
          : account.id;

      await accountRef.update({
        account_status: "active",
        updated_at: new Date(),
      });

      try {
        await adminAuth.updateUser(uid, { disabled: false });
      } catch (error) {
        try {
          await accountRef.update({
            account_status: "suspended",
            updated_at: new Date(),
          });
        } catch (rollbackError) {
          console.error(
            "Failed to restore suspended status after account reactivation failed:",
            rollbackError
          );
        }

        throw error;
      }

      return res.json({
        success: true,
        message: "Customer account reactivated successfully.",
      });
    } catch (error) {
      console.error("Customer account reactivation failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to reactivate customer account.",
      });
    }
  }
);

export default router;
