import express from "express";

import { adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";
import { getActivityPage } from "./activity-feed-service.js";
import { recordActivityEvent } from "./activity-service.js";

const router = express.Router();

async function respondWithActivityPage(req, res, userUid) {
  try {
    if (userUid) {
      const [userSnapshot, employeeSnapshot] = await Promise.all([
        adminDb.collection("users").where("uid", "==", userUid).limit(1).get(),
        adminDb.collection("adminEmployees").where("uid", "==", userUid).limit(1).get(),
      ]);
      if (userSnapshot.empty && employeeSnapshot.empty) {
        return res.status(404).json({ success: false, message: "Account was not found." });
      }
    }

    const page = await getActivityPage(adminDb, {
      pageSize: req.query.limit,
      cursor: req.query.cursor,
      userUid,
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ success: true, ...page });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status === 500) console.error("Admin activity page failed:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to load activity history." : error.message,
    });
  }
}

router.get("/admin/activity", requireRole("admin", "superadmin"), (req, res) =>
  respondWithActivityPage(req, res, null),
);

router.get("/admin/users/:uid/activity", requireRole("admin", "superadmin"), (req, res) => {
  const userUid = typeof req.params.uid === "string" ? req.params.uid.trim() : "";
  if (!userUid) return res.status(400).json({ success: false, message: "User UID is required." });
  return respondWithActivityPage(req, res, userUid);
});

router.post("/admin/profile-updated", requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const employeeSnapshot = await adminDb.collection("adminEmployees")
      .where("uid", "==", req.adminUser.uid)
      .limit(1)
      .get();
    if (employeeSnapshot.empty) {
      return res.status(404).json({ success: false, message: "Admin account was not found." });
    }

    await recordActivityEvent(adminDb, {
      action: "account-updated",
      activityType: "account-updated",
      actorUid: req.adminUser.uid,
      actorRole: req.adminUser.role,
      actorName: req.adminUser.name || "Administrator",
      targetUserUid: req.adminUser.uid,
      targetName: req.adminUser.name || "",
      description: `${req.adminUser.name || "An administrator"} updated their account profile.`,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("Admin profile activity failed:", error);
    return res.status(500).json({ success: false, message: "Unable to record the profile update." });
  }
});

export default router;
