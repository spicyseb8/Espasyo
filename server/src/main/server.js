import express from "express";
import cors from "cors";

import accountRoutes from "./create-account.js";

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