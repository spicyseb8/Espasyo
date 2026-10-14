import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

export interface UpdateAssetData {
  name: string;
  price: number;
  asset_status:
    | "available"
    | "not_available";

  // Only used when updating floor assets.
  // Values are in meters.
  length?: number;
  width?: number;
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
    const length = data.length as number;
    const width = data.width as number;

    if (
      !Number.isFinite(length) ||
      length <= 0
    ) {
      throw new Error(
        "Floor length must be greater than 0 meters."
      );
    }

    if (
      !Number.isFinite(width) ||
      width <= 0
    ) {
      throw new Error(
        "Floor width must be greater than 0 meters."
      );
    }
  }

  await updateDoc(assetRef, {
    name: data.name,
    price: data.price,
    asset_status: data.asset_status,

    ...(hasLength && hasWidth
      ? {
          length: data.length,
          width: data.width,
        }
      : {}),

    updated_at: serverTimestamp(),
  });
}