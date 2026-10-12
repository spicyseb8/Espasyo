import express from "express";
import cors from "cors";

import accountRoutes from "./create-account.js";
import assetRoutes from "./create-asset.js";

const app = express();

const PORT = 5000;

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:9999",
      "http://localhost:9999",
    ],
    credentials: true,
  })
);

app.use(
  express.json()
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
  assetRoutes
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