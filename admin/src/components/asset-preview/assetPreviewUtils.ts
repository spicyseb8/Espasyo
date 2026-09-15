
import * as THREE from "three";

import type {
  Asset,
} from "@/services/assets/asset-types";

import {
  resolveStoragePath,
} from "./preview-textures";

/**
 * Textures that can be used by a material.
 *
 * Every texture is optional.
 *
 * An asset can therefore have:
 *
 * diffuse only
 * diffuse + normal
 * diffuse + normal + roughness
 * all four
 * or no textures at all.
 */
export interface PreviewTextures {
  diffuse: THREE.Texture | null;
  normal: THREE.Texture | null;
  rough: THREE.Texture | null;
  ao: THREE.Texture | null;
}

/**
 * Resolved Firebase Storage URLs.
 *
 * This contains URLs only.
 *
 * It does NOT contain downloaded texture data.
 */
export interface PreviewTextureURLs {
  diffuseURL: string | null;
  normalURL: string | null;
  roughURL: string | null;
  aoURL: string | null;
}

/**
 * Resolve a model Storage path.
 *
 * If the asset does not have a model path,
 * null is returned.
 */
export async function resolveModelURL(
  asset: Asset
): Promise<string | null> {
  return resolveStoragePath(
    asset.storage_path
  );
}

/**
 * Resolve all texture URLs that actually exist
 * on the asset.
 *
 * Missing/null/empty paths are skipped.
 *
 * This function only resolves URLs.
 * It does NOT download image data.
 */
export async function resolveTextureURLs(
  asset: Asset
): Promise<PreviewTextureURLs> {
  const [
    diffuseURL,
    normalURL,
    roughURL,
    aoURL,
  ] = await Promise.all([
    resolveStoragePath(
      asset.diffuse_path
    ),

    resolveStoragePath(
      asset.normal_path
    ),

    resolveStoragePath(
      asset.rough_path
    ),

    resolveStoragePath(
      asset.ao_path
    ),
  ]);

  return {
    diffuseURL,
    normalURL,
    roughURL,
    aoURL,
  };
}

/**
 * Resolve all Storage URLs needed by
 * the asset preview.
 *
 * This does not download texture files.
 */
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

/**
 * Three.js texture loader.
 *
 * Kept here so texture loading is centralized
 * instead of being duplicated inside components.
 */
const textureLoader =
  new THREE.TextureLoader();

/**
 * Cache loaded Three.js textures.
 *
 * This is separate from the Storage URL cache.
 *
 * Storage URL cache:
 *
 *     path → URL
 *
 * Texture cache:
 *
 *     path → THREE.Texture
 */
const textureCache =
  new Map<
    string,
    THREE.Texture
  >();

/**
 * Load one texture from a Firebase Storage path.
 *
 * If the path is missing/null/empty:
 *
 *     return null
 *
 * No Firebase Storage request is made.
 */
export async function loadTexture(
  path?: string | null,
  options?: {
    colorTexture?: boolean;
    repeat?: [number, number];
    anisotropy?: number;
  }
): Promise<THREE.Texture | null> {
  /**
   * No texture specified.
   */
  if (!path?.trim()) {
    return null;
  }

  const normalizedPath =
    path
      .trim()
      .replace(
        /^gs:\/\/[^/]+\//,
        ""
      )
      .replace(
        /^\/+/,
        ""
      );

  /**
   * Return already-loaded texture.
   */
  const cachedTexture =
    textureCache.get(
      normalizedPath
    );

  if (cachedTexture) {
    return cachedTexture;
  }

  /**
   * First resolve the Firebase Storage URL.
   */
  const url =
    await resolveStoragePath(
      normalizedPath
    );

  if (!url) {
    return null;
  }

  try {
    const texture =
      await textureLoader.loadAsync(
        url
      );

    /**
     * Configure texture wrapping.
     */
    texture.wrapS =
      THREE.RepeatWrapping;

    texture.wrapT =
      THREE.RepeatWrapping;

    /**
     * Default preview repeat.
     */
    const repeat =
      options?.repeat ?? [3, 3];

    texture.repeat.set(
      repeat[0],
      repeat[1]
    );

    /**
     * Improve texture quality when
     * viewed at an angle.
     */
    texture.anisotropy =
      options?.anisotropy ?? 8;

    /**
     * Diffuse/albedo textures contain
     * color information.
     *
     * Normal/AO/Roughness are data textures.
     */
    if (
      options?.colorTexture !== false
    ) {
      texture.colorSpace =
        THREE.SRGBColorSpace;
    } else {
      texture.colorSpace =
        THREE.NoColorSpace;
    }

    texture.needsUpdate = true;

    /**
     * Cache the loaded texture.
     */
    textureCache.set(
      normalizedPath,
      texture
    );

    return texture;
  } catch (error) {
    console.error(
      "[AssetPreview] Failed to load texture:",
      {
        path: normalizedPath,
        url,
        error,
      }
    );

    return null;
  }
}

/**
 * Load every texture that exists on an asset.
 *
 * IMPORTANT:
 *
 * This does NOT require all four maps.
 *
 * Example:
 *
 * diffuse = path
 * normal = path
 * rough = null
 * ao = null
 *
 * Result:
 *
 * {
 *   diffuse: Texture,
 *   normal: Texture,
 *   rough: null,
 *   ao: null
 * }
 */
export async function loadAssetTextures(
  asset: Asset
): Promise<PreviewTextures> {
  const [
    diffuse,
    normal,
    rough,
    ao,
  ] = await Promise.all([
    loadTexture(
      asset.diffuse_path,
      {
        colorTexture: true,
      }
    ),

    loadTexture(
      asset.normal_path,
      {
        colorTexture: false,
      }
    ),

    loadTexture(
      asset.rough_path,
      {
        colorTexture: false,
      }
    ),

    loadTexture(
      asset.ao_path,
      {
        colorTexture: false,
      }
    ),
  ]);

  return {
    diffuse,
    normal,
    rough,
    ao,
  };
}

/**
 * Check whether an asset has at least
 * one texture.
 */
export function hasTextures(
  asset: Asset
): boolean {
  return Boolean(
    asset.diffuse_path?.trim() ||
    asset.normal_path?.trim() ||
    asset.rough_path?.trim() ||
    asset.ao_path?.trim()
  );
}

/**
 * Check whether an asset has material
 * properties.
 */
export function hasMaterialProperties(
  asset: Asset
): boolean {
  return Boolean(
    asset.color != null ||
    asset.roughness != null ||
    asset.metalness != null
  );
}

/**
 * Clear one loaded texture from cache.
 */
export function clearTextureCache(
  path: string
): void {
  const normalizedPath =
    path
      .trim()
      .replace(
        /^gs:\/\/[^/]+\//,
        ""
      )
      .replace(
        /^\/+/,
        ""
      );

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
}

/**
 * Clear all loaded textures.
 */
export function clearAllTextureCache(): void {
  textureCache.forEach(
    (texture) => {
      texture.dispose();
    }
  );

  textureCache.clear();
}

