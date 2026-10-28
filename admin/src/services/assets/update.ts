import {
  doc,
  deleteField,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { isOptionalFurniturePrice } from "./furnitureCategories";
import {
  DEFAULT_FLOOR_GROUT_WIDTH_M,
  isFloorPattern,
} from "../../../../shared/flooring/patterns";
import type { FloorPattern } from "../../../../shared/flooring/patterns";

export interface UpdateAssetData {
  asset_type: "floor" | "wall" | "furniture";
  name: string;
  category: string;
  price?: number;
  pricePerPiece?: number;
  asset_status:
    | "available"
    | "not_available";

  // Only used when updating floor assets.
  // Values are in meters.
  length?: number;
  width?: number;
  floorPattern?: FloorPattern;
}

export async function updateAsset(
  assetId: string,
  data: UpdateAssetData
): Promise<void> {
  const assetRef = doc(
    db,
    "assets",
    assetId
  );

  const hasLength = data.length !== undefined;
  const hasWidth = data.width !== undefined;

  // Length and width must be supplied together.
  if (hasLength !== hasWidth) {
    throw new Error(
      "Floor length and width must be provided together."
    );
  }

  if (hasLength && hasWidth) {
    const length = data.length;
    const width = data.width;

    if (
      length == null ||
      !Number.isFinite(length) ||
      length <= 0
    ) {
      throw new Error(
        "Floor length must be greater than 0 meters."
      );
    }

    if (data.floorPattern !== undefined && !isFloorPattern(data.floorPattern)) {
      throw new Error("Floor pattern is not supported.");
    }
    if (
      data.floorPattern !== undefined &&
      (data.length == null ||
        data.width == null ||
        data.length <= DEFAULT_FLOOR_GROUT_WIDTH_M ||
        data.width <= DEFAULT_FLOOR_GROUT_WIDTH_M)
    ) {
      throw new Error("Floor tile dimensions must each be greater than the 3 mm grout width.");
    }

    if (
      width == null ||
      !Number.isFinite(width) ||
      width <= 0
    ) {
      throw new Error(
        "Floor width must be greater than 0 meters."
      );
    }
  }

  if (data.pricePerPiece !== undefined) {
    if (!hasLength || !hasWidth) {
      throw new Error(
        "Floor dimensions are required when updating a price per tile."
      );
    }

    if (
      !Number.isFinite(data.pricePerPiece) ||
      data.pricePerPiece < 0
    ) {
      throw new Error(
        "Floor price per tile must be a valid number of 0 or more."
      );
    }
  } else if (
    !(
      data.asset_type === "furniture" &&
      data.category !== "" &&
      isOptionalFurniturePrice(data.category) &&
      data.price === undefined
    ) &&
    (data.price === undefined ||
      !Number.isFinite(data.price) ||
      data.price < 0)
  ) {
    throw new Error(
      "Asset price must be a valid number of 0 or more."
    );
  }

  await updateDoc(assetRef, {
    name: data.name,
    category: data.category,
    ...(data.price !== undefined
      ? { price: data.price }
      : data.pricePerPiece === undefined &&
          data.asset_type === "furniture" &&
          isOptionalFurniturePrice(data.category)
        ? { price: deleteField() }
        : {}),
    ...(data.pricePerPiece !== undefined
      ? { pricePerPiece: data.pricePerPiece }
      : {}),
    asset_status: data.asset_status,

    ...(hasLength && hasWidth
      ? {
          length: data.length,
          width: data.width,
        }
      : {}),
    ...(data.floorPattern !== undefined
      ? { floorPattern: data.floorPattern }
      : {}),

    updated_at: serverTimestamp(),
  });
}