import { adminDb } from "./firebase-admin.js";

async function seedAssetStatus() {
  console.log("======================================");
  console.log("Espasyo Asset Status Seeder");
  console.log("======================================");
  console.log("");

  const assetsSnapshot = await adminDb
    .collection("assets")
    .get();

  if (assetsSnapshot.empty) {
    console.log("No assets found.");
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const assetDoc of assetsSnapshot.docs) {
    const asset = assetDoc.data();

    // ------------------------------------------
    // Skip assets that already have a status
    // ------------------------------------------

    if (asset.asset_status !== undefined) {
      console.log(
        `Skipped: ${asset.name ?? assetDoc.id} ` +
        `(already has asset_status: ${asset.asset_status})`
      );

      skippedCount++;
      continue;
    }

    // ------------------------------------------
    // Add default status
    // ------------------------------------------

    await assetDoc.ref.update({
      asset_status: "available",
    });

    console.log(
      `Updated: ${asset.name ?? assetDoc.id} → available`
    );

    updatedCount++;
  }

  console.log("");
  console.log("======================================");
  console.log("Asset status seeding completed.");
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Total: ${assetsSnapshot.size}`);
  console.log("======================================");
}

async function main() {
  try {
    await seedAssetStatus();

    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("Asset status seeding failed.");
    console.error(error);

    process.exit(1);
  }
}

main();