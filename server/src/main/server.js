import express from "express";
import cors from "cors";

import accountRoutes from "./create-account.js";
import accountActionRoutes from "./account-actions.js";
import assetRoutes from "./create-asset.js";
import projectCommentRoutes from "./project-comments.js";
import projectDeadlineRoutes from "./project-deadlines.js";
import managedProjectRoutes from "./managed-projects.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must include the deployed admin and client origins in production.");
}
const developmentOrigins = process.env.NODE_ENV === "production"
  ? []
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:9999",
      "http://localhost:9999",
    ];

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  cors({
    origin: [
      ...configuredOrigins,
      ...developmentOrigins,
    ],
    credentials: true,
  })
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
  projectCommentRoutes
);

app.use(
  "/api",
  projectDeadlineRoutes
);

app.use(
  "/api",
  managedProjectRoutes
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