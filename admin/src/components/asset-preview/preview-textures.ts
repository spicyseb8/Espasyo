import {
  getDownloadURL,
  ref as storageRef,
} from "firebase/storage";

import { storage } from "@/firebase/firebase";


const storageUrlCache = new Map<string, string>();


export function normalizeStoragePath(
  path: string
): string {
  let normalized = path.trim();

  if (!normalized) {
    throw new Error(
      "Firebase Storage path is empty."
    );
  }


  if (normalized.startsWith("gs://")) {
    const withoutProtocol =
      normalized.slice(5);

    const firstSlash =
      withoutProtocol.indexOf("/");

    if (firstSlash === -1) {
      throw new Error(
        `Invalid Firebase Storage URI: ${path}`
      );
    }

    normalized =
      withoutProtocol.slice(
        firstSlash + 1
      );
  }


  normalized =
    normalized.replace(/^\/+/, "");

  return normalized;
}


export async function resolveStoragePath(
  path?: string | null
): Promise<string | null> {

  if (!path?.trim()) {
    return null;
  }

  let normalizedPath: string;

  try {
    normalizedPath =
      normalizeStoragePath(path);
  } catch (error) {
    console.error(
      "[PreviewStorage] Invalid Storage path:",
      {
        path,
        error,
      }
    );

    return null;
  }

 
  const cachedUrl =
    storageUrlCache.get(
      normalizedPath
    );

  if (cachedUrl) {
    return cachedUrl;
  }

  try {
    console.log(
      "[PreviewStorage] Resolving Storage path:",
      normalizedPath
    );

    const fileRef = storageRef(
      storage,
      normalizedPath
    );

    const url =
      await getDownloadURL(fileRef);

  
    storageUrlCache.set(
      normalizedPath,
      url
    );

    console.log(
      "[PreviewStorage] Storage URL resolved:",
      {
        path: normalizedPath,
        url,
      }
    );

    return url;
  } catch (error) {
   
    console.error(
      "[PreviewStorage] Failed to resolve Storage path:",
      {
        path,
        normalizedPath,
        error,
      }
    );

    return null;
  }
}


export async function resolveStoragePaths(
  paths: Record<
    string,
    string | null | undefined
  >
): Promise<
  Record<string, string | null>
> {
  const entries =
    Object.entries(paths);

  const resolved =
    await Promise.all(
      entries.map(
        async ([key, path]) => [
          key,
          await resolveStoragePath(path),
        ] as const
      )
    );

  return Object.fromEntries(
    resolved
  );
}


export function clearStorageUrlCache(
  path: string
): void {
  try {
    const normalizedPath =
      normalizeStoragePath(path);

    storageUrlCache.delete(
      normalizedPath
    );
  } catch {
    // Ignore invalid paths.
  }
}


export function clearAllStorageUrlCache(): void {
  storageUrlCache.clear();
}