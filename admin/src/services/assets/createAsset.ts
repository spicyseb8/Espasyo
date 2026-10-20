import { auth } from "@/firebase/firebase";
import type {
  Asset,
  AssetStatus,
  AssetType,
} from "./asset-types";
import { isOptionalFurniturePrice } from "./furnitureCategories";

export interface CreateAssetInput {
  asset_type: AssetType;
  name: string;
  category: string;
  price?: number;
  pricePerPiece?: number;
  asset_status: AssetStatus;

  // Required by validation when asset_type is "floor".
  // Values are converted to meters before this service is called.
  length?: number;
  width?: number;

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

export async function createAsset(
  input: CreateAssetInput
): Promise<Asset> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "Sign in with an admin account before creating assets."
    );
  }

  // Validate again before sending the request.
  if (input.asset_type === "floor") {
    if (
      input.pricePerPiece == null ||
      !Number.isFinite(input.pricePerPiece) ||
      input.pricePerPiece < 0
    ) {
      throw new Error(
        "Floor price per tile must be a valid number of 0 or more."
      );
    }

    if (
      input.length == null ||
      !Number.isFinite(input.length) ||
      input.length <= 0
    ) {
      throw new Error(
        "Floor length must be greater than 0."
      );
    }

    if (
      input.width == null ||
      !Number.isFinite(input.width) ||
      input.width <= 0
    ) {
      throw new Error(
        "Floor width must be greater than 0."
      );
    }
  } else if (
    !(
      input.asset_type === "furniture" &&
      isOptionalFurniturePrice(input.category) &&
      input.price == null
    ) &&
    (input.price == null ||
      !Number.isFinite(input.price) ||
      input.price < 0)
  ) {
    throw new Error(
      "Asset price must be a valid number of 0 or more."
    );
  }

  const formData = new FormData();

  formData.append("asset_type", input.asset_type);
  formData.append("name", input.name.trim());
  formData.append("category", input.category.trim());
  if (input.asset_type === "floor") {
    formData.append(
      "pricePerPiece",
      String(input.pricePerPiece)
    );
  } else if (input.price != null) {
    formData.append("price", String(input.price));
  }
  formData.append("asset_status", input.asset_status);

  // Send the dimensions only for floor assets.
  if (input.asset_type === "floor") {
    formData.append("length", String(input.length));
    formData.append("width", String(input.width));
  }

  if (input.modelFile) {
    formData.append("modelFile", input.modelFile);
  }

  if (input.diffuseFile) {
    formData.append("diffuseFile", input.diffuseFile);
  }

  if (input.normalFile) {
    formData.append("normalFile", input.normalFile);
  }

  if (input.roughnessFile) {
    formData.append("roughnessFile", input.roughnessFile);
  }

  if (input.aoFile) {
    formData.append("aoFile", input.aoFile);
  }

  if (input.color) {
    formData.append("color", input.color);
  }

  if (input.roughness != null) {
    formData.append("roughness", String(input.roughness));
  }

  if (input.metalness != null) {
    formData.append("metalness", String(input.metalness));
  }

  if (input.placement_surface) {
    formData.append(
      "placement_surface",
      input.placement_surface
    );
  }

  const token = await user.getIdToken();

  const response = await fetch(
    "http://localhost:5000/api/assets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const result = (await response
    .json()
    .catch(() => null)) as {
    success?: boolean;
    message?: string;
    asset?: Asset;
  } | null;

  if (!response.ok || !result?.success || !result.asset) {
    throw new Error(
      result?.message || "Failed to create asset."
    );
  }

  return result.asset;
}