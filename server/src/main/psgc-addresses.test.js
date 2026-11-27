import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import test from "node:test";

import { createPsgcAddressRouter } from "./psgc-addresses.js";

async function withPsgcServer(options, run) {
  const app = express();
  app.use("/api", createPsgcAddressRouter(options));
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/psgc`;

  try {
    await run(baseUrl);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
}

test("PSGC routes proxy filtered official lookups with server-only token and configured version", async () => {
  const requests = [];
  await withPsgcServer({
    token: "server-test-token",
    version: "Q2_2026",
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      if (parsedUrl.pathname.endsWith("/regions")) {
        return Response.json([{ reg: "04", regDesc: "Region IV-A (CALABARZON)" }]);
      }
      if (parsedUrl.pathname.endsWith("/provinces")) {
        return Response.json([{ prv: "34", prvDesc: "Laguna", reg: "04" }]);
      }
      if (parsedUrl.pathname.endsWith("/municipalities")) {
        return Response.json([{ mun: "01", munDesc: "Biñan City", prv: "34", reg: "04" }]);
      }
      return Response.json([{ bgy: "01", brgyDesc: "Santo Tomas" }]);
    },
  }, async (baseUrl) => {
    const regions = await fetch(`${baseUrl}/regions`).then((response) => response.json());
    const provinces = await fetch(`${baseUrl}/provinces?regionCode=04`).then((response) => response.json());
    const cities = await fetch(`${baseUrl}/cities-municipalities?regionCode=04&provinceCode=34`).then((response) => response.json());
    const barangays = await fetch(`${baseUrl}/barangays?regionCode=04&provinceCode=34&cityMunicipalityCode=01`).then((response) => response.json());

    assert.deepEqual(regions.data[0], {
      code: "04",
      name: "Region IV-A (CALABARZON)",
    });
    assert.deepEqual(provinces.data[0], {
      code: "34",
      name: "Laguna",
      regionCode: "04",
    });
    assert.deepEqual(cities.data[0], {
      code: "01",
      name: "Biñan City",
      regionCode: "04",
      provinceCode: "34",
    });
    assert.deepEqual(barangays.data[0], {
      code: "01",
      name: "Santo Tomas",
    });
    assert.equal(requests.length, 4);
    for (const request of requests) {
      assert.equal(request.origin, "https://classification.psa.gov.ph");
      assert.match(request.pathname, /^\/psgc\/Q2_2026\//);
      assert.equal(request.searchParams.get("token"), "server-test-token");
    }
    assert.equal(JSON.stringify(regions).includes("server-test-token"), false);
    assert.equal(requests[1].searchParams.get("reg"), "04");
    assert.equal(requests[2].searchParams.get("prv"), "34");
    assert.equal(requests[3].searchParams.get("mun"), "01");
  });
});

test("PSGC lookups are cached for repeated parent selections", async () => {
  let upstreamRequests = 0;
  await withPsgcServer({
    token: "server-test-token",
    version: "Q2_2026",
    fetchImpl: async () => {
      upstreamRequests += 1;
      return Response.json([{ reg: "13", regDesc: "National Capital Region" }]);
    },
  }, async (baseUrl) => {
    await fetch(`${baseUrl}/regions`);
    await fetch(`${baseUrl}/regions`);
  });

  assert.equal(upstreamRequests, 1);
});

test("PSGC route reports missing token without contacting PSA", async () => {
  let upstreamRequests = 0;
  await withPsgcServer({
    token: "",
    version: "Q2_2026",
    fetchImpl: async () => {
      upstreamRequests += 1;
      return Response.json([]);
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/regions`);
    const result = await response.json();

    assert.equal(response.status, 503);
    assert.match(result.message, /PSA_PSGC_API_TOKEN/);
  });

  assert.equal(upstreamRequests, 0);
});

test("unsupported configured PSA release is reported without older-version fallback", async () => {
  const requestedVersions = [];
  await withPsgcServer({
    token: "server-test-token",
    version: "Q2_2026",
    fetchImpl: async (url) => {
      requestedVersions.push(new URL(url).pathname);
      return new Response("", { status: 404 });
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/regions`);
    const result = await response.json();

    assert.equal(response.status, 502);
    assert.match(result.message, /Q2_2026/);
    assert.match(result.message, /no older release/);
  });

  assert.deepEqual(requestedVersions, ["/psgc/Q2_2026/regions"]);
});

test("PSGC endpoints reject invalid parent codes before calling PSA", async () => {
  let upstreamRequests = 0;
  await withPsgcServer({
    token: "server-test-token",
    version: "Q2_2026",
    fetchImpl: async () => {
      upstreamRequests += 1;
      return Response.json([]);
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/provinces?regionCode=../../bad`);
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.message, /regionCode/);
  });

  assert.equal(upstreamRequests, 0);
});
