import express from "express";

const PSA_PSGC_API_BASE_URL = "https://classification.psa.gov.ph/psgc";
const DEFAULT_PSGC_API_VERSION = "Q2_2026";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CODE_PATTERN = /^\d{1,12}$/;
const VERSION_PATTERN = /^[A-Za-z0-9_]+$/;

const CODE_FIELDS = {
  regions: ["reg", "regionCode", "region_code", "regCode", "reg_code", "code", "psgcCode", "psgc_code"],
  provinces: ["prv", "provinceCode", "province_code", "prvCode", "prv_code", "code", "psgcCode", "psgc_code"],
  municipalities: ["mun", "municipalityCode", "municipality_code", "citymunCode", "citymun_code", "code", "psgcCode", "psgc_code"],
  barangays: ["bgy", "brgy", "barangayCode", "barangay_code", "bgyCode", "bgy_code", "brgyCode", "brgy_code", "code", "psgcCode", "psgc_code"],
};

const NAME_FIELDS = {
  regions: ["regDesc", "regionName", "region_name", "name", "description"],
  provinces: ["prvDesc", "provinceName", "province_name", "name", "description"],
  municipalities: ["munDesc", "citymunDesc", "municipalityName", "municipality_name", "name", "description"],
  barangays: ["brgyDesc", "bgyDesc", "barangayName", "barangay_name", "name", "description"],
};

const PARENT_FIELDS = {
  region: ["reg", "regionCode", "region_code", "regCode", "reg_code"],
  province: ["prv", "provinceCode", "province_code", "prvCode", "prv_code"],
};

class PsgcError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function firstStringValue(record, fields) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function getProvinceCode(record) {
  for (const field of PARENT_FIELDS.province) {
    const value = record[field];
    if (
      value === false ||
      value === null ||
      value === undefined ||
      value === "" ||
      (typeof value === "string" && value.trim().toLowerCase() === "false")
    ) {
      return undefined;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
      return String(value);
    }
  }

  return undefined;
}

function getRegionCode(record) {
  return firstStringValue(record, PARENT_FIELDS.region) || undefined;
}

function getPsgcRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of ["data", "results", "records", "items"]) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }

  throw new PsgcError(
    502,
    "PSA PSGC API returned an unsupported response structure. Verify the configured release and API payload.",
  );
}

function normalizeRows(payload, type) {
  const rows = getPsgcRows(payload);
  const items = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new PsgcError(
        502,
        "PSA PSGC API returned an invalid geographic record.",
      );
    }

    const code = firstStringValue(row, CODE_FIELDS[type]);
    const name = firstStringValue(row, NAME_FIELDS[type]);
    if (!code || !name) {
      throw new PsgcError(
        502,
        `PSA PSGC API returned a ${type} record without a recognized code or name. Verify the API response structure.`,
      );
    }

    return {
      code,
      name,
      ...(type === "provinces" || type === "municipalities"
        ? { regionCode: getRegionCode(row) }
        : {}),
      ...(type === "municipalities"
        ? { provinceCode: getProvinceCode(row) }
        : {}),
    };
  });

  return items.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );
}

function getRequiredCode(value, fieldName) {
  if (typeof value !== "string" || !CODE_PATTERN.test(value)) {
    throw new PsgcError(400, `${fieldName} must be a valid PSGC code.`);
  }

  return value;
}

function createPsgcSource({
  token,
  version,
  fetchImpl,
}) {
  const cache = new Map();
  const inFlight = new Map();

  async function getItems(type, parameters = {}) {
    if (!token?.trim()) {
      throw new PsgcError(
        503,
        "PSA PSGC lookup is not configured. Set the server-side PSA_PSGC_API_TOKEN.",
      );
    }
    if (!VERSION_PATTERN.test(version)) {
      throw new PsgcError(
        503,
        "PSGC_API_VERSION must be a valid PSA release identifier.",
      );
    }

    const cacheKey = JSON.stringify([version, type, parameters]);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }
    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }

    const request = (async () => {
      const url = new URL(
        `${PSA_PSGC_API_BASE_URL}/${encodeURIComponent(version)}/${type}`,
      );
      url.searchParams.set("token", token.trim());
      for (const [key, value] of Object.entries(parameters)) {
        url.searchParams.set(key, value);
      }

      let response;
      try {
        response = await fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        console.error("PSA PSGC request failed.", {
          endpoint: type,
          version,
          error: error instanceof Error ? error.name : "RequestError",
        });
        throw new PsgcError(
          502,
          "Could not reach the PSA PSGC API. Please try again later.",
        );
      }

      if (!response.ok) {
        console.error("PSA PSGC API rejected a lookup.", {
          endpoint: type,
          version,
          status: response.status,
        });
        if (response.status === 401 || response.status === 403) {
          throw new PsgcError(
            502,
            "The PSA PSGC API rejected its server token. Verify PSA_PSGC_API_TOKEN.",
          );
        }
        if (response.status === 400 || response.status === 404) {
          throw new PsgcError(
            502,
            `The PSA PSGC API rejected release ${version} or the requested filter (HTTP ${response.status}). Verify PSGC_API_VERSION; no older release will be used automatically.`,
          );
        }
        throw new PsgcError(
          502,
          `The PSA PSGC API returned HTTP ${response.status}. Please try again later.`,
        );
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new PsgcError(
          502,
          "PSA PSGC API returned invalid JSON. Verify the configured release and API response.",
        );
      }

      const items = normalizeRows(payload, type);
      cache.set(cacheKey, {
        items,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return items;
    })();

    inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      inFlight.delete(cacheKey);
    }
  }

  return { getItems };
}

function sendPsgcError(response, error) {
  if (error instanceof PsgcError) {
    return response.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Unexpected PSGC lookup error:", error);
  return response.status(502).json({
    success: false,
    message: "Could not load PSGC address options. Please try again later.",
  });
}

export function createPsgcAddressRouter({
  token = process.env.PSA_PSGC_API_TOKEN,
  version = process.env.PSGC_API_VERSION || DEFAULT_PSGC_API_VERSION,
  fetchImpl = fetch,
} = {}) {
  const router = express.Router();
  const source = createPsgcSource({ token, version, fetchImpl });

  const respondWithItems = (type, parameters = () => ({})) =>
    async (request, response) => {
      try {
        const data = await source.getItems(type, parameters(request));
        response.set("Cache-Control", "public, max-age=3600");
        return response.json({ success: true, version, data });
      } catch (error) {
        return sendPsgcError(response, error);
      }
    };

  router.get("/psgc/regions", respondWithItems("regions"));

  router.get(
    "/psgc/provinces",
    respondWithItems("provinces", (request) => ({
      reg: getRequiredCode(request.query.regionCode, "regionCode"),
    })),
  );

  router.get(
    "/psgc/cities-municipalities",
    respondWithItems("municipalities", (request) => {
      const regionCode = getRequiredCode(
        request.query.regionCode,
        "regionCode",
      );
      if (request.query.provinceCode === undefined) {
        return { reg: regionCode };
      }

      return {
        reg: regionCode,
        prv: getRequiredCode(request.query.provinceCode, "provinceCode"),
      };
    }),
  );

  router.get(
    "/psgc/barangays",
    respondWithItems("barangays", (request) => {
      const parameters = {
        reg: getRequiredCode(request.query.regionCode, "regionCode"),
        mun: getRequiredCode(
          request.query.cityMunicipalityCode,
          "cityMunicipalityCode",
        ),
      };
      if (request.query.provinceCode !== undefined) {
        parameters.prv = getRequiredCode(
          request.query.provinceCode,
          "provinceCode",
        );
      }
      return parameters;
    }),
  );

  return router;
}

export default createPsgcAddressRouter();
