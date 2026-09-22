import * as THREE from "three";

import type { Asset } from "@/services/assets/asset-types";

import {
  resolveStoragePath,
} from "./preview-textures";

export interface PreviewTextures {
  diffuse: THREE.Texture | null;
}

export interface PreviewTextureURLs {
  diffuseURL: string | null;
}

export async function resolveModelURL(
  asset: Asset
): Promise<string | null> {
  return resolveStoragePath(
    asset.storage_path
  );
}

export async function resolveTextureURLs(
  asset: Asset
): Promise<PreviewTextureURLs> {
  const diffuseURL =
    await resolveStoragePath(
      asset.diffuse_path
    );

  return {
    diffuseURL,
  };
}

export async function resolvePreviewURLs(
  asset: Asset
) {
  const [
    modelURL,
    textureURLs,
  ] = await Promise.all([
    resolveModelURL(asset),
    resolveTextureURLs(asset),
  ]);

  return {
    modelURL,
    ...textureURLs,
  };
}

const textureLoader =
  new THREE.TextureLoader();

/**
 * Completed texture cache.
 *
 * normalizedStoragePath -> THREE.Texture
 */
const textureCache =
  new Map<string, THREE.Texture>();

/**
 * In-flight texture loading cache.
 *
 * normalizedStoragePath -> Promise<THREE.Texture | null>
 *
 * This prevents multiple components/effects from
 * downloading the same texture at the same time.
 */
const texturePromiseCache =
  new Map<
    string,
    Promise<THREE.Texture | null>
  >();

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

export async function loadTexture(
  path?: string | null,
  options?: {
    repeat?: [number, number];
    anisotropy?: number;
  }
): Promise<THREE.Texture | null> {
  if (!path?.trim()) {
    return null;
  }

  const normalizedPath =
    normalizeStoragePath(path);

  // --------------------------------------------------
  // 1. Return already-loaded texture immediately
  // --------------------------------------------------

  const cachedTexture =
    textureCache.get(
      normalizedPath
    );

  if (cachedTexture) {
    return cachedTexture;
  }

  // --------------------------------------------------
  // 2. Reuse an existing loading request
  // --------------------------------------------------

  const existingPromise =
    texturePromiseCache.get(
      normalizedPath
    );

  if (existingPromise) {
    return existingPromise;
  }

  // --------------------------------------------------
  // 3. Start a new loading request
  // --------------------------------------------------

  const loadPromise =
    (async () => {
      const url =
        await resolveStoragePath(
          normalizedPath
        );

      if (!url) {
        console.error(
          "[AssetPreview] Could not resolve diffuse texture URL:",
          normalizedPath
        );

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

        const texture =
          await textureLoader.loadAsync(
            url
          );

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

        texture.needsUpdate = true;

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

        // Save completed texture
        textureCache.set(
          normalizedPath,
          texture
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
        // The request has finished, so remove it
        // from the in-flight cache.
        texturePromiseCache.delete(
          normalizedPath
        );
      }
    })();

  // Save the in-flight request immediately.
  texturePromiseCache.set(
    normalizedPath,
    loadPromise
  );

  return loadPromise;
}

export async function loadAssetTextures(
  asset: Asset
): Promise<PreviewTextures> {
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

export function clearTextureCache(
  path: string
): void {
  const normalizedPath =
    normalizeStoragePath(path);

  const texture =
    textureCache.get(
      normalizedPath
    );

  if (texture) {
    texture.dispose();
  }

  textureCache.delete(
    normalizedPath
  );

  // Also cancel reuse of an in-flight
  // promise for this path.
  texturePromiseCache.delete(
    normalizedPath
  );
}

export function clearAllTextureCache(): void {
  textureCache.forEach(
    (texture) => {
      texture.dispose();
    }
  );

  textureCache.clear();
  texturePromiseCache.clear();
}