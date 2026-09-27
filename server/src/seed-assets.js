import { db } from "./firebase-admin.js";

const ASSET_COLLECTIONS = [
  "assets",
  "furniture",
  "floors",
  "doors",
  "windows",
];

function printValue(value, indent = 0) {
  const spacing = " ".repeat(indent);

  if (value === null) {
    console.log(`${spacing}null`);
    return;
  }

  if (value === undefined) {
    console.log(`${spacing}undefined`);
    return;
  }

  if (value?.toDate instanceof Function) {
    console.log(`${spacing}${value.toDate().toISOString()}`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log(`${spacing}[]`);
      return;
    }

    value.forEach((item, index) => {
      console.log(`${spacing}[${index}]`);
      printValue(item, indent + 2);
    });

    return;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);

    if (keys.length === 0) {
      console.log(`${spacing}{}`);
      return;
    }

    for (const key of keys) {
      console.log(`${spacing}${key}:`);

      if (typeof value[key] === "object" && value[key] !== null) {
        printValue(value[key], indent + 2);
      } else {
        console.log(`${" ".repeat(indent + 2)}${value[key]}`);
      }
    }

    return;
  }

  console.log(`${spacing}${value}`);
}

async function inspectCollection(collectionName) {
  console.log("");
  console.log("==================================================");
  console.log(`COLLECTION: ${collectionName}`);
  console.log("==================================================");

  const snapshot = await db
    .collection(collectionName)
    .get();

  if (snapshot.empty) {
    console.log("No documents found.");
    return;
  }

  console.log(`Documents found: ${snapshot.size}`);

  for (const document of snapshot.docs) {
    console.log("");
    console.log("----------------------------------------------");
    console.log(`DOCUMENT ID: ${document.id}`);
    console.log("----------------------------------------------");

    const data = document.data();

    printValue(data, 2);
  }
}

async function inspectAssets() {
  console.log("");
  console.log("==================================================");
  console.log("ESPASYO ASSET DATABASE INSPECTOR");
  console.log("==================================================");
  console.log("READ ONLY - No Firestore data will be modified.");
  console.log("");

  try {
    for (const collection of ASSET_COLLECTIONS) {
      await inspectCollection(collection);
    }

    console.log("");
    console.log("==================================================");
    console.log("ASSET INSPECTION COMPLETE");
    console.log("==================================================");
  } catch (error) {
    console.error("");
    console.error("==================================================");
    console.error("ASSET INSPECTION FAILED");
    console.error("==================================================");
    console.error(error);
    console.error("");
  }
}

inspectAssets();