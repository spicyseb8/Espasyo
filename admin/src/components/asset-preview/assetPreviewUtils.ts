import * as THREE from "three";

import type { Asset } from "@/services/assets/asset-types";

import {
  resolveStoragePath,
} from "./preview-textures";

// ==================================================
// TYPES
// ==================================================

export interface PreviewTextures {
  diffuse: THREE.Texture | null;
}

export interface PreviewTextureURLs {
  diffuseURL: string | null;
}

export interface PreviewURLs
  extends PreviewTextureURLs {
  modelURL: string | null;
}

// ==================================================
// URL RESOLUTION
// ==================================================

/**
 * Resolves the 3D model storage path
 * into a usable URL.
 */
export async function resolveModelURL(
  asset: Asset
): Promise<string | null> {
  if (!asset.storage_path?.trim()) {
    return null;
  }

  return resolveStoragePath(
    asset.storage_path
  );
}

/**
 * Resolves the diffuse texture storage path
 * into a usable URL.
 */
export async function resolveTextureURLs(
  asset: Asset
): Promise<PreviewTextureURLs> {
  if (!asset.diffuse_path?.trim()) {
    return {
      diffuseURL: null,
    };
  }

  const diffuseURL =
    await resolveStoragePath(
      asset.diffuse_path
    );

  return {
    diffuseURL,
  };
}

/**
 * Resolves both the model URL and texture URL
 * at the same time.
 *
 * This prevents the model and texture from
 * being resolved sequentially.
 */
export async function resolvePreviewURLs(
  asset: Asset
): Promise<PreviewURLs> {
  const [
    modelURL,
    diffuseURL,
  ] = await Promise.all([
    resolveModelURL(asset),

    resolveStoragePath(
      asset.diffuse_path
    ),
  ]);

  return {
    modelURL,
    diffuseURL,
  };
}

// ==================================================
// TEXTURE LOADER
// ==================================================

const textureLoader =
  new THREE.TextureLoader();

// ==================================================
// COMPLETED TEXTURE CACHE
// ==================================================

/**
 * Normalized storage path
 * ->
 * THREE.Texture
 *
 * Once a texture has been loaded,
 * future previews can immediately reuse it.
 */
const textureCache =
  new Map<
    string,
    THREE.Texture
  >();

// ==================================================
// IN-FLIGHT TEXTURE CACHE
// ==================================================

/**
 * Normalized storage path
 * ->
 * Promise<THREE.Texture | null>
 *
 * Prevents multiple components from
 * downloading the same texture simultaneously.
 */
const texturePromiseCache =
  new Map<
    string,
    Promise<THREE.Texture | null>
  >();

// ==================================================
// URL CACHE
// ==================================================

/**
 * Normalized storage path
 * ->
 * Resolved download URL
 *
 * This avoids repeatedly calling
 * resolveStoragePath() for the same asset.
 */
const textureURLCache =
  new Map<
    string,
    string
  >();

/**
 * In-flight URL resolution cache.
 *
 * This prevents multiple calls to
 * resolveStoragePath() for the same path.
 */
const textureURLPromiseCache =
  new Map<
    string,
    Promise<string | null>
  >();

// ==================================================
// PATH NORMALIZATION
// ==================================================

function normalizeStoragePath(
  path: string
): string {
  return path
    .trim()
    .replace(
      /^gs:\/\/[^/]+\//,
      ""
    )
    .replace(
      /^\/+/,
      ""
    );
}

// ==================================================
// RESOLVE TEXTURE URL
// ==================================================

async function resolveTextureURL(
  normalizedPath: string
): Promise<string | null> {

  // --------------------------------------------------
  // 1. Already resolved
  // --------------------------------------------------

  const cachedURL =
    textureURLCache.get(
      normalizedPath
    );

  if (cachedURL) {
    return cachedURL;
  }

  // --------------------------------------------------
  // 2. Already resolving
  // --------------------------------------------------

  const existingPromise =
    textureURLPromiseCache.get(
      normalizedPath
    );

  if (existingPromise) {
    return existingPromise;
  }

  // --------------------------------------------------
  // 3. Resolve URL
  // --------------------------------------------------

  const promise =
    (async () => {

      try {

        const url =
          await resolveStoragePath(
            normalizedPath
          );

        if (!url) {
          console.error(
            "[AssetPreview] Could not resolve texture URL:",
            normalizedPath
          );

          return null;
        }

        textureURLCache.set(
          normalizedPath,
          url
        );

        return url;

      } catch (error) {

        console.error(
          "[AssetPreview] Failed to resolve texture URL:",
          {
            path: normalizedPath,
            error,
          }
        );

        return null;

      } finally {

        textureURLPromiseCache.delete(
          normalizedPath
        );

      }

    })();

  textureURLPromiseCache.set(
    normalizedPath,
    promise
  );

  return promise;
}

// ==================================================
// LOAD TEXTURE
// ==================================================

export async function loadTexture(
  path?: string | null,
  options?: {
    repeat?: [number, number];
    anisotropy?: number;
  }
): Promise<THREE.Texture | null> {

  // --------------------------------------------------
  // No path
  // --------------------------------------------------

  if (!path?.trim()) {
    return null;
  }

  const normalizedPath =
    normalizeStoragePath(path);

  // --------------------------------------------------
  // 1. COMPLETED CACHE
  //
  // Fastest possible path.
  // --------------------------------------------------

  const cachedTexture =
    textureCache.get(
      normalizedPath
    );

  if (cachedTexture) {
    return cachedTexture;
  }

  // --------------------------------------------------
  // 2. IN-FLIGHT CACHE
  //
  // Another component is already loading it.
  // --------------------------------------------------

  const existingPromise =
    texturePromiseCache.get(
      normalizedPath
    );

  if (existingPromise) {
    return existingPromise;
  }

  // --------------------------------------------------
  // 3. START LOADING
  // --------------------------------------------------

  const loadPromise =
    (async () => {

      // ----------------------------------------------
      // Resolve URL
      // ----------------------------------------------

      const url =
        await resolveTextureURL(
          normalizedPath
        );

      if (!url) {
        return null;
      }

      try {

        console.log(
          "[AssetPreview] Loading diffuse texture:",
          {
            path: normalizedPath,
            url,
          }
        );

        // --------------------------------------------
        // Load image
        // --------------------------------------------

        const texture =
          await textureLoader.loadAsync(
            url
          );

        // --------------------------------------------
        // Texture configuration
        // --------------------------------------------

        texture.wrapS =
          THREE.RepeatWrapping;

        texture.wrapT =
          THREE.RepeatWrapping;

        const repeat =
          options?.repeat ?? [1, 1];

        texture.repeat.set(
          repeat[0],
          repeat[1]
        );

        texture.anisotropy =
          options?.anisotropy ?? 8;

        texture.colorSpace =
          THREE.SRGBColorSpace;

        texture.needsUpdate =
          true;

        // --------------------------------------------
        // Save completed texture
        // --------------------------------------------

        textureCache.set(
          normalizedPath,
          texture
        );

        console.log(
          "[AssetPreview] Diffuse texture loaded:",
          {
            path: normalizedPath,
            image: texture.image,
            colorSpace:
              texture.colorSpace,
            repeat: [
              texture.repeat.x,
              texture.repeat.y,
            ],
          }
        );

        return texture;

      } catch (error) {

        console.error(
          "[AssetPreview] Failed to load diffuse texture:",
          {
            path: normalizedPath,
            url,
            error,
          }
        );

        return null;

      } finally {

        // --------------------------------------------
        // Loading completed.
        // --------------------------------------------

        texturePromiseCache.delete(
          normalizedPath
        );

      }

    })();

  // Save the request immediately.
  texturePromiseCache.set(
    normalizedPath,
    loadPromise
  );

  return loadPromise;
}

// ==================================================
// LOAD ASSET TEXTURES
// ==================================================

export async function loadAssetTextures(
  asset: Asset
): Promise<PreviewTextures> {

  if (!asset.diffuse_path?.trim()) {
    return {
      diffuse: null,
    };
  }

  const diffuse =
    await loadTexture(
      asset.diffuse_path,
      {
        repeat: [1, 1],
        anisotropy: 8,
      }
    );

  return {
    diffuse,
  };
}

// ==================================================
// TEXTURE HELPERS
// ==================================================

export function hasTextures(
  asset: Asset
): boolean {

  return Boolean(
    asset.diffuse_path?.trim()
  );

}

export function hasMaterialProperties(
  asset: Asset
): boolean {

  return Boolean(
    asset.color != null ||
    asset.roughness != null ||
    asset.metalness != null
  );

}

// ==================================================
// CACHE ACCESS
// ==================================================

/**
 * Returns a texture immediately if it has
 * already been loaded.
 *
 * Does not start a network request.
 */
export function getCachedTexture(
  path?: string | null
): THREE.Texture | null {

  if (!path?.trim()) {
    return null;
  }

  const normalizedPath =
    normalizeStoragePath(path);

  return (
    textureCache.get(
      normalizedPath
    ) ?? null
  );

}

/**
 * Returns a resolved URL immediately if
 * it has already been resolved.
 */
export function getCachedTextureURL(
  path?: string | null
): string | null {

  if (!path?.trim()) {
    return null;
  }

  const normalizedPath =
    normalizeStoragePath(path);

  return (
    textureURLCache.get(
      normalizedPath
    ) ?? null
  );

}

// ==================================================
// CLEAR SINGLE TEXTURE
// ==================================================

export function clearTextureCache(
  path: string
): void {

  const normalizedPath =
    normalizeStoragePath(path);

  // ----------------------------------------------
  // Dispose THREE.Texture
  // ----------------------------------------------

  const texture =
    textureCache.get(
      normalizedPath
    );

  if (texture) {
    texture.dispose();
  }

  // ----------------------------------------------
  // Remove texture
  // ----------------------------------------------

  textureCache.delete(
    normalizedPath
  );

  // ----------------------------------------------
  // Remove URL
  // ----------------------------------------------

  textureURLCache.delete(
    normalizedPath
  );

  // ----------------------------------------------
  // Remove in-flight requests
  // ----------------------------------------------

  texturePromiseCache.delete(
    normalizedPath
  );

  textureURLPromiseCache.delete(
    normalizedPath
  );

}

// ==================================================
// CLEAR EVERYTHING
// ==================================================

export function clearAllTextureCache(): void {

  // ----------------------------------------------
  // Dispose textures
  // ----------------------------------------------

  textureCache.forEach(
    texture => {
      texture.dispose();
    }
  );

  // ----------------------------------------------
  // Clear completed textures
  // ----------------------------------------------

  textureCache.clear();

  // ----------------------------------------------
  // Clear resolved URLs
  // ----------------------------------------------

  textureURLCache.clear();

  // ----------------------------------------------
  // Clear in-flight texture requests
  // ----------------------------------------------

  texturePromiseCache.clear();

  // ----------------------------------------------
  // Clear in-flight URL requests
  // ----------------------------------------------

  textureURLPromiseCache.clear();

}
