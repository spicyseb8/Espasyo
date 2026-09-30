import { adminDb } from "./firebase-admin.js";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getFieldType(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Date) {
    return "timestamp";
  }

  // Firestore Timestamp
  if (
    value &&
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    return "timestamp";
  }

  // Firestore DocumentReference
  if (
    value &&
    typeof value === "object" &&
    typeof value.path === "string" &&
    typeof value.id === "string"
  ) {
    return "reference";
  }

  if (typeof value === "object") {
    return "map";
  }

  return typeof value;
}

// --------------------------------------------------
// PRINT VALUE
// --------------------------------------------------

function printValue(value, indent = 0) {
  const spacing = " ".repeat(indent);

  if (value === null) {
    console.log(`${spacing}null`);
    return;
  }

  if (Array.isArray(value)) {
    console.log(`${spacing}array [`);

    for (const item of value) {
      printValue(item, indent + 2);
    }

    console.log(`${spacing}]`);
    return;
  }

  // Firestore Timestamp
  if (
    value &&
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    console.log(
      `${spacing}${value.toDate().toISOString()}`
    );

    return;
  }

  // Firestore DocumentReference
  if (
    value &&
    typeof value === "object" &&
    typeof value.path === "string" &&
    typeof value.id === "string"
  ) {
    console.log(
      `${spacing}Reference: ${value.path}`
    );

    return;
  }

  if (typeof value === "object") {
    console.log(`${spacing}{`);

    for (const [key, nestedValue] of Object.entries(value)) {
      console.log(
        `${spacing}  ${key}: ${getFieldType(nestedValue)}`
      );

      printValue(
        nestedValue,
        indent + 4
      );
    }

    console.log(`${spacing}}`);

    return;
  }

  console.log(
    `${spacing}${String(value)}`
  );
}

// --------------------------------------------------
// PRINT DOCUMENT
// --------------------------------------------------

function printDocument(
  collectionName,
  documentId,
  data
) {
  console.log("");

  console.log(
    `  ┌── Document: ${documentId}`
  );

  console.log(
    `  │ Collection: ${collectionName}`
  );

  console.log(
    `  │ Fields: ${Object.keys(data).length}`
  );

  console.log("  │");

  for (const [fieldName, value] of Object.entries(data)) {
    const type = getFieldType(value);

    console.log(
      `  │ ${fieldName}: ${type}`
    );

    printValue(
      value,
      6
    );
  }

  console.log(
    "  └────────────────────────────────────────"
  );
}

// --------------------------------------------------
// BUILD SCHEMA
// --------------------------------------------------

function collectSchema(
  schema,
  data
) {
  for (const [fieldName, value] of Object.entries(data)) {
    const type = getFieldType(value);

    if (!schema[fieldName]) {
      schema[fieldName] = new Set();
    }

    schema[fieldName].add(type);
  }
}

// --------------------------------------------------
// PRINT SCHEMA
// --------------------------------------------------

function printSchema(schema) {
  console.log("");

  console.log(
    "  ┌── Combined Schema"
  );

  console.log(
    "  │"
  );

  for (const [fieldName, types] of Object.entries(schema)) {
    console.log(
      `  │ ${fieldName}: ${[
        ...types,
      ].join(" | ")}`
    );
  }

  console.log(
    "  └────────────────────────────────────────"
  );
}

// --------------------------------------------------
// INSPECT COLLECTION
// --------------------------------------------------

async function inspectCollection(
  collectionName
) {
  const collection =
    adminDb.collection(collectionName);

  const snapshot =
    await collection.get();

  console.log("");

  console.log(
    "=================================================="
  );

  console.log(
    `COLLECTION: ${collectionName}`
  );

  console.log(
    `DOCUMENTS: ${snapshot.size}`
  );

  console.log(
    "=================================================="
  );

  if (snapshot.empty) {
    console.log(
      "  (empty collection)"
    );

    return;
  }

  const schema = {};

  for (const document of snapshot.docs) {
    const data =
      document.data();

    collectSchema(
      schema,
      data
    );

    printDocument(
      collectionName,
      document.id,
      data
    );
  }

  printSchema(schema);
}

// --------------------------------------------------
// INSPECT ASSETS
// --------------------------------------------------

async function inspectAssets() {
  console.log("");

  console.log(
    "##################################################"
  );

  console.log(
    "# ESPASYO ASSET DATABASE INSPECTOR"
  );

  console.log(
    "##################################################"
  );

  console.log("");

  console.log(
    "Collection being inspected:"
  );

  console.log(
    "  1. assets"
  );

  console.log("");

  // ------------------------------------------------
  // ASSETS
  // ------------------------------------------------

  await inspectCollection(
    "assets"
  );

  // ------------------------------------------------
  // COMPLETE
  // ------------------------------------------------

  console.log("");

  console.log(
    "##################################################"
  );

  console.log(
    "# ASSET INSPECTION COMPLETE"
  );

  console.log(
    "##################################################"
  );

  console.log("");
}

// --------------------------------------------------
// MAIN
// --------------------------------------------------

async function main() {
  try {
    await inspectAssets();

    process.exit(0);
  } catch (error) {
    console.error("");

    console.error(
      "Asset inspection failed."
    );

    console.error(error);

    process.exit(1);
  }
}

main();