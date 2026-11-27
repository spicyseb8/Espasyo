import { auth } from "@/firebase/firebase";
import type {
  Asset,
  AssetStatus,
  AssetType,
} from "./asset-types";
import { isOptionalFurniturePrice } from "./furnitureCategories";
import { API_BASE_URL } from "./projectApi";
import {
  DEFAULT_FLOOR_GROUT_WIDTH_M,
  isHerringboneTileRatio,
} from "../../../../shared/flooring/patterns";
import type { FloorPattern } from "../../../../shared/flooring/patterns";

export interface CreateAssetInput {
  asset_type: AssetType;
  name: string;
  category: string;
  price?: number;
  pricePerPiece?: number;
  asset_status: AssetStatus;
  shareWithWalls?: boolean;

  // Required for floors and image-based wall textures.
  // Values are converted to meters before this service is called.
  length?: number;
  width?: number;
  floorPattern?: FloorPattern;

  modelFile?: File;
  diffuseFile?: File;

  color?: string;
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

  const hasPhysicalTexture =
    input.asset_type === "floor" ||
    (input.asset_type === "wall" && input.diffuseFile != null);

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

  if (hasPhysicalTexture) {
    if (
      input.length == null ||
      !Number.isFinite(input.length) ||
      input.length <= 0
    ) {
      throw new Error(
        "Material length must be greater than 0."
      );
    }

    if (
      input.width == null ||
      !Number.isFinite(input.width) ||
      input.width <= 0
    ) {
      throw new Error(
        "Material width must be greater than 0."
      );
    }

    if (!input.floorPattern) {
      throw new Error("Choose a supported material pattern.");
    }

    if (
      input.length <= DEFAULT_FLOOR_GROUT_WIDTH_M ||
      input.width <= DEFAULT_FLOOR_GROUT_WIDTH_M
    ) {
      throw new Error("Material dimensions must each be greater than the 3 mm grout width.");
    }

    if (
      input.floorPattern === "herringbone" &&
      !isHerringboneTileRatio(input.length, input.width)
    ) {
      throw new Error("Herringbone requires material length to be twice its width.");
    }
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

  if (input.asset_type === "floor") {
    formData.append("shareWithWalls", String(input.shareWithWalls ?? false));
  }

  // Send dimensions for floors and image-based wall textures.
  if (hasPhysicalTexture) {
    const floorPattern = input.floorPattern;
    if (!floorPattern) {
      throw new Error("Choose a supported material pattern.");
    }
    formData.append("length", String(input.length));
    formData.append("width", String(input.width));
    formData.append("floorPattern", floorPattern);
  }

  if (input.modelFile) {
    formData.append("modelFile", input.modelFile);
  }

  if (input.diffuseFile) {
    formData.append("diffuseFile", input.diffuseFile);
  }

  if (input.color) {
    formData.append("color", input.color);
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
    `${API_BASE_URL}/assets`,
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