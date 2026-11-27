import express from "express";
import cors from "cors";

import accountRoutes from "./create-account.js";
import accountActionRoutes from "./account-actions.js";
import assetRoutes from "./create-asset.js";
import projectDeadlineRoutes from "./project-deadlines.js";
import managedProjectRoutes from "./managed-projects.js";
import legalAcceptanceRoutes from "./legal-acceptance.js";
import adminActivityRoutes from "./admin-activities.js";
import notificationActionRoutes from "./notification-actions.js";
import psgcAddressRoutes from "./psgc-addresses.js";
import { createCorsOptions } from "./cors-config.js";
import { adminDb } from "../firebase-admin.js";
import { sendDeadlineNotifications } from "./deadline-notifications.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  cors(createCorsOptions())
);

app.use(
  express.json({ limit: "15mb" })
);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      message: "Espasyo server is running.",
    });
  }
);

// --------------------------------------------------
// ACCOUNT ROUTES
// --------------------------------------------------

app.use(
  "/api",
  accountRoutes
);

app.use(
  "/api",
  accountActionRoutes
);

app.use(
  "/api",
  assetRoutes
);

app.use(
  "/api",
  projectDeadlineRoutes
);

app.use(
  "/api",
  managedProjectRoutes
);

app.use(
  "/api",
  legalAcceptanceRoutes
);

app.use(
  "/api",
  adminActivityRoutes
);

app.use(
  "/api",
  notificationActionRoutes
);

app.use(
  "/api",
  psgcAddressRoutes
);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
  PORT,
  () => {
    console.log("");

    console.log(
      "=================================================="
    );

    console.log(
      "ESPASYO SERVER"
    );

    console.log(
      "=================================================="
    );

    console.log(
      `Server running on http://localhost:${PORT}`
    );

    console.log(
      "=================================================="
    );

    console.log("");
  }
);

// Keep deadline reminders on the same Asia/Manila calendar used by the
// project's deadline validation. Event keys make repeated sweeps idempotent.
const DEADLINE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const runDeadlineSweep = () => sendDeadlineNotifications(adminDb).catch((error) => {
  console.error("Deadline notification sweep failed:", error);
});
void runDeadlineSweep();
setInterval(runDeadlineSweep, DEADLINE_SWEEP_INTERVAL_MS).unref();
