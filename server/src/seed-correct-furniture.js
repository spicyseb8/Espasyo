import { adminDb } from "./firebase-admin.js";

const furnitureModels = [
  {
    name: "Slim Intersection Window",
    model_path:
      "assets/openings/windows/Slim_Intersection_i.glb",
  },
  {
    name: "Single Door",
    model_path:
      "assets/openings/doors/single-door.glb",
  },
  {
    name: "Table",
    model_path:
      "assets/furniture/diningroom/Table.glb",
  },
  {
    name: "Cabinet",
    model_path:
      "assets/furniture/bedroom/Cabinet.glb",
  },
  {
    name: "TV",
    model_path:
      "assets/furniture/livingroom/TV.glb",
  },
];

function generateAssetId() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let result = "A-";

  for (let i = 0; i < 6; i++) {
    result +=
      characters[
        Math.floor(
          Math.random() * characters.length
        )
      ];
  }

  return result;
}

async function generateUniqueAssetId() {
  let id;
  let exists = true;

  while (exists) {
    id = generateAssetId();

    const snapshot = await adminDb
      .collection("assets")
      .doc(id)
      .get();

    exists = snapshot.exists;
  }

  return id;
}

async function fixFurnitureAssets() {
  console.log(
    "Starting furniture asset repair..."
  );

  try {
    for (const furniture of furnitureModels) {
      const snapshot = await adminDb
        .collection("assets")
        .where("name", "==", furniture.name)
        .where("asset_type", "==", "furniture")
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(
          `Not found: ${furniture.name}`
        );
        continue;
      }

      const oldDoc = snapshot.docs[0];
      const oldData = oldDoc.data();

      const newId =
        await generateUniqueAssetId();

      const newData = {
        ...oldData,

        id: newId,

        model_path:
          furniture.model_path,

        updated_at: new Date(),
      };

      const newDoc = adminDb
        .collection("assets")
        .doc(newId);

      await newDoc.set(newData);

      await oldDoc.ref.delete();

      console.log(
        `Fixed: ${furniture.name}`
      );

      console.log(
        `  Old ID: ${oldData.id}`
      );

      console.log(
        `  New ID: ${newId}`
      );

      console.log(
        `  Model: ${furniture.model_path}`
      );
    }

    console.log(
      "Furniture asset repair completed successfully."
    );
  } catch (error) {
    console.error(
      "Furniture asset repair failed:",
      error
    );

    process.exit(1);
  }
}

fixFurnitureAssets();