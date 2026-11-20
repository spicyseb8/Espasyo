import express from "express";

import { adminAuth, adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";
import { createAccountRecord } from "./account-creation.js";
import { createActivityEventId, recordActivityEvent } from "./activity-service.js";

const router = express.Router();

router.post("/accounts", requireRole("superadmin"), async (req, res) => {
  try {
    if (req.body?.accountType === "user") {
      return res.status(410).json({
        success: false,
        message: "Client accounts must be created using the verified client account flow.",
      });
    }

    const account = await createAccountRecord(req.body, { adminAuth, adminDb });
    let activityRecorded = true;
    try {
      await recordActivityEvent(adminDb, {
        action: "account-created",
        activityType: "account-created",
        actorUid: req.adminUser.uid,
        actorRole: req.adminUser.role,
        actorName: req.adminUser.name || "Superadmin",
        targetUserUid: account.uid,
        targetName: account.name,
        accountId: account.id,
        description: `${req.adminUser.name || "An administrator"} created an employee account for ${account.name}.`,
      }, createActivityEventId("account-created", account.uid));
    } catch (activityError) {
      activityRecorded = false;
      console.error("Employee account was created, but its activity event could not be recorded:", activityError);
    }
    const message = activityRecorded
      ? "Employee account created successfully."
      : "Employee account was created, but its activity history could not be recorded. Contact support.";
    return res.status(201).json({ success: true, message, account, activityRecorded });
  } catch (error) {
    if (error.status === 409 || error.status === 400) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Account creation failed:", error);
    return res.status(500).json({
      success: false,
      message: error.authRollbackFailed
        ? "The account record could not be saved, and the new sign-in account could not be removed. Contact support before retrying."
        : error.status === 500
          ? error.message
          : "Failed to create the account. Please try again.",
    });
  }
});

export default router;
