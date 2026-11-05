import express from "express";

import { adminAuth, adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";
import { createAccountRecord } from "./account-creation.js";

const router = express.Router();

router.post("/accounts", requireRole("superadmin"), async (req, res) => {
  try {
    const account = await createAccountRecord(req.body, { adminAuth, adminDb });
    const message = account.accountType === "user"
      ? "User account created successfully."
      : "Employee account created successfully.";
    return res.status(201).json({ success: true, message, account });
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
