import {
  getDownloadURL,
  getMetadata,
  ref,
} from "firebase/storage";

import { storage } from "../firebase/firebase";

const CACHE_NAME = "espasyo-client-library-assets-v1";
const FILE_CACHE_PATH = "/__espasyo_asset_cache__/";
const MAP_CACHE_PATH = "/__espasyo_asset_map__";
const DOWNLOAD_CONCURRENCY = 2;
const METADATA_CONCURRENCY = 4;
let storagePersistenceRequest: Promise<void> | undefined;

export interface AssetSyncProgress {
  phase: "starting" | "downloading" | "complete" | "error";
  completed: number;
  total: number;
  failed: number;
  bytesDownloaded: number;
  totalBytes: number;
  activeDownloads: number;
  error?: string;
}

interface AssetFile {
  url?: string;
  urls?: string[];
  storagePath: string;
  cachePath: string;
  version: string;
  size?: number;
  error?: unknown;
}

interface AssetMapping {
  cacheKey: string;
  cachePath: string;
  version: string;
}

async function stableHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requestStoragePersistenceOnce(): Promise<void> {
  if (!storagePersistenceRequest) {
    storagePersistenceRequest = (async () => {
      if (!navigator.storage?.persist) {
        return;
      }

      try {
        const persistent = await navigator.storage.persist();
        if (!persistent) {
          console.info("Persistent storage unavailable; cached assets may be evicted.");
        }
      } catch {
        console.debug("Unable to request persistent storage.");
      }
    })();
  }

  return storagePersistenceRequest;
}

function safeSourceLabel(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`;
    }
  } catch {
    return value;
  }

  return value;
}

function parseFirebaseDownloadURL(value: string) {
  try {
    const url = new URL(value);

    if (!url.hostname.includes("firebasestorage.googleapis.com")) {
      return null;
    }

    const objectMarker = "/o/";
    const markerIndex = url.pathname.indexOf(objectMarker);

    if (markerIndex < 0) {
      return null;
    }

    const bucket = url.pathname.slice(0, markerIndex).split("/").at(-1);
    const encodedPath = url.pathname.slice(markerIndex + objectMarker.length);

    if (!bucket || !encodedPath) {
      return null;
    }

    return {
      bucket,
      path: decodeURIComponent(encodedPath),
    };
  } catch {
    return null;
  }
}

function parseStoragePath(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("gs://")) {
    const withoutProtocol = trimmed.slice(5);
    const separator = withoutProtocol.indexOf("/");

    if (separator < 1) {
      return null;
    }

    return {
      bucket: withoutProtocol.slice(0, separator),
      path: withoutProtocol.slice(separator + 1),
    };
  }

  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return null;
  }

  return {
    bucket: storage.app.options.storageBucket ?? "default",
    path: trimmed.replace(/^\/+/, ""),
  };
}

function storageReference(bucket: string, path: string) {
  const configuredBucket = storage.app.options.storageBucket;
  return ref(
    storage,
    bucket === configuredBucket ? path : `gs://${bucket}/${path}`,
  );
}

function createCacheKey(cachePath: string, version: string): Request {
  const encodedPath = cachePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(`${FILE_CACHE_PATH}${encodedPath}`, window.location.origin);
  url.searchParams.set("version", version);
  return new Request(url.toString());
}

async function createMappingKey(url: string): Promise<Request> {
  const key = new URL(MAP_CACHE_PATH, window.location.origin);
  key.searchParams.set("url", await stableHash(new URL(url).href));
  return new Request(key.toString());
}

async function registerMapping(
  file: AssetFile,
  cacheKey: Request,
): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const mapping: AssetMapping = {
    cacheKey: cacheKey.url,
    cachePath: file.cachePath,
    version: file.version,
  };

  await cache.put(
    await createMappingKey(file.url!),
    new Response(JSON.stringify(mapping), {
      headers: { "content-type": "application/json" },
    }),
  );
}

async function removeObsoleteVersions(file: AssetFile): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const cachePath = createCacheKey(file.cachePath, file.version);
  const pathname = new URL(cachePath.url).pathname;

  for (const key of await cache.keys()) {
    const url = new URL(key.url);

    if (
      url.pathname === pathname &&
      url.searchParams.get("version") !== file.version
    ) {
      await cache.delete(key);
    } else if (url.pathname === MAP_CACHE_PATH) {
      const mappingResponse = await cache.match(key);
      if (!mappingResponse) {
        continue;
      }

      const mapping = (await mappingResponse.json()) as AssetMapping;
      if (
        mapping.cachePath === file.cachePath &&
        mapping.version !== file.version
      ) {
        await cache.delete(key);
      }
    }
  }
}

function isAssetField(key: string): boolean {
  return /(?:path|url|model|texture|thumbnail|diffuse|normal|rough|ao|base_color)/i.test(
    key,
  );
}

function collectSources(value: unknown): string[] {
  const sources = new Set<string>();

  function visit(current: unknown, key = ""): void {
    if (typeof current === "string") {
      const candidate = current.trim();

      if (
        isAssetField(key) &&
        candidate &&
        (/^https?:\/\//i.test(candidate) || /^gs:\/\//i.test(candidate) ||
          (!candidate.startsWith("/") && !candidate.startsWith("data:") &&
            !candidate.startsWith("blob:") && key.toLowerCase().includes("path")))
      ) {
        sources.add(candidate);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, key));
      return;
    }

    if (typeof current === "object" && current !== null) {
      Object.entries(current).forEach(([childKey, child]) => visit(child, childKey));
    }
  }

  visit(value);
  return [...sources];
}

export function collectAssetSources(value: unknown): string[] {
  return collectSources(value);
}

async function resolveAssetFile(source: string): Promise<AssetFile> {
  const downloadURL = /^https?:\/\//i.test(source) ? source : undefined;
  const parsedPath = downloadURL
    ? parseFirebaseDownloadURL(downloadURL)
    : parseStoragePath(source);

  if (!parsedPath) {
    const externalURL = downloadURL ? new URL(downloadURL) : null;

    if (!externalURL) {
      return {
        storagePath: source,
        cachePath: `invalid/${await stableHash(source)}`,
        version: "unavailable",
        error: new Error("Asset path is not a Firebase Storage path."),
      };
    }

    const cachePath = `external/${await stableHash(externalURL.href)}`;
    return {
      url: externalURL.href,
      storagePath: cachePath,
      cachePath,
      version: "external-url",
    };
  }

  const cachePath = `${parsedPath.bucket}/${parsedPath.path}`;

  try {
    const fileRef = storageReference(parsedPath.bucket, parsedPath.path);
    const [url, metadata] = await Promise.all([
      downloadURL ? Promise.resolve(downloadURL) : getDownloadURL(fileRef),
      getMetadata(fileRef),
    ]);

    return {
      url,
      storagePath: parsedPath.path,
      cachePath,
      version: metadata.generation || metadata.updated || "unknown",
      size: Number(metadata.size) || undefined,
    };
  } catch (error) {
    console.error(
      "Unable to prepare a Firebase library asset:",
      safeSourceLabel(source),
      error,
    );
    return {
      url: downloadURL,
      storagePath: parsedPath.path,
      cachePath,
      version: "unavailable",
      error,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await run(items[index]);
      }
    }),
  );

  return results;
}

function formatProgress(
  files: AssetFile[],
  completed: number,
  failed: number,
  bytesByFile: Map<string, number>,
  activeDownloads: number,
): AssetSyncProgress {
  return {
    phase: "downloading",
    completed,
    total: files.length,
    failed,
    bytesDownloaded: [...bytesByFile.values()].reduce((sum, value) => sum + value, 0),
    totalBytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    activeDownloads,
  };
}

async function downloadFile(
  file: AssetFile,
  cacheKey: Request,
  signal: AbortSignal,
  onBytes: (bytes: number) => void,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException("Asset download cancelled.", "AbortError");
    }

    let cacheWrite: Promise<void> | undefined;

    try {
      const response = await fetch(file.url!, { signal });

      if (response.status !== 200) {
        throw new Error(`Asset request failed with HTTP ${response.status}.`);
      }

      const cache = await caches.open(CACHE_NAME);
      cacheWrite = cache.put(cacheKey, response.clone());
      const reader = response.body?.getReader();
      let received = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          received += value.byteLength;
          onBytes(received);
        }
      } else {
        received = (await response.arrayBuffer()).byteLength;
        onBytes(received);
      }

      await cacheWrite;
      await removeObsoleteVersions(file);
      return;
    } catch (error) {
      if (cacheWrite) {
        await cacheWrite.catch(() => undefined);
      }
      lastError = error;
      onBytes(0);

      if (
        signal.aborted ||
        (error instanceof Error &&
          (/HTTP 4\d\d/.test(error.message) ||
            (error instanceof DOMException &&
              ["QuotaExceededError", "NotAllowedError"].includes(error.name))))
      ) {
        break;
      }

      if (attempt < 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function registerFirebaseAssetURL(
  storagePath: string,
  url: string,
): Promise<void> {
  const parsed = parseStoragePath(storagePath);

  if (!parsed) {
    throw new Error("Cannot register an invalid Firebase Storage path.");
  }

  const metadata = await getMetadata(
    storageReference(parsed.bucket, parsed.path),
  );
  const cachePath = `${parsed.bucket}/${parsed.path}`;
  const file: AssetFile = {
    url,
    storagePath: parsed.path,
    cachePath,
    version: metadata.generation || metadata.updated || "unknown",
    size: Number(metadata.size) || undefined,
  };
  await registerMapping(file, createCacheKey(file.cachePath, file.version));
}

export async function registerAssetDownloadURL(url: string): Promise<void> {
  const parsed = parseFirebaseDownloadURL(url);
  if (!parsed) {
    try {
      const externalURL = new URL(url);
      if (externalURL.protocol !== "http:" && externalURL.protocol !== "https:") {
        return;
      }

      const cachePath = `external/${await stableHash(externalURL.href)}`;
      const file: AssetFile = {
        url: externalURL.href,
        storagePath: cachePath,
        cachePath,
        version: "external-url",
      };
      await registerMapping(file, createCacheKey(cachePath, file.version));
    } catch (error) {
      console.error(
        "Unable to register an external asset cache mapping:",
        safeSourceLabel(url),
        error,
      );
    }
    return;
  }

  try {
    await registerFirebaseAssetURL(`gs://${parsed.bucket}/${parsed.path}`, url);
  } catch (error) {
    console.error(
      "Unable to register a Firebase Storage cache mapping:",
      safeSourceLabel(url),
      error,
    );
  }
}

export async function resolveStorageAssetURL(path: string): Promise<string> {
  const fileRef = ref(storage, path);
  const url = await getDownloadURL(fileRef);

  await registerAssetDownloadURL(url);

  return url;
}

export async function syncLibraryAssets(
  catalogs: unknown[],
  signal: AbortSignal,
  onProgress: (progress: AssetSyncProgress) => void,
): Promise<void> {
  if (!("caches" in window)) {
    throw new Error("This browser does not support persistent asset caching.");
  }

  await requestStoragePersistenceOnce();

  onProgress({
    phase: "starting",
    completed: 0,
    total: 0,
    failed: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
    activeDownloads: 0,
  });

  const sources = [...new Set(catalogs.flatMap(collectSources))];
  const resolvedFiles = await mapWithConcurrency(
    sources,
    METADATA_CONCURRENCY,
    resolveAssetFile,
  );

  if (signal.aborted) {
    return;
  }

  const filesByVersion = new Map<string, AssetFile>();
  for (const candidate of resolvedFiles) {
    const key = `${candidate.cachePath}\u0000${candidate.version}`;
    const existing = filesByVersion.get(key);

    if (existing) {
      if (candidate.url) {
        existing.urls = [...new Set([...(existing.urls ?? []), candidate.url])];
      }
      existing.size = Math.max(existing.size ?? 0, candidate.size ?? 0) || undefined;
    } else {
      filesByVersion.set(key, {
        ...candidate,
        urls: candidate.url ? [candidate.url] : [],
      });
    }
  }

  const files = [...filesByVersion.values()];
  let completed = 0;
  let failed = 0;
  let activeDownloads = 0;
  const bytesByFile = new Map<string, number>();
  const cache = await caches.open(CACHE_NAME);

  const publish = () => {
    onProgress(formatProgress(files, completed, failed, bytesByFile, activeDownloads));
  };

  onProgress({
    ...formatProgress(files, completed, failed, bytesByFile, activeDownloads),
    phase: "downloading",
  });

  await mapWithConcurrency(files, DOWNLOAD_CONCURRENCY, async (file) => {
    if (signal.aborted) {
      return;
    }

    if (!file.url || file.error) {
      failed += 1;
      completed += 1;
      console.error("Skipping an asset that could not be prepared:", file.storagePath, file.error);
      publish();
      return;
    }

    try {
      const cacheKey = createCacheKey(file.cachePath, file.version);
      await Promise.all(
        (file.urls ?? [file.url]).filter((url): url is string => Boolean(url))
          .map((url) => registerMapping({ ...file, url }, cacheKey)),
      );
      const cached = await cache.match(cacheKey);

      if (cached) {
        const size = Number(cached.headers.get("content-length")) || file.size || 0;
        bytesByFile.set(file.cachePath, size);
      } else {
        activeDownloads += 1;
        publish();
        await downloadFile(file, cacheKey, signal, (bytes) => {
          bytesByFile.set(file.cachePath, bytes);
          publish();
        });
        bytesByFile.set(file.cachePath, file.size ?? bytesByFile.get(file.cachePath) ?? 0);
        activeDownloads -= 1;
      }

      completed += 1;
    } catch (error) {
      activeDownloads = Math.max(0, activeDownloads - 1);
      failed += 1;
      completed += 1;
      bytesByFile.delete(file.cachePath);
      console.error("Unable to persist a library asset:", file.storagePath, error);
    }

    publish();
  });

  if (signal.aborted) {
    return;
  }

  onProgress({
    ...formatProgress(files, completed, failed, bytesByFile, 0),
    phase: failed === 0 ? "complete" : "error",
  });
}

export async function registerAssetCacheWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}asset-cache-sw.js`,
  );
  await navigator.serviceWorker.ready;

  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve, reject) => {
      if (navigator.serviceWorker.controller) {
        resolve();
        return;
      }

      const timeout = window.setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControl);
        reject(new Error("The asset cache worker did not take control of this page."));
      }, 5000);

      const onControl = () => {
        window.clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener("controllerchange", onControl);
        resolve();
      };

      navigator.serviceWorker.addEventListener("controllerchange", onControl, {
        once: true,
      });
    });
  }
}
