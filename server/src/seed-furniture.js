import { adminDb } from "./firebase-admin.js";

const furnitureAssets = [
  // =====================================================
  // WINDOWS
  // =====================================================

  {
    name: "Slim Intersection Window",
    asset_status: "available",
    asset_type: "furniture",
    category: "windows",
    price: 500,

    model_path: "",
    thumbnail_path: "",
  },

  // =====================================================
  // DOORS
  // =====================================================

  {
    name: "Single Door",
    asset_status: "available",
    asset_type: "furniture",
    category: "doors",
    price: 500,

    model_path: "",
    thumbnail_path: "",
  },

  // =====================================================
  // REAL FURNITURE
  // =====================================================

  {
    name: "Table",
    asset_status: "available",
    asset_type: "furniture",
    category: "diningroom",
    price: 500,

    placement_surface: "floor",

    model_path: "",
    thumbnail_path: "",
  },

  {
    name: "Cabinet",
    asset_status: "available",
    asset_type: "furniture",
    category: "bedroom",
    price: 500,

    placement_surface: "floor",

    model_path: "",
    thumbnail_path: "",
  },

  {
    name: "TV",
    asset_status: "available",
    asset_type: "furniture",
    category: "livingroom",
    price: 500,

    placement_surface: "wall",

    model_path: "",
    thumbnail_path: "",
  },
];

async function seedFurniture() {
  console.log(
    "Starting furniture asset seeder..."
  );

  try {
    for (const furniture of furnitureAssets) {
      // =================================================
      // DUPLICATE CHECK
      // =================================================

      const existingSnapshot =
        await adminDb
          .collection("assets")
          .where(
            "name",
            "==",
            furniture.name
          )
          .where(
            "asset_type",
            "==",
            furniture.asset_type
          )
          .where(
            "category",
            "==",
            furniture.category
          )
          .limit(1)
          .get();

      if (!existingSnapshot.empty) {
        console.log(
          `Skipped: ${furniture.name} already exists.`
        );

        continue;
      }

      // =================================================
      // CREATE DOCUMENT
      // =================================================

      const docRef =
        adminDb
          .collection("assets")
          .doc();

      const now = new Date();

      const assetData = {
        id: docRef.id,

        ...furniture,

        created_at: now,
        updated_at: now,
      };

      await docRef.set(
        assetData
      );

      console.log(
        `Created: ${furniture.name} (${docRef.id})`
      );
    }

    console.log(
      "Furniture asset seeder completed successfully."
    );
  } catch (error) {
    console.error(
      "Furniture asset seeder failed:",
      error
    );

    process.exit(1);
  }
}

seedFurniture();