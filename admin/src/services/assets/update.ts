import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytes,
  deleteObject,
} from "firebase/storage";

import {
  db,
  storage,
} from "../../firebase/firebase";

export interface UpdateAssetData {
  name: string;
  price: number;
  asset_status:
    | "available"
    | "not_available";
}

export async function updateAsset(
  assetId: string,
  data: UpdateAssetData,
  thumbnailFile?: File | null,
  existingThumbnailPath?: string | null
) {
  const assetRef =
    doc(
      db,
      "assets",
      assetId
    );

  let thumbnailPath =
    existingThumbnailPath ?? null;

  // ==================================================
  // UPLOAD NEW THUMBNAIL
  // ==================================================

  if (thumbnailFile) {

    const fileExtension =
      thumbnailFile.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const newThumbnailPath =
      `assets/thumbnails/${assetId}-${Date.now()}.${fileExtension}`;

    const fileRef =
      storageRef(
        storage,
        newThumbnailPath
      );

    await uploadBytes(
      fileRef,
      thumbnailFile
    );

    thumbnailPath =
      newThumbnailPath;

    // ==================================================
    // DELETE OLD THUMBNAIL
    // ==================================================

    if (
      existingThumbnailPath &&
      existingThumbnailPath !== newThumbnailPath
    ) {
      try {

        const oldFileRef =
          storageRef(
            storage,
            existingThumbnailPath
          );

        await deleteObject(
          oldFileRef
        );

      } catch (error) {

        console.warn(
          "[AssetUpdate] Could not delete old thumbnail:",
          error
        );

      }
    }
  }

  // ==================================================
  // UPDATE FIRESTORE
  // ==================================================

  await updateDoc(
    assetRef,
    {
      name:
        data.name,

      price:
        data.price,

      asset_status:
        data.asset_status,

      thumbnail_path:
        thumbnailPath,

      updated_at:
        serverTimestamp(),
    }
  );
}