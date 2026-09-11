import { adminDb } from "./firebase-admin.js";

const wallPaints = [
  {
    name: "Blue Ice",
    color: "#7C88AA",
  },
  {
    name: "Moonlight Blue",
    color: "#536D8D",
  },
  {
    name: "Medieval Blue",
    color: "#2B3455",
  },
  {
    name: "Dark Navy",
    color: "#292A32",
  },
  {
    name: "Brandy Snifter",
    color: "#88453F",
  },
  {
    name: "Pale Gold",
    color: "#BE9A63",
  },
  {
    name: "Whisper White",
    color: "#B5A994",
  },
  {
    name: "Baby's Breath",
    color: "#E8E2D1",
  },
  {
    name: "Sun Kiss",
    color: "#E8CEB9",
  },
  {
    name: "Silver Pine",
    color: "#58716F",
  },
  {
    name: "Matte Green",
    color: "#87927A",
  },
  {
    name: "Warm Gray 2 C",
    color: "#CBC4BC",
  },
];

async function seedWallPaints() {
  const now = new Date();

  let createdCount = 0;
  let skippedCount = 0;

  for (const paint of wallPaints) {
    // Check if this paint already exists
    const existingPaint = await adminDb
      .collection("assets")
      .where("name", "==", paint.name)
      .where("asset_type", "==", "wall")
      .where("category", "==", "paint")
      .limit(1)
      .get();

    if (!existingPaint.empty) {
      console.log(`Skipped: ${paint.name} (already exists)`);
      skippedCount++;
      continue;
    }

    // Let Firestore automatically generate the document ID
    const assetRef = adminDb.collection("assets").doc();

    const assetData = {
      id: assetRef.id,

      name: paint.name,

      asset_type: "wall",
      category: "paint",

      price: 500,

      color: paint.color,

      roughness: 0.8,
      metalness: 0,

      created_at: now,
      updated_at: now,
    };

    await assetRef.set(assetData);

    console.log(`Created: ${paint.name}`);
    console.log(`ID: ${assetRef.id}`);
    console.log(`Color: ${paint.color}`);
    console.log("");

    createdCount++;
  }

  console.log("======================================");
  console.log("Wall paint seeding completed.");
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Total: ${wallPaints.length}`);
  console.log("======================================");
}

async function main() {
  console.log("======================================");
  console.log("Espasyo Asset Seeder");
  console.log("======================================");
  console.log("");

  console.log("Creating wall paints...");
  console.log("");

  await seedWallPaints();
}

main().catch((error) => {
  console.error("");
  console.error("Asset seeding failed.");
  console.error(error);
  process.exit(1);
});