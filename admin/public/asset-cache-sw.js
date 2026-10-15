const CACHE_NAME = "espasyo-admin-library-assets-v1";
const MAP_PATH = "/__espasyo_asset_map__";
const FILE_CACHE_PATH = "/__espasyo_asset_cache__/";

async function stableHash(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getMappingKey(url) {
  const key = new URL(MAP_PATH, self.location.origin);
  key.searchParams.set("url", await stableHash(new URL(url).href));
  return key;
}

function requestLabel(request) {
  try {
    const url = new URL(request.url);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "unknown request";
  }
}

function errorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

function isValidMapping(mapping) {
  if (
    !mapping ||
    typeof mapping.cacheKey !== "string" ||
    typeof mapping.cachePath !== "string" ||
    typeof mapping.version !== "string"
  ) {
    return false;
  }

  try {
    const cacheKey = new URL(mapping.cacheKey);
    return (
      cacheKey.origin === self.location.origin &&
      cacheKey.pathname.startsWith(FILE_CACHE_PATH)
    );
  } catch {
    return false;
  }
}

async function removeObsoleteVersions(cache, mapping) {
  const current = new URL(mapping.cacheKey);

  for (const key of await cache.keys()) {
    const url = new URL(key.url);

    if (
      url.pathname === current.pathname &&
      url.searchParams.get("version") !== current.searchParams.get("version")
    ) {
      await cache.delete(key);
      continue;
    }

    if (url.pathname === MAP_PATH) {
      const oldResponse = await cache.match(key);
      if (!oldResponse) {
        continue;
      }

      try {
        const oldMapping = await oldResponse.json();
        if (
          isValidMapping(oldMapping) &&
          oldMapping.cachePath === mapping.cachePath &&
          oldMapping.version !== mapping.version
        ) {
          await cache.delete(key);
        }
      } catch (error) {
        console.warn("Unable to parse an obsolete asset cache mapping.", {
          error: errorName(error),
        });
      }
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  event.respondWith((async () => {
    const label = requestLabel(request);
    let cache;
    let mapping;
    let cachedAsset;

    try {
      cache = await caches.open(CACHE_NAME);
      const mappingResponse = await cache.match(await getMappingKey(request.url));

      if (mappingResponse) {
        try {
          const candidate = await mappingResponse.json();
          if (isValidMapping(candidate)) {
            mapping = candidate;
            cachedAsset = await cache.match(mapping.cacheKey);
          } else {
            console.warn("Ignoring an invalid asset cache mapping.", { request: label });
          }
        } catch (error) {
          console.error("Unable to parse an asset cache mapping.", {
            request: label,
            error: errorName(error),
          });
        }
      }
    } catch (error) {
      console.warn("Asset cache lookup failed; using the network.", {
        request: label,
        error: errorName(error),
      });
    }

    if (cachedAsset?.status === 200) {
      return cachedAsset;
    }

    if (cachedAsset && mapping && cache) {
      try {
        await cache.delete(mapping.cacheKey);
        console.warn("Discarded a non-200 cached asset response.", {
          request: label,
          status: cachedAsset.status,
        });
      } catch (error) {
        console.warn("Unable to remove a non-200 cached asset response.", {
          request: label,
          error: errorName(error),
        });
      }
    } else if (mapping) {
      console.info("Asset cache miss; using the network.", { request: label });
    }

    let response;
    try {
      response = await fetch(request);
    } catch (error) {
      console.error("Asset network request failed.", {
        request: label,
        error: errorName(error),
      });
      return new Response("Asset network request failed.", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (response.status !== 200) {
      if (mapping || new URL(request.url).hostname === "firebasestorage.googleapis.com") {
        console.warn("Asset network returned an HTTP error.", {
          request: label,
          status: response.status,
        });
      }
      return response;
    }

    if (mapping && cache) {
      try {
        await cache.put(mapping.cacheKey, response.clone());
        await removeObsoleteVersions(cache, mapping);
      } catch (error) {
        console.warn("Unable to cache a successful asset response.", {
          request: label,
          error: errorName(error),
        });
      }
    }

    return response;
  })());
});
