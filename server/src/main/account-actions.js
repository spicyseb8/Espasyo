import express from "express";
import { adminAuth, adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";
import { createNotification, getAdminRecipientUids } from "./notification-service.js";

const router = express.Router();

router.post("/accounts/:id/created-notification", requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const accountSnapshot = await adminDb.collection("users").where("uid", "==", req.params.id).limit(1).get();
    const account = accountSnapshot.docs[0]?.data();
    if (!account || account.createdBy !== req.adminUser.uid) {
      return res.status(404).json({ success: false, message: "Recently created client account was not found." });
    }
    await createNotification(adminDb, {
      eventKey: `account-created:${req.params.id}`, eventType: "account-created", category: "Accounts",
      title: "Client account created",
      message: `${req.adminUser.name || "An admin"} created a client account for ${account.full_name || account.name || "a client"}.`,
      actorUid: req.adminUser.uid, actorName: req.adminUser.name || "Admin",
      targetType: "account", targetId: account.id || req.params.id,
      recipients: await getAdminRecipientUids(adminDb),
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("Client account notification failed:", error);
    return res.status(500).json({ success: false, message: "Unable to record the client account notification." });
  }
});

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

      if (accountData.account_status === "suspended") {
        return res.json({ success: true, message: "Customer account is already suspended." });
      }

      await adminAuth.updateUser(uid, { disabled: true });
      await accountRef.update({
        account_status: "suspended",
        updated_at: new Date(),
      });
      await createNotification(adminDb, {
        eventKey: `account-suspended:${uid}:${accountData.updated_at?.toMillis?.() ?? accountData.updated_at?.getTime?.() ?? "initial"}`,
        eventType: "account-suspended", category: "Accounts", title: "Account suspended",
        message: `${req.adminUser.name || "A superadmin"} suspended ${accountData.name || accountData.email || "a client account"}.`,
        actorUid: req.adminUser.uid, actorName: req.adminUser.name || "Superadmin",
        targetType: "account", targetId: accountId, recipients: await getAdminRecipientUids(adminDb),
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

      if (accountData.account_status === "active") {
        return res.json({ success: true, message: "Customer account is already active." });
      }

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
      await createNotification(adminDb, {
        eventKey: `account-reactivated:${uid}:${accountData.updated_at?.toMillis?.() ?? accountData.updated_at?.getTime?.() ?? "initial"}`,
        eventType: "account-reactivated", category: "Accounts", title: "Account reactivated",
        message: `${req.adminUser.name || "A superadmin"} reactivated ${accountData.name || accountData.email || "a client account"}.`,
        actorUid: req.adminUser.uid, actorName: req.adminUser.name || "Superadmin",
        targetType: "account", targetId: accountId, recipients: await getAdminRecipientUids(adminDb),
      });

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
