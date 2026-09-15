import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

export interface UpdateAssetData {
  name: string;
  price: number;
  asset_status: "available" | "not_available";
}

export async function updateAsset(
  assetId: string,
  data: UpdateAssetData
) {
  const assetRef = doc(db, "assets", assetId);

  await updateDoc(assetRef, {
    name: data.name,
    price: data.price,
    asset_status: data.asset_status,
    updated_at: serverTimestamp(),
  });
}