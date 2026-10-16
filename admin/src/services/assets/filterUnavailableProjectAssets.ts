import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { SavedProjectData } from "@/components/project-loader/ProjectTypes";

const LOCAL_ASSET_IDS = new Set([
  "d-sd01",
  "w-sw02",
  "w-sw03",
  "test-chair",
  "bed1",
  "round-side-table",
  "desk-for-room",
  "test-tv-stand",
  "test-sofa",
  "chair2",
  "floor-wood-oak",
  "floor-ceramic-white",
  "floor-concrete",
]);

interface AssetRecord {
  id: string;
  name: string;
  assetType: string;
  category: string;
  status: string;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isUnavailableStatus(status: string): boolean {
  return status.trim().toLowerCase() === "not_available";
}

function isLocalAsset(assetId: string): boolean {
  return LOCAL_ASSET_IDS.has(assetId);
}

export async function filterUnavailableProjectAssets(
  projectData: SavedProjectData
): Promise<SavedProjectData> {
  const snapshot = await getDocs(collection(db, "assets"));
  const assetsById = new Map<string, AssetRecord>();

  for (const document of snapshot.docs) {
    const data = document.data();
    const asset: AssetRecord = {
      id: typeof data.id === "string" ? data.id : document.id,
      name: typeof data.name === "string" ? data.name : "",
      assetType: typeof data.asset_type === "string" ? data.asset_type : "",
      category: typeof data.category === "string" ? data.category : "",
      status:
        typeof data.asset_status === "string" ? data.asset_status : "",
    };

    assetsById.set(document.id, asset);
    assetsById.set(asset.id, asset);
  }

  const unavailableIds = new Set<string>();
  const unavailableCostNames = new Map<string, Set<string>>();
  const referencedIds = new Set<string>([
    ...projectData.furniture.map((item) => item.assetId),
    ...projectData.doors.map((item) => item.assetId),
    ...projectData.windows.map((item) => item.assetId),
    ...Object.values(projectData.floorFinishes),
    ...Object.values(projectData.wallFinishes).flatMap((finishes) =>
      Object.values(finishes)
    ),
  ]);

  for (const assetId of referencedIds) {
    const asset = assetsById.get(assetId);
    const unavailable = asset
      ? isUnavailableStatus(asset.status)
      : !isLocalAsset(assetId);

    if (!unavailable) {
      continue;
    }

    unavailableIds.add(assetId);

    if (asset?.name) {
      const category =
        asset.assetType === "floor"
          ? "flooring"
          : asset.assetType === "wall"
            ? "wallFinish"
            : asset.category.trim().toLowerCase() === "doors"
              ? "doors"
              : asset.category.trim().toLowerCase() === "windows"
                ? "windows"
                : "furniture";
      const names = unavailableCostNames.get(category) ?? new Set<string>();
      names.add(normalizeName(asset.name));
      unavailableCostNames.set(category, names);
    }
  }

  const costEstimate = projectData.costEstimate;
  const filteredProjectData: SavedProjectData = {
    ...projectData,
    furniture: projectData.furniture.filter(
      (item) => !unavailableIds.has(item.assetId)
    ),
    doors: projectData.doors.filter(
      (item) => !unavailableIds.has(item.assetId)
    ),
    windows: projectData.windows.filter(
      (item) => !unavailableIds.has(item.assetId)
    ),
    floorFinishes: Object.fromEntries(
      Object.entries(projectData.floorFinishes).filter(
        ([, assetId]) => !unavailableIds.has(assetId)
      )
    ),
    wallFinishes: Object.fromEntries(
      Object.entries(projectData.wallFinishes).map(([regionId, finishes]) => [
        regionId,
        Object.fromEntries(
          Object.entries(finishes).filter(
            ([, assetId]) => !unavailableIds.has(assetId)
          )
        ),
      ])
    ),
  };

  if (!costEstimate) {
    return filteredProjectData;
  }

  const costItems = costEstimate.items.filter((item) => {
    const unavailableNames = unavailableCostNames.get(item.category);
    return !unavailableNames?.has(normalizeName(item.name));
  });
  const removedCost = costEstimate.items
    .filter((item) => !costItems.includes(item))
    .reduce((total, item) => total + item.subtotal, 0);
  const savedTotal = Number(costEstimate.total);
  const savedSubtotal = Number(costEstimate.subtotal);

  return {
    ...filteredProjectData,
    costEstimate: {
      ...costEstimate,
      items: costItems,
      subtotal: Math.max(
        0,
        (Number.isFinite(savedSubtotal) ? savedSubtotal : savedTotal) -
          removedCost
      ),
      total: Math.max(
        0,
        (Number.isFinite(savedTotal) ? savedTotal : savedSubtotal) -
          removedCost
      ),
    },
  };
}
