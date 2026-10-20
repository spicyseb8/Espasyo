import { useGLTF } from "@react-three/drei";
import { DefaultLoadingManager, TextureLoader } from "three";

import { getFurnitureAssets } from "@/services/assets/furnitureload";
import { getDoorWindowAssets } from "@/services/assets/FirebaseDoorWindowLibrary";
import {
  getFloorMaterials,
  preloadFloorTexture,
} from "@/services/assets/floorsload";
import { getWallMaterials } from "@/services/assets/wallsload";
import type { Asset } from "./engine/assets/Asset";
import type { Material } from "./engine/materials/MaterialTypes";

const MODEL_BATCH_SIZE = 2;
const TEXTURE_BATCH_SIZE = 4;
const BATCH_TIMEOUT_MS = 45_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function collectIds(value: unknown): Set<string> {
  const ids = new Set<string>();

  function collect(current: unknown): void {
    if (typeof current === "string") {
      if (current.trim()) ids.add(current.trim());
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(collect);
      return;
    }

    const record = asRecord(current);
    if (record) Object.values(record).forEach(collect);
  }

  collect(value);
  return ids;
}

function projectAssetIds(projectData: unknown): Set<string> {
  const project = asRecord(projectData);
  const ids = new Set<string>();

  for (const field of ["furniture", "doors", "windows"]) {
    const items = project?.[field];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const assetId = asRecord(item)?.assetId;
      if (typeof assetId === "string" && assetId.trim()) {
        ids.add(assetId.trim());
      }
    }
  }

  return ids;
}

async function preloadModelBatch(urls: string[]): Promise<void> {
  const manager = DefaultLoadingManager;
  const targets = new Set(urls);
  const started = new Set<string>();
  const ended = new Set<string>();
  const originalItemStart = manager.itemStart;
  const originalItemEnd = manager.itemEnd;

  await new Promise<void>((resolve) => {
    let settled = false;
    let timeout: number;

    const restore = () => {
      window.clearTimeout(timeout);
      if (manager.itemStart === itemStart) manager.itemStart = originalItemStart;
      if (manager.itemEnd === itemEnd) manager.itemEnd = originalItemEnd;
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      restore();
      resolve();
    };

    const checkFinished = () => {
      if (started.size > 0 && [...started].every((url) => ended.has(url))) {
        finish();
      }
    };

    const itemStart: typeof manager.itemStart = (url) => {
      if (targets.has(url)) started.add(url);
      originalItemStart.call(manager, url);
    };

    const itemEnd: typeof manager.itemEnd = (url) => {
      originalItemEnd.call(manager, url);
      if (targets.has(url) && started.has(url)) {
        ended.add(url);
        checkFinished();
      }
    };

    manager.itemStart = itemStart;
    manager.itemEnd = itemEnd;
    const timeoutId = window.setTimeout(() => {
      console.warn("Timed out waiting for project models; opening the viewer.");
      finish();
    }, BATCH_TIMEOUT_MS);
    timeout = timeoutId;

    for (const url of urls) {
      useGLTF.preload(url);
    }

    if (started.size === 0) finish();
    else checkFinished();
  });
}

async function preloadModels(urls: string[]): Promise<void> {
  for (let index = 0; index < urls.length; index += MODEL_BATCH_SIZE) {
    await preloadModelBatch(urls.slice(index, index + MODEL_BATCH_SIZE));
  }
}

async function preloadWallTextures(urls: string[]): Promise<void> {
  const loader = new TextureLoader();

  for (let index = 0; index < urls.length; index += TEXTURE_BATCH_SIZE) {
    const batch = urls.slice(index, index + TEXTURE_BATCH_SIZE);
    await Promise.all(batch.map((url) => new Promise<void>((resolve) => {
      loader.load(
        url,
        (texture) => {
          texture.dispose();
          resolve();
        },
        undefined,
        () => resolve(),
      );
    })));
  }
}

export async function preloadAdminProjectAssets(projectData: unknown): Promise<void> {
  const results = await Promise.allSettled([
    getFurnitureAssets(),
    getDoorWindowAssets(),
    getFloorMaterials(),
    getWallMaterials(),
  ]);

  const readResult = <T,>(index: number, label: string): T[] => {
    const result = results[index];
    if (result.status === "fulfilled") return result.value as T[];
    console.warn(`Unable to preload the ${label} catalog.`);
    return [];
  };

  const furniture = readResult<Asset>(0, "furniture");
  const doorsAndWindows = readResult<Asset>(1, "door and window");
  const floors = readResult<Material>(2, "floor material");
  const walls = readResult<Material>(3, "wall material");

  const assetsById = new Map(
    [...furniture, ...doorsAndWindows].map((asset) => [asset.id, asset]),
  );
  const usedAssetIds = projectAssetIds(projectData);
  const modelUrls = [...usedAssetIds]
    .map((id) => assetsById.get(id)?.model)
    .filter((url): url is string => typeof url === "string" && Boolean(url.trim()));

  const project = asRecord(projectData);
  const floorIds = collectIds(project?.floorFinishes);
  const wallIds = collectIds(project?.wallFinishes);
  const floorUrls = floors
    .filter((material) => floorIds.has(material.id))
    .map((material) => material.texture)
    .filter((url): url is string => typeof url === "string" && Boolean(url.trim()));
  const wallUrls = walls
    .filter((material) => wallIds.has(material.id))
    .map((material) => material.texture)
    .filter((url): url is string => typeof url === "string" && Boolean(url.trim()));

  await Promise.all([
    preloadModels([...new Set(modelUrls)]),
    Promise.all(floorUrls.map((url) => preloadFloorTexture(url))),
    preloadWallTextures([...new Set(wallUrls)]),
  ]);
}