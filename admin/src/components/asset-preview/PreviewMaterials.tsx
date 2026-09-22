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

/**
 * Material properties used by the
 * room's solid geometry.
 *
 * Polygon offset helps prevent
 * z-fighting with edges/lines.
 */
export const SOLID_MATERIAL_PROPS = {
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
} as const;

const DEFAULT_COLOR =
  "#ffffff";

const DEFAULT_FLOOR_COLOR =
  "#e4b763";

const DEFAULT_ROUGHNESS =
  0.85;

const DEFAULT_METALNESS =
  0;

/**
 * Asset material.
 *
 * Supported:
 *
 * - Diffuse texture
 * - Firestore color
 * - Firestore roughness
 * - Firestore metalness
 *
 * Not supported:
 *
 * - Normal map
 * - Roughness map
 * - AO map
 *
 * meshStandardMaterial is used so the
 * surface can interact with lighting
 * and shadows.
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
    });

  useEffect(() => {
    let cancelled = false;

    async function loadTextures() {
      /**
       * Remove the previous texture
       * immediately when the selected
       * asset changes.
       */
      setTextures({
        diffuse: null,
      });

      /**
       * If there is no diffuse texture,
       * simply use the Firestore color.
       */
      if (!hasTextures(asset)) {
        console.log(
          "[PreviewMaterials] No diffuse texture:",
          asset.name
        );

        return;
      }

      console.log(
        "[PreviewMaterials] Loading asset diffuse:",
        {
          asset: asset.name,
          assetId: asset.id,
          diffuse:
            asset.diffuse_path,
        }
      );

      try {
        const loadedTextures =
          await loadAssetTextures(
            asset
          );

        /**
         * Do not apply an old texture
         * if the selected asset changed
         * while loading.
         */
        if (cancelled) {
          return;
        }

        console.log(
          "[PreviewMaterials] DIFFUSE CHECK:",
          {
            asset: asset.name,
            diffuse:
              !!loadedTextures.diffuse,
          }
        );

        setTextures(
          loadedTextures
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[PreviewMaterials] Failed to load diffuse texture:",
            error
          );
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
  ]);

  /**
   * Firestore color is used when
   * there is no diffuse texture.
   */
  const color =
    asset.color ??
    defaultColor;

  /**
   * Firestore material properties.
   *
   * These are values, not texture maps.
   */
  const roughness =
    asset.roughness ??
    DEFAULT_ROUGHNESS;

  const metalness =
    asset.metalness ??
    DEFAULT_METALNESS;

  /**
   * When a diffuse texture exists,
   * use white so the texture isn't
   * multiplied/tinted by another color.
   *
   * When there is no texture,
   * use the Firestore/default color.
   */
  const materialColor =
    textures.diffuse
      ? "#ffffff"
      : color;

  console.log(
    "[PreviewMaterials] Material:",
    {
      asset: asset.name,
      diffuseLoaded:
        !!textures.diffuse,
      color:
        materialColor,
      roughness,
      metalness,
    }
  );

  return (
    <meshStandardMaterial
      color={
        materialColor
      }

      /**
       * Firebase diffuse texture.
       */
      map={
        textures.diffuse
      }

      /**
       * Firestore material properties.
       *
       * These are only numeric values.
       * There are no roughness/normal/AO maps.
       */
      roughness={
        roughness
      }

      metalness={
        metalness
      }

      /**
       * Keep the existing room
       * material configuration.
       */
      {...SOLID_MATERIAL_PROPS}
    />
  );
}

/**
 * Wall material.
 */
export function WallMaterial({
  asset,
}: {
  asset: Asset | null;
}) {
  /**
   * No wall asset selected.
   */
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
      key={asset.id}
      asset={asset}
      defaultColor={
        DEFAULT_COLOR
      }
    />
  );
}

/**
 * Floor material.
 */
export function FloorMaterial({
  asset,
}: {
  asset: Asset | null;
}) {
  /**
   * No floor asset selected.
   */
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
      key={asset.id}
      asset={asset}
      defaultColor={
        DEFAULT_FLOOR_COLOR
      }
    />
  );
}

/**
 * Generic asset preview material.
 */
export function AssetPreviewMaterial({
  asset,
}: {
  asset: Asset | null;
}) {
  /**
   * No asset selected.
   */
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
      key={asset.id}
      asset={asset}
      defaultColor={
        DEFAULT_COLOR
      }
    />
  );
}