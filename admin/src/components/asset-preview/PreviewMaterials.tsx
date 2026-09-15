import {
  useEffect,
  useState,
} from "react";

import type {
  Asset,
} from "@/services/assets/asset-types";

import {
  loadAssetTextures,
  hasTextures,
  type PreviewTextures,
} from "./assetPreviewUtils";

export const SOLID_MATERIAL_PROPS = {
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
} as const;

/**
 * Default material values.
 */
const DEFAULT_COLOR =
  "#ffffff";

const DEFAULT_FLOOR_COLOR =
  "#e4b763";

const DEFAULT_ROUGHNESS =
  0.85;

const DEFAULT_METALNESS =
  0;

/**
 * Hybrid material component.
 *
 * This supports:
 *
 * 1. Paint/material-only assets
 * 2. Fully textured assets
 * 3. Partially textured assets
 * 4. Hybrid assets
 *
 * Every texture map is optional.
 */
function AssetMaterial({
  asset,
  defaultColor,
}: {
  asset: Asset;
  defaultColor: string;
}) {
  const [
    textures,
    setTextures,
  ] =
    useState<PreviewTextures>({
      diffuse: null,
      normal: null,
      rough: null,
      ao: null,
    });

  const [
    loading,
    setLoading,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTextures() {
      /**
       * Reset when the selected asset changes.
       */
      setTextures({
        diffuse: null,
        normal: null,
        rough: null,
        ao: null,
      });

      /**
       * If the asset has no texture paths,
       * don't even start texture loading.
       *
       * This is important for paint assets.
       */
      if (!hasTextures(asset)) {
        setLoading(false);
        return;
      }

      setLoading(true);

      console.log(
        "[PreviewMaterials] Loading available textures:",
        {
          asset: asset.name,
          diffuse:
            asset.diffuse_path,
          normal:
            asset.normal_path,
          rough:
            asset.rough_path,
          ao:
            asset.ao_path,
        }
      );

      try {
        const loadedTextures =
          await loadAssetTextures(
            asset
          );

        if (cancelled) {
          return;
        }

        setTextures(
          loadedTextures
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[PreviewMaterials] Failed to load asset textures:",
            error
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTextures();

    return () => {
      cancelled = true;
    };
  }, [
    asset.id,
    asset.diffuse_path,
    asset.normal_path,
    asset.rough_path,
    asset.ao_path,
  ]);

  /**
   * Dispose textures when this material
   * is no longer using them.
   *
   * NOTE:
   *
   * Cached textures are managed by
   * assetPreviewUtils.
   *
   * Therefore we should NOT dispose them here.
   *
   * The cache owns their lifecycle.
   */

  const color =
    asset.color ??
    defaultColor;

  const roughness =
    asset.roughness ??
    DEFAULT_ROUGHNESS;

  const metalness =
    asset.metalness ??
    DEFAULT_METALNESS;

  /**
   * A diffuse texture already contains
   * the visible color information.
   *
   * In that case we use white so the
   * texture isn't tinted.
   *
   * If there is no diffuse texture,
   * the Firestore color is used.
   */
  const materialColor =
    textures.diffuse
      ? "#ffffff"
      : color;

  /**
   * Avoid an unnecessary render state
   * while textures are being loaded.
   *
   * The material will initially use
   * the color/material properties and
   * then update when textures arrive.
   */
  void loading;

  return (
    <meshStandardMaterial
      color={materialColor}

      map={
        textures.diffuse
      }

      normalMap={
        textures.normal
      }

      roughnessMap={
        textures.rough
      }

      aoMap={
        textures.ao
      }

      roughness={roughness}

      metalness={metalness}

      {...SOLID_MATERIAL_PROPS}
    />
  );
}

/**
 * Wall material.
 *
 * Can be:
 *
 * - paint only
 * - textured
 * - partially textured
 * - hybrid
 */
export function WallMaterial({
  asset,
}: {
  asset: Asset | null;
}) {
  if (
    !asset ||
    asset.asset_type !==
      "wall"
  ) {
    return (
      <meshStandardMaterial
        color={
          DEFAULT_COLOR
        }
        roughness={
          DEFAULT_ROUGHNESS
        }
        metalness={
          DEFAULT_METALNESS
        }
        {...SOLID_MATERIAL_PROPS}
      />
    );
  }

  return (
    <AssetMaterial
      asset={asset}
      defaultColor={
        DEFAULT_COLOR
      }
    />
  );
}

/**
 * Floor material.
 *
 * Can be:
 *
 * - color/material only
 * - textured
 * - partially textured
 * - hybrid
 */
export function FloorMaterial({
  asset,
}: {
  asset: Asset | null;
}) {
  if (
    !asset ||
    asset.asset_type !==
      "floor"
  ) {
    return (
      <meshStandardMaterial
        color={
          DEFAULT_FLOOR_COLOR
        }
        roughness={
          DEFAULT_ROUGHNESS
        }
        metalness={
          DEFAULT_METALNESS
        }
        {...SOLID_MATERIAL_PROPS}
      />
    );
  }

  return (
    <AssetMaterial
      asset={asset}
      defaultColor={
        DEFAULT_FLOOR_COLOR
      }
    />
  );
}

/**
 * Optional generic material for future
 * furniture/material previews.
 *
 * You can use this later when furniture
 * assets start using the same hybrid
 * material system.
 */
export function AssetPreviewMaterial({
  asset,
}: {
  asset: Asset | null;
}) {
  if (!asset) {
    return (
      <meshStandardMaterial
        color="#ffffff"
        roughness={
          DEFAULT_ROUGHNESS
        }
        metalness={
          DEFAULT_METALNESS
        }
        {...SOLID_MATERIAL_PROPS}
      />
    );
  }

  return (
    <AssetMaterial
      asset={asset}
      defaultColor={
        DEFAULT_COLOR
      }
    />
  );
}

