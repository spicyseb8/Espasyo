import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { adminDb, adminStorage } from "./firebase-admin.js";

// --------------------------------------------------
// PATH SETUP
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/assets/floors
const floorsDirectory = path.join(__dirname, "..", "assets", "floors");

// --------------------------------------------------
// FLOOR CONFIGURATION
// --------------------------------------------------

const textureFiles = {
  ao: "AO.png",
  diffuse: "Diffuse.png",
  normal: "NormalGL.png",
  rough: "Rough.png",
};

const FLOOR_PRICE = 500;

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function toDisplayName(folderName) {
  return folderName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toLowerCategory(category) {
  return category.toLowerCase();
}

// --------------------------------------------------
// UPLOAD FILE TO FIREBASE STORAGE
// --------------------------------------------------

async function uploadFile(localFilePath, storagePath) {
  const bucket = adminStorage;

  // Check if file already exists in Storage
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();

  if (exists) {
    console.log(`Storage file already exists: ${storagePath}`);

    return storagePath;
  }

  await bucket.upload(localFilePath, {
    destination: storagePath,

    metadata: {
      contentType: "image/png",

      metadata: {
        firebaseStorageDownloadTokens: crypto.randomUUID(),
      },
    },
  });

  console.log(`Uploaded: ${storagePath}`);

  return storagePath;
}

// --------------------------------------------------
// SEED ONE FLOOR
// --------------------------------------------------

async function seedFloor(categoryFolder, floorFolder) {
  const category = toLowerCategory(categoryFolder);
  const name = toDisplayName(floorFolder);

  const floorDirectory = path.join(
    floorsDirectory,
    categoryFolder,
    floorFolder
  );

  console.log("--------------------------------------");
  console.log(`Floor: ${name}`);
  console.log(`Category: ${category}`);
  console.log(`Folder: ${floorFolder}`);
  console.log("--------------------------------------");

  // ------------------------------------------------
  // CHECK REQUIRED FILES
  // ------------------------------------------------

  const requiredFiles = Object.values(textureFiles);

  for (const fileName of requiredFiles) {
    const localFilePath = path.join(floorDirectory, fileName);

    if (!fs.existsSync(localFilePath)) {
      throw new Error(
        `Missing required file for "${name}": ${localFilePath}`
      );
    }
  }

  // ------------------------------------------------
  // CHECK FIRESTORE DUPLICATE
  // ------------------------------------------------

  const existingAsset = await adminDb
    .collection("assets")
    .where("name", "==", name)
    .where("asset_type", "==", "floor")
    .where("category", "==", category)
    .limit(1)
    .get();

  if (!existingAsset.empty) {
    console.log(`Skipped: ${name} (already exists in Firestore)`);
    return {
      created: false,
      skipped: true,
    };
  }

  // ------------------------------------------------
  // STORAGE PATH
  // ------------------------------------------------

  const baseStoragePath = `assets/floors/${categoryFolder}/${floorFolder}`;

  // ------------------------------------------------
  // UPLOAD TEXTURES
  // ------------------------------------------------

  const aoPath = `${baseStoragePath}/${textureFiles.ao}`;
  const diffusePath = `${baseStoragePath}/${textureFiles.diffuse}`;
  const normalPath = `${baseStoragePath}/${textureFiles.normal}`;
  const roughPath = `${baseStoragePath}/${textureFiles.rough}`;

  await uploadFile(
    path.join(floorDirectory, textureFiles.ao),
    aoPath
  );

  await uploadFile(
    path.join(floorDirectory, textureFiles.diffuse),
    diffusePath
  );

  await uploadFile(
    path.join(floorDirectory, textureFiles.normal),
    normalPath
  );

  await uploadFile(
    path.join(floorDirectory, textureFiles.rough),
    roughPath
  );

  // ------------------------------------------------
  // CREATE FIRESTORE DOCUMENT
  // ------------------------------------------------

  const assetRef = adminDb.collection("assets").doc();

  const now = new Date();

  const assetData = {
    id: assetRef.id,

    name,

    asset_type: "floor",

    category,

    price: FLOOR_PRICE,

    // Storage folder
    storage_path: baseStoragePath,

    // Individual texture paths
    ao_path: aoPath,
    diffuse_path: diffusePath,
    normal_path: normalPath,
    rough_path: roughPath,

    created_at: now,
    updated_at: now,
  };

  await assetRef.set(assetData);

  console.log("");
  console.log(`Created Firestore asset: ${name}`);
  console.log(`ID: ${assetRef.id}`);
  console.log(`Category: ${category}`);
  console.log(`Price: ${FLOOR_PRICE}`);
  console.log(`Storage: ${baseStoragePath}`);
  console.log("");

  return {
    created: true,
    skipped: false,
  };
}

// --------------------------------------------------
// SEED ALL FLOORS
// --------------------------------------------------

async function seedFloors() {
  console.log("======================================");
  console.log("Espasyo Floor Asset Seeder");
  console.log("======================================");
  console.log("");

  if (!fs.existsSync(floorsDirectory)) {
    throw new Error(
      `Floors directory does not exist: ${floorsDirectory}`
    );
  }

  const categoryFolders = fs
    .readdirSync(floorsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  let createdCount = 0;
  let skippedCount = 0;

  // ------------------------------------------------
  // LOOP THROUGH CATEGORIES
  // ------------------------------------------------

  for (const categoryEntry of categoryFolders) {
    const categoryFolder = categoryEntry.name;

    console.log("");
    console.log(`========== ${categoryFolder} ==========`);

    const categoryDirectory = path.join(
      floorsDirectory,
      categoryFolder
    );

    const floorFolders = fs
      .readdirSync(categoryDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());

    // ------------------------------------------------
    // LOOP THROUGH FLOOR TYPES
    // ------------------------------------------------

    for (const floorEntry of floorFolders) {
      const floorFolder = floorEntry.name;

      const result = await seedFloor(
        categoryFolder,
        floorFolder
      );

      if (result.created) {
        createdCount++;
      }

      if (result.skipped) {
        skippedCount++;
      }
    }
  }

  // ------------------------------------------------
  // SUMMARY
  // ------------------------------------------------

  console.log("");
  console.log("======================================");
  console.log("Floor asset seeding completed.");
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Total processed: ${createdCount + skippedCount}`);
  console.log("======================================");
}

// --------------------------------------------------
// MAIN
// --------------------------------------------------

async function main() {
  try {
    await seedFloors();
    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("Floor asset seeding failed.");
    console.error(error);
    process.exit(1);
  }
}

main();