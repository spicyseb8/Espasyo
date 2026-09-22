import { adminDb, adminStorage } from "./firebase-admin.js";

const COLLECTION_CONFIG = {
  adminEmployees: {
    prefix: "AE",
  },
  assets: {
    prefix: "A",
  },
  projects: {
    prefix: "P",
  },
  users: {
    prefix: "U",
  },
};

// ---------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------

const DELETE_NORMALGL_FILES = true;

// Set this to false if you want to test the generated IDs
// without actually changing Firestore.
const APPLY_FIRESTORE_MIGRATION = true;

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getYearFromCreatedAt(createdAt) {
  if (!createdAt) {
    return new Date().getFullYear();
  }

  // Firestore Timestamp
  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().getFullYear();
  }

  // JS Date
  if (createdAt instanceof Date) {
    return createdAt.getFullYear();
  }

  // String / number fallback
  const date = new Date(createdAt);

  if (!Number.isNaN(date.getTime())) {
    return date.getFullYear();
  }

  return new Date().getFullYear();
}

function getTwoDigitYear(createdAt) {
  return String(getYearFromCreatedAt(createdAt)).slice(-2);
}

function createReadableId(prefix, year, sequence) {
  const yy = String(year).slice(-2);

  // 001, 002, 003...
  const xxx = String(sequence).padStart(3, "0");

  return `${prefix}-${yy}${xxx}`;
}

// ---------------------------------------------------------
// LOAD COLLECTIONS
// ---------------------------------------------------------

async function loadCollections() {
  console.log("");
  console.log("========================================");
  console.log("Loading Firestore collections...");
  console.log("========================================");
  console.log("");

  const result = {};

  for (const collectionName of Object.keys(COLLECTION_CONFIG)) {
    const snapshot = await adminDb.collection(collectionName).get();

    result[collectionName] = snapshot.docs.map((doc) => ({
      oldId: doc.id,
      data: doc.data(),
    }));

    console.log(
      `✓ ${collectionName}: ${snapshot.size} document(s)`
    );
  }

  console.log("");

  return result;
}

// ---------------------------------------------------------
// SORT DOCUMENTS
// ---------------------------------------------------------

function sortDocuments(documents) {
  return [...documents].sort((a, b) => {
    const yearA = getYearFromCreatedAt(a.data.created_at);
    const yearB = getYearFromCreatedAt(b.data.created_at);

    if (yearA !== yearB) {
      return yearA - yearB;
    }

    const timeA = getCreatedAtTime(a.data.created_at);
    const timeB = getCreatedAtTime(b.data.created_at);

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.oldId.localeCompare(b.oldId);
  });
}

function getCreatedAtTime(createdAt) {
  if (!createdAt) {
    return 0;
  }

  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().getTime();
  }

  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }

  const date = new Date(createdAt);

  if (!Number.isNaN(date.getTime())) {
    return date.getTime();
  }

  return 0;
}

// ---------------------------------------------------------
// GENERATE IDS
// ---------------------------------------------------------

function generateIds(collectionName, documents) {
  const { prefix } = COLLECTION_CONFIG[collectionName];

  const sorted = sortDocuments(documents);

  const counters = {};
  const mappings = [];

  for (const document of sorted) {
    const year = getYearFromCreatedAt(
      document.data.created_at
    );

    const yy = String(year).slice(-2);

    if (!counters[yy]) {
      counters[yy] = 1;
    }

    const sequence = counters[yy];

    const newId = createReadableId(
      prefix,
      year,
      sequence
    );

    counters[yy]++;

    mappings.push({
      collection: collectionName,
      oldId: document.oldId,
      newId,
      year,
      data: document.data,
    });
  }

  return mappings;
}

// ---------------------------------------------------------
// BUILD ALL ID MAPS
// ---------------------------------------------------------

function buildAllMappings(collections) {
  const mappings = {};
  const globalOldToNew = {};

  for (const collectionName of Object.keys(COLLECTION_CONFIG)) {
    mappings[collectionName] = generateIds(
      collectionName,
      collections[collectionName]
    );

    for (const item of mappings[collectionName]) {
      globalOldToNew[item.oldId] = item.newId;
    }
  }

  return mappings;
}

// ---------------------------------------------------------
// PRINT MIGRATION PLAN
// ---------------------------------------------------------

function printMigrationPlan(mappings) {
  console.log("");
  console.log("========================================");
  console.log("MIGRATION PLAN");
  console.log("========================================");

  for (const collectionName of Object.keys(mappings)) {
    console.log("");
    console.log(`[${collectionName}]`);

    for (const item of mappings[collectionName]) {
      console.log(
        `  ${item.oldId}  ->  ${item.newId}`
      );
    }
  }

  console.log("");
}

// ---------------------------------------------------------
// CHECK TARGET IDS
// ---------------------------------------------------------

async function checkTargetIds(mappings) {
  console.log("========================================");
  console.log("Checking target document IDs...");
  console.log("========================================");
  console.log("");

  for (const collectionName of Object.keys(mappings)) {
    for (const item of mappings[collectionName]) {
      const targetRef = adminDb
        .collection(collectionName)
        .doc(item.newId);

      const targetSnapshot = await targetRef.get();

      // If the target already exists AND it isn't the same
      // document we are migrating, stop the migration.
      if (
        targetSnapshot.exists &&
        item.oldId !== item.newId
      ) {
        throw new Error(
          `Target ID already exists: ` +
          `${collectionName}/${item.newId}`
        );
      }
    }
  }

  console.log("✓ No target ID collisions found.");
  console.log("");
}

// ---------------------------------------------------------
// UPDATE REFERENCES
// ---------------------------------------------------------

function replaceReferences(value, idMaps) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      replaceReferences(item, idMaps)
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    // Firestore Timestamp / GeoPoint / DocumentReference
    // and other special Firestore values should remain untouched.
    if (
      typeof value.toDate === "function" ||
      typeof value.path === "string"
    ) {
      return value;
    }

    const result = {};

    for (const [key, childValue] of Object.entries(value)) {
      result[key] = replaceReferences(
        childValue,
        idMaps
      );
    }

    return result;
  }

  if (typeof value !== "string") {
    return value;
  }

  // Exact ID match.
  for (const collectionMap of Object.values(idMaps)) {
    if (collectionMap[value]) {
      return collectionMap[value];
    }
  }

  return value;
}

function updateDocumentReferences(data, idMaps) {
  return replaceReferences(data, idMaps);
}

// ---------------------------------------------------------
// WRITE NEW DOCUMENTS
// ---------------------------------------------------------

async function createNewDocuments(mappings, idMaps) {
  console.log("========================================");
  console.log("Creating new documents...");
  console.log("========================================");
  console.log("");

  for (const collectionName of Object.keys(mappings)) {
    const collectionMappings = mappings[collectionName];

    for (const item of collectionMappings) {
      const newData = updateDocumentReferences(
        item.data,
        idMaps
      );

      const newRef = adminDb
        .collection(collectionName)
        .doc(item.newId);

      await newRef.set(newData);

      console.log(
        `✓ Created ${collectionName}/${item.newId}`
      );
    }
  }

  console.log("");
}

// ---------------------------------------------------------
// DELETE OLD DOCUMENTS
// ---------------------------------------------------------

async function deleteOldDocuments(mappings) {
  console.log("========================================");
  console.log("Deleting old documents...");
  console.log("========================================");
  console.log("");

  for (const collectionName of Object.keys(mappings)) {
    for (const item of mappings[collectionName]) {
      if (item.oldId === item.newId) {
        continue;
      }

      await adminDb
        .collection(collectionName)
        .doc(item.oldId)
        .delete();

      console.log(
        `✓ Deleted ${collectionName}/${item.oldId}`
      );
    }
  }

  console.log("");
}

// ---------------------------------------------------------
// DELETE NORMALGL STORAGE FILES
// ---------------------------------------------------------

async function deleteNormalGLFiles() {
  console.log("========================================");
  console.log("Deleting NormalGL files...");
  console.log("========================================");
  console.log("");

  const [files] = await adminStorage.getFiles({
    prefix: "assets/",
  });

  let deletedCount = 0;

  for (const file of files) {
    const fileName = file.name;

    const baseName = fileName
      .split("/")
      .pop()
      ?.toLowerCase();

    if (!baseName) {
      continue;
    }

    if (
      baseName === "normalgl.png" ||
      baseName.startsWith("normalgl.")
    ) {
      await file.delete();

      console.log(
        `✓ Deleted Storage file: ${fileName}`
      );

      deletedCount++;
    }
  }

  console.log("");

  if (deletedCount === 0) {
    console.log("No NormalGL files found.");
  } else {
    console.log(
      `✓ Deleted ${deletedCount} NormalGL file(s).`
    );
  }

  console.log("");
}

// ---------------------------------------------------------
// MAIN
// ---------------------------------------------------------

async function main() {
  console.log("");
  console.log("========================================");
  console.log("ESPASYO ID MIGRATION SEEDER");
  console.log("========================================");
  console.log("");

  console.log(
    "adminEmployees -> AE-yyxxx"
  );

  console.log(
    "assets         -> A-yyxxx"
  );

  console.log(
    "projects       -> P-yyxxx"
  );

  console.log(
    "users          -> U-yyxxx"
  );

  console.log("");

  // -------------------------------------------------------
  // 1. LOAD
  // -------------------------------------------------------

  const collections = await loadCollections();

  // -------------------------------------------------------
  // 2. GENERATE MAPPING
  // -------------------------------------------------------

  const mappings = buildAllMappings(
    collections
  );

  // -------------------------------------------------------
  // 3. PRINT PLAN
  // -------------------------------------------------------

  printMigrationPlan(mappings);

  // -------------------------------------------------------
  // 4. CHECK COLLISIONS
  // -------------------------------------------------------

  await checkTargetIds(mappings);

  // -------------------------------------------------------
  // 5. DRY RUN
  // -------------------------------------------------------

  if (!APPLY_FIRESTORE_MIGRATION) {
    console.log(
      "DRY RUN ONLY - no Firestore documents changed."
    );

    if (DELETE_NORMALGL_FILES) {
      console.log(
        "NormalGL deletion is also skipped during dry run."
      );
    }

    return;
  }

  // -------------------------------------------------------
  // 6. CREATE NEW DOCUMENTS
  // -------------------------------------------------------

  const idMaps = {};

  for (const collectionName of Object.keys(mappings)) {
    idMaps[collectionName] = {};

    for (const item of mappings[collectionName]) {
      idMaps[collectionName][item.oldId] =
        item.newId;
    }
  }

  await createNewDocuments(
    mappings,
    idMaps
  );

  // -------------------------------------------------------
  // 7. DELETE OLD DOCUMENTS
  // -------------------------------------------------------

  await deleteOldDocuments(
    mappings
  );

  // -------------------------------------------------------
  // 8. DELETE NORMALGL
  // -------------------------------------------------------

  if (DELETE_NORMALGL_FILES) {
    await deleteNormalGLFiles();
  }

  // -------------------------------------------------------
  // DONE
  // -------------------------------------------------------

  console.log("========================================");
  console.log("MIGRATION COMPLETE");
  console.log("========================================");
  console.log("");

  for (const collectionName of Object.keys(mappings)) {
    console.log(
      `✓ ${collectionName}: ` +
      `${mappings[collectionName].length} migrated`
    );
  }

  console.log("");

  if (DELETE_NORMALGL_FILES) {
    console.log(
      "✓ NormalGL Storage files deleted."
    );
  }

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("========================================");
  console.error("MIGRATION FAILED");
  console.error("========================================");
  console.error("");
  console.error(error);
  process.exit(1);
});