import { Suspense, useEffect, useMemo, useState } from "react";
import { Bounds, Center, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import type { Asset } from "@/services/assets/asset-types";
import { resolveStoragePath } from "./preview-textures";
import { disposeClonedMaterials } from "@/lib/disposeClonedMaterials";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
        if (Array.isArray(object.material)) {
          object.material = object.material.map((material) => material.clone());
        } else if (object.material) {
          object.material = object.material.clone();
        }
      }
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    return () => disposeClonedMaterials(clonedScene);
  }, [clonedScene]);

  return (
    <Bounds fit clip margin={1.15}>
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </Bounds>
  );
}

function LoadingPreview() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </mesh>
  );
}

export default function AssetThumbnail({
  asset,
  className = "h-full w-full",
  staticPreview = false,
}: {
  asset: Asset;
  className?: string;
  staticPreview?: boolean;
}) {
  const [resolvedPreview, setResolvedPreview] = useState<{
    key: string;
    model: string | null;
    texture: string | null;
    thumbnail: string | null;
  } | null>(null);
  const [failedPreviewKey, setFailedPreviewKey] = useState<string | null>(null);
  const { asset_type } = asset;
  const cacheable = asset.asset_status?.trim().toLowerCase() === "available";
  const modelPath = asset.model_url?.trim() || asset.storage_path?.trim() || asset.model_path?.trim();
  const thumbnailPath = asset.thumbnail_url?.trim() || asset.thumbnail_path?.trim();
  const texturePath = asset.diffuse_url?.trim() || asset.base_color_url?.trim() || asset.diffuse_path?.trim() || asset.base_color_path?.trim();
  const previewKey = JSON.stringify([
    asset.id,
    asset_type,
    cacheable,
    modelPath,
    staticPreview,
    texturePath,
    thumbnailPath,
  ]);
  const currentPreview =
    resolvedPreview?.key === previewKey ? resolvedPreview : null;
  const modelURL = currentPreview?.model ?? null;
  const textureURL = currentPreview?.texture ?? null;
  const thumbnailURL = currentPreview?.thumbnail ?? null;
  const thumbnailFailed = failedPreviewKey === previewKey;
  const loading = currentPreview === null;

  useEffect(() => {
    let cancelled = false;

    const loadPreviewURLs = async () => {
      const [model, texture, thumbnail] = await Promise.all([
        asset_type === "furniture" &&
          !staticPreview &&
          !thumbnailPath &&
          modelPath
          ? resolveStoragePath(modelPath, cacheable)
          : null,
        texturePath ? resolveStoragePath(texturePath, cacheable) : null,
        asset_type === "furniture" && thumbnailPath
          ? resolveStoragePath(thumbnailPath, cacheable)
          : null,
      ]);
      if (!cancelled) {
        setResolvedPreview({
          key: previewKey,
          model,
          texture,
          thumbnail,
        });
      }
    };

    void loadPreviewURLs().catch((error: unknown) => {
      console.error("Failed to load asset preview:", error);
      if (!cancelled) {
        setResolvedPreview({
          key: previewKey,
          model: null,
          texture: null,
          thumbnail: null,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [asset_type, cacheable, modelPath, previewKey, staticPreview, texturePath, thumbnailPath]);

  if (thumbnailURL && !thumbnailFailed) {
    return (
      <img
        src={thumbnailURL}
        alt={asset.name}
        className={`${className} object-contain`}
        onError={() => setFailedPreviewKey(previewKey)}
      />
    );
  }

  if (asset_type === "furniture" && staticPreview) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <span className="text-xs text-neutral-400">
          {loading ? "Loading preview..." : "Preview unavailable"}
        </span>
      </div>
    );
  }

  if (modelURL && (asset_type === "furniture" || !textureURL)) {
    return (
      <Canvas
        camera={{ position: [2.5, 2, 2.5], fov: 35 }}
        dpr={[1, 1]}
        gl={{ antialias: true, alpha: true }}
        className={className}
        style={{ pointerEvents: "none" }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 4]} intensity={2.5} />
        <directionalLight position={[-3, 2, -2]} intensity={1.2} />
        <Suspense fallback={<LoadingPreview />}>
          <Model url={modelURL} />
        </Suspense>
      </Canvas>
    );
  }

  if (textureURL) {
    return <img src={textureURL} alt={asset.name} className={`${className} object-cover`} />;
  }

  if (asset.color) {
    return <div className={className} style={{ backgroundColor: asset.color }} />;
  }

  return (
    <div className={`${className} flex items-center justify-center`}>
      <span className="text-xs text-neutral-400">No preview</span>
    </div>
  );
}