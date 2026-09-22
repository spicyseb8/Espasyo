import { adminDb } from "./firebase-admin.js";

const floorPaints = [
  {
    name: "Rustic Red",
    category: "paint",
    price: 500,
    color: "#8C2F23",
  },
  {
    name: "Velvet Gray",
    category: "paint",
    price: 500,
    color: "#B5BDC6",
  },
  {
    name: "Classic Blue",
    category: "paint",
    price: 500,
    color: "#316EB7",
  },
  {
    name: "Dark Velvet Gray",
    category: "paint",
    price: 500,
    color: "#A1A2AB",
  },
  {
    name: "Tropical Green",
    category: "paint",
    price: 500,
    color: "#255829",
  },
  {
    name: "Black",
    category: "paint",
    price: 500,
    color: "#251E21",
  },
  {
    name: "Canary Yellow",
    category: "paint",
    price: 500,
    color: "#F7E61C",
  },
  {
    name: "Marking White",
    category: "paint",
    price: 500,
    color: "#FFFFFF",
  },
  {
    name: "Sand Beige",
    category: "paint",
    price: 500,
    color: "#FDF7D0",
  },
];

async function seedFloorPaints() {
  console.log("========================================");
  console.log("Seeding floor paint assets...");
  console.log("========================================");

  const collection = adminDb.collection("assets");

  for (const paint of floorPaints) {
    const docRef = collection.doc();

    const asset = {
      id: docRef.id,

      name: paint.name,

      asset_type: "floor",
      category: paint.category,

      price: paint.price,

      color: paint.color,

      roughness: 0.8,
      metalness: 0,

      asset_status: "available",

      created_at: new Date(),
      updated_at: new Date(),
    };

    await docRef.set(asset);

    console.log(
      `✓ Added floor paint: ${paint.name} (${paint.color})`
    );
  }

  console.log("========================================");
  console.log(`✓ Added ${floorPaints.length} floor paint assets.`);
  console.log("========================================");
}

seedFloorPaints()
  .then(() => {
    console.log("Floor paint seeder completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Floor paint seeder failed:", error);
    process.exit(1);
  });