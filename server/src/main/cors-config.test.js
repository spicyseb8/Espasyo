import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import cors from "cors";
import express from "express";

import { createCorsOptions } from "./cors-config.js";

const CLIENT_ORIGIN = "http://localhost:1000";
const WORKFLOW_PATH = "/api/projects/PRJ-04626/workflow";

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

test("development CORS allows client and existing admin origins with authenticated preflight headers", async () => {
  const options = createCorsOptions({
    nodeEnv: "development",
    corsOrigins: "https://admin.example.com",
  });
  const app = express();
  app.use(cors(options));
  app.get("/api/projects/:projectId/workflow", (req, res) => {
    if (req.get("Authorization") !== "Bearer valid-client-token") {
      return res.status(401).json({ success: false });
    }
    return res.json({ success: true, workflow: { projectId: req.params.projectId } });
  });
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const preflight = await fetch(`${baseUrl}${WORKFLOW_PATH}`, {
      method: "OPTIONS",
      headers: {
        Origin: CLIENT_ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), CLIENT_ORIGIN);
    assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /\bGET\b/);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /\bPOST\b/);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /\bPUT\b/);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /\bPATCH\b/);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /\bDELETE\b/);
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /authorization/i);
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /content-type/i);

    const workflow = await fetch(`${baseUrl}${WORKFLOW_PATH}`, {
      headers: {
        Origin: CLIENT_ORIGIN,
        Authorization: "Bearer valid-client-token",
      },
    });
    assert.equal(workflow.status, 200);
    assert.equal(workflow.headers.get("access-control-allow-origin"), CLIENT_ORIGIN);
    assert.deepEqual(await workflow.json(), {
      success: true,
      workflow: { projectId: "PRJ-04626" },
    });

    const unauthorized = await fetch(`${baseUrl}${WORKFLOW_PATH}`, {
      headers: { Origin: CLIENT_ORIGIN },
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("access-control-allow-origin"), CLIENT_ORIGIN);

    const forbiddenOrigin = await fetch(`${baseUrl}${WORKFLOW_PATH}`, {
      headers: {
        Origin: "https://untrusted.example",
        Authorization: "Bearer valid-client-token",
      },
    });
    assert.equal(forbiddenOrigin.headers.get("access-control-allow-origin"), null);
  } finally {
    await close(server);
  }

  assert.ok(options.origin.includes("http://localhost:5173"));
  assert.ok(options.origin.includes("http://localhost:5174"));
  assert.ok(options.origin.includes("https://admin.example.com"));
});

test("production CORS is restricted to configured origins", () => {
  const options = createCorsOptions({
    nodeEnv: "production",
    corsOrigins: "https://admin.example.com, https://client.example.com",
  });
  assert.deepEqual(options.origin, [
    "https://admin.example.com",
    "https://client.example.com",
  ]);
  assert.equal(options.origin.includes("*"), false);
  assert.throws(
    () => createCorsOptions({ nodeEnv: "production", corsOrigins: "" }),
    /CORS_ORIGINS must include/,
  );
});
