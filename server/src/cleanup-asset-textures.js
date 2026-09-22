import { adminDb, adminStorage } from "./firebase-admin.js";
import { FieldValue } from "firebase-admin/firestore";

const FIELDS_TO_REMOVE = [
  "normal_path",
  "rough_path",
  "ao_path",
];

const STORAGE_FILE_PATTERNS = [
  "/normal.",
  "/rough.",
  "/ao.",
];

async function cleanupAssetTextures() {
  console.log("========================================");
  console.log("Cleaning asset textures...");
  console.log("========================================");

  // -------------------------------------------------------
  // 1. Remove Normal / Rough / AO fields from Firestore
  // -------------------------------------------------------

  const snapshot = await adminDb
    .collection("assets")
    .get();

  console.log(
    `Found ${snapshot.size} asset documents.`
  );

  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    const fieldsToRemove =
      FIELDS_TO_REMOVE.filter(
        (field) =>
          data[field] !== undefined
      );

    if (fieldsToRemove.length === 0) {
      continue;
    }

    const updates = {};

    for (const field of fieldsToRemove) {
      updates[field] =
        FieldValue.delete();
    }

    await doc.ref.update(updates);

    updatedCount++;

    console.log(
      `✓ Cleaned Firestore asset: ${
        data.name ?? doc.id
      }`
    );
  }

  // -------------------------------------------------------
  // 2. Delete Normal / Rough / AO files from Storage
  // -------------------------------------------------------

  const bucket =
    adminStorage;

  const [files] =
    await bucket.getFiles({
      prefix: "assets/",
    });

  console.log(
    `Found ${files.length} files under assets/.`
  );

  let deletedCount = 0;

  for (const file of files) {
    const fileName =
      file.name.toLowerCase();

    const shouldDelete =
      STORAGE_FILE_PATTERNS.some(
        (pattern) =>
          fileName.includes(pattern)
      );

    if (!shouldDelete) {
      continue;
    }

    await file.delete();

    deletedCount++;

    console.log(
      `✓ Deleted Storage file: ${file.name}`
    );
  }

  // -------------------------------------------------------
  // 3. Summary
  // -------------------------------------------------------

  console.log("========================================");
  console.log(
    `✓ Firestore assets cleaned: ${updatedCount}`
  );
  console.log(
    `✓ Storage files deleted: ${deletedCount}`
  );
  console.log("========================================");
  console.log(
    "Cleanup completed successfully."
  );
}

cleanupAssetTextures()
  .then(() => {
    console.log(
      "Cleanup seeder completed."
    );

    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "Cleanup seeder failed:",
      error
    );

    process.exit(1);
  });