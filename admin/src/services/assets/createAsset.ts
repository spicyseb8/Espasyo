import { auth } from "@/firebase/firebase";
import type { Asset, AssetStatus, AssetType } from "./asset-types";

export interface CreateAssetInput {
  asset_type: AssetType;
  name: string;
  category: string;
  price: number;
  asset_status: AssetStatus;
  modelFile?: File;
  diffuseFile?: File;
  normalFile?: File;
  roughnessFile?: File;
  aoFile?: File;
  color?: string;
  roughness?: number;
  metalness?: number;
  placement_surface?: "floor" | "wall" | "furniture";
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with an admin account before creating assets.");

  const formData = new FormData();
  formData.append("asset_type", input.asset_type);
  formData.append("name", input.name.trim());
  formData.append("category", input.category.trim());
  formData.append("price", String(input.price));
  formData.append("asset_status", input.asset_status);

  if (input.modelFile) formData.append("modelFile", input.modelFile);
  if (input.diffuseFile) formData.append("diffuseFile", input.diffuseFile);
  if (input.normalFile) formData.append("normalFile", input.normalFile);
  if (input.roughnessFile) formData.append("roughnessFile", input.roughnessFile);
  if (input.aoFile) formData.append("aoFile", input.aoFile);
  if (input.color) formData.append("color", input.color);
  if (input.roughness != null) formData.append("roughness", String(input.roughness));
  if (input.metalness != null) formData.append("metalness", String(input.metalness));
  if (input.placement_surface) formData.append("placement_surface", input.placement_surface);

  const token = await user.getIdToken();
  const response = await fetch("http://localhost:5000/api/assets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json().catch(() => null) as {
    success?: boolean;
    message?: string;
    asset?: Asset;
  } | null;

  if (!response.ok || !result?.success || !result.asset) {
    throw new Error(result?.message || "Failed to create asset.");
  }

  return result.asset;
}