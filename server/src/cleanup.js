
import { getApp } from "firebase-admin/app";
import { adminAuth, adminDb, adminStorage } from "./firebase-admin.js";
import {
  isAccountIdCounter,
  isProtectedSuperadminDocument,
  isProjectUserStoragePath,
  parseResetOptions,
  RESET_STORAGE_PREFIXES,
} from "./cleanup-plan.js";

// ============================================================
// ESPASYO FULL APPLICATION DATA RESET
// ============================================================

// Global asset records and their counters must remain usable after the reset.
const PRESERVED_COLLECTIONS = new Set([
  "assets",
  "systemCounters",
]);

const DELETE_COLLECTIONS = new Set([
  "users",
  "adminEmployees",

  "projects",
  "idCounters",
  "adminManagedFloorPlanDrafts",
  "adminManagedProjectAssignments",

  "projectActivity",
  "projectSubmissions",
  "projectVersions",
  "adminComments",

  // Notifications
  "notificationCounters",
  "notificationEventKeys",
  "notifications",
]);

// ============================================================
// HELPERS
// ============================================================

function printSection(title) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

async function getAllAuthUsers() {
  const users = [];
  let pageToken;

  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return users;
}

async function getRootCollections() {
  return await adminDb.listCollections();
}

async function countDocuments(collectionRef) {
  const snapshot = await collectionRef.get();
  return snapshot.size;
}

// ============================================================
// SUPERADMIN VALIDATION
// ============================================================

async function validateSuperadmin() {
  printSection("CHECKING SUPERADMIN PROTECTION");

  const superadminSnapshot = await adminDb
    .collection("adminEmployees")
    .where("role", "==", "superadmin")
    .get();
  const superadminProfiles = superadminSnapshot.docs.filter(
    document => typeof document.data().uid === "string" &&
      document.data().uid.trim() !== "",
  );

  if (superadminProfiles.length !== 1) {
    throw new Error(
      `Expected one superadmin profile; found ${superadminProfiles.length}. Reset aborted.`,
    );
  }

  const employeeDocument = superadminProfiles[0];
  const employee = employeeDocument.data();
  const uid = employee.uid.trim();
  const authUser = await adminAuth.getUser(uid);
  if (authUser.uid !== uid || authUser.disabled) {
    throw new Error("Superadmin Auth verification failed. Reset aborted.");
  }

  console.log("Exactly one active superadmin Auth account and profile were verified.");
  console.log(`Protected Firestore profile: adminEmployees/${employeeDocument.id}`);
  return {
    uid,
    documentId: employeeDocument.id,
  };
}

// ============================================================
// FIRESTORE INVENTORY
// ============================================================

async function inspectFirestore() {
  printSection("FIRESTORE ROOT COLLECTION INVENTORY");

  const collections = await getRootCollections();

  const inventory = [];
  const unreviewed = [];

  for (const collection of collections) {
    const name = collection.id;
    const count = await countDocuments(collection);

    let status;

    if (name === "systemCounters") {
      status = "PARTIAL - account ID counters deleted";
    } else if (PRESERVED_COLLECTIONS.has(name)) {
      status = "PRESERVE";
    } else if (DELETE_COLLECTIONS.has(name)) {
      status = "DELETE CANDIDATE";
    } else {
      status = "UNREVIEWED - NOT TOUCHED";
      unreviewed.push(name);
    }

    inventory.push({
      name,
      count,
      status,
      ref: collection,
    });

    console.log(
      `  ${status.padEnd(23)} ${name}: ${count} documents`
    );
  }

  if (unreviewed.length > 0) {
    console.log("\nUNREVIEWED COLLECTIONS FOUND:");

    for (const name of unreviewed) {
      console.log(`  - ${name}`);
    }

    console.log(
      "\nReview these collections. Add project/account collections " +
      "to DELETE_COLLECTIONS and collections that must remain to " +
      "PRESERVED_COLLECTIONS."
    );
  }

  return {
    inventory,
    unreviewed,
  };
}

// ============================================================
// AUTHENTICATION DELETION PLAN
// ============================================================

async function inspectAuthentication(superadmin) {
  printSection("AUTHENTICATION PLAN");

  const users = await getAllAuthUsers();

  const protectedUsers = users.filter(
    user => user.uid === superadmin.uid,
  );

  const usersToDelete = users.filter(
    user => user.uid !== superadmin.uid,
  );

  if (protectedUsers.length !== 1) {
    throw new Error(
      "The verified superadmin Auth account was not found exactly once.",
    );
  }

  console.log(`Total Auth accounts: ${users.length}`);
  console.log("Superadmin Auth accounts preserved: 1");
  console.log(`Auth accounts to delete: ${usersToDelete.length}`);

  return {
    usersToDelete,
  };
}

// ============================================================
// FIRESTORE DELETION PLAN
// ============================================================

async function inspectDeletionPlan(inventory, superadmin) {
  printSection("FIRESTORE DELETION PLAN");

  const deletionPlan = [];
  let totalDocuments = 0;

  for (const collection of inventory) {
    if (
      !DELETE_COLLECTIONS.has(collection.name) &&
      collection.name !== "systemCounters"
    ) {
      continue;
    }

    const snapshot = await collection.ref.get();
    const documents = [];

    for (const document of snapshot.docs) {
      if (
        collection.name === "systemCounters" &&
        !isAccountIdCounter(document.id)
      ) {
        continue;
      }

      if (
        isProtectedSuperadminDocument(
          collection.name,
          document.id,
          document.data(),
          superadmin,
        )
      ) {
        continue;
      }

      documents.push(document.ref);
    }

    deletionPlan.push({
      name: collection.name === "systemCounters"
        ? "systemCounters/account-*"
        : collection.name,
      documents,
    });

    totalDocuments += documents.length;

    console.log(
      `  ${collection.name}: ${documents.length} documents to delete`
    );
  }

  console.log(
    `\nTotal root documents to delete: ${totalDocuments}`
  );

  console.log(
    "Nested subcollections: recursively deleted beneath selected documents"
  );

  return {
    deletionPlan,
    totalDocuments,
  };
}

// ============================================================
// DELETE FIREBASE AUTH USERS
// ============================================================

async function deleteAuthUsers(usersToDelete) {
  printSection("DELETING FIREBASE AUTHENTICATION USERS");

  let deleted = 0;
  let failed = 0;

  for (const user of usersToDelete) {
    try {
      await adminAuth.deleteUser(user.uid);
      deleted++;

      console.log("  Deleted one Auth account.");
    } catch (error) {
      failed++;

      console.error("  Auth account deletion failed:", error.message);
    }
  }

  console.log("\nAUTH DELETION SUMMARY");
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    throw new Error(
      `${failed} Auth account(s) failed to delete.`
    );
  }
}

// ============================================================
// DELETE FIRESTORE DOCUMENTS
// ============================================================

async function deleteFirestoreDocuments(deletionPlan) {
  printSection("DELETING FIRESTORE DATA");

  let deleted = 0;
  let failed = 0;

  for (const collection of deletionPlan) {
    console.log(`\nProcessing: ${collection.name}`);

    for (const documentRef of collection.documents) {
      try {
        // recursiveDelete removes the document and its subcollections.
        await adminDb.recursiveDelete(documentRef);

        deleted++;

        console.log(`  DELETED: ${documentRef.path}`);
      } catch (error) {
        failed++;

        console.error(
          `  FAILED: ${documentRef.path}`,
          error.message
        );
      }
    }
  }

  console.log("\nFIRESTORE DELETION SUMMARY");
  console.log(`Deleted root documents: ${deleted}`);
  console.log(`Failed root documents: ${failed}`);

  if (failed > 0) {
    throw new Error(
      `${failed} Firestore document(s) failed to delete.`
    );
  }
}

// ============================================================
// STORAGE PLAN AND DELETION
// ============================================================

async function inspectStorage() {
  printSection("PROJECT AND USER STORAGE PLAN");
  const filesToDelete = [];

  for (const prefix of RESET_STORAGE_PREFIXES) {
    const [files] = await adminStorage.getFiles({ prefix });
    const matchingFiles = files.filter(file =>
      isProjectUserStoragePath(file.name),
    );
    filesToDelete.push(...matchingFiles);
    console.log(`  ${prefix}: ${matchingFiles.length} objects to delete`);
  }

  console.log("  assets/: preserved");
  return filesToDelete;
}

async function deleteStorageFiles(files) {
  printSection("DELETING PROJECT AND USER STORAGE");
  let deleted = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await file.delete({ ignoreNotFound: true });
      deleted++;
    } catch (error) {
      failed++;
      console.error("Storage object deletion failed:", error.message);
    }
  }

  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) {
    throw new Error(`${failed} project/user Storage object(s) failed to delete.`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const { projectId, execute } = parseResetOptions(
    process.argv.slice(2),
    getApp().options.projectId,
    adminStorage.name,
  );

  console.log("\nESPASYO FULL APPLICATION DATA RESET");
  console.log("========================================");

  console.log(`Firebase project: ${projectId}`);
  console.log(`Storage bucket: ${adminStorage.name}`);
  console.log(`Mode: ${execute ? "LIVE EXECUTION" : "DRY RUN"}`);

  console.log(
    `Preserved collections: assets and non-account system counters`,
  );

  // 1. Verify the superadmin before planning any deletion.
  const superadmin = await validateSuperadmin();

  // 2. Inspect all root Firestore collections.
  const { inventory, unreviewed } = await inspectFirestore();

  // 3. Inspect Firebase Authentication accounts.
  const { usersToDelete } = await inspectAuthentication(superadmin);

  // 4. Build the Firestore deletion plan.
  const { deletionPlan, totalDocuments } =
    await inspectDeletionPlan(inventory, superadmin);
  const storageFiles = await inspectStorage();

  // 5. Show protected records.
  printSection("PROTECTED FIRESTORE PROFILES");

  console.log(`  KEEP adminEmployees/${superadmin.documentId}`);
  console.log("  KEEP user profile documents associated with the same Auth UID");

  // 6. Show preserved collections.
  printSection("PRESERVED COLLECTIONS");

  for (const collection of inventory) {
    if (PRESERVED_COLLECTIONS.has(collection.name)) {
      console.log(
        `  KEEP ${collection.name}: ${collection.count} documents`
      );
    }
  }

  // 7. Never allow live execution with unreviewed collections.
  if (execute && unreviewed.length > 0) {
    throw new Error(
      "LIVE EXECUTION BLOCKED: Unreviewed Firestore collections remain."
    );
  }

  // 8. Dry-run mode: stop without deleting anything.
  if (!execute) {
    printSection("DRY RUN COMPLETE");

    console.log("DRY RUN ONLY — NOTHING WAS DELETED.");

    console.log("\nReview every collection and count above.");

    console.log("To execute, pass the exact project and bucket confirmations:");
    console.log(
      `npm run reset:firebase -- --project-id=${projectId} --execute --confirm-project-id=${projectId} --confirm-storage-bucket=${adminStorage.name}`,
    );

    return;
  }

  // 9. Final confirmation summary.
  printSection("LIVE DELETION CONFIRMATION");

  console.log(
    `Auth accounts to delete: ${usersToDelete.length}`
  );

  console.log(
    `Firestore root documents to delete: ${totalDocuments}`
  );

  console.log("One verified superadmin account/profile will remain.");
  console.log(`Project/user Storage objects to delete: ${storageFiles.length}`);
  console.log("The global assets collection and assets/ Storage remain untouched.");

  // 10. Execute deletion.
  await deleteFirestoreDocuments(deletionPlan);
  await deleteStorageFiles(storageFiles);
  await deleteAuthUsers(usersToDelete);

  printSection("RESET COMPLETE");

  console.log("Espasyo application data reset completed.");
  console.log("Superadmin account preserved.");
  console.log("Global asset catalog and asset ID counters preserved.");
}

// ============================================================
// EXECUTION
// ============================================================

main().catch((error) => {
  console.error("\nRESET ABORTED");
  console.error(error);

  process.exitCode = 1;
});
