
import { adminAuth, adminDb } from "./firebase-admin.js";

// ============================================================
// ESPASYO FULL APPLICATION DATA RESET
// ============================================================

// Protected superadmin
const SUPERADMIN_UID = "dZvdijPVLhNXTAQjhoCDWAJ80nX2";
const SUPERADMIN_EMAIL = "sfmaster901@gmail.com";

// Protected Firestore profile
const SUPERADMIN_EMPLOYEE_DOC_ID = "AE-26001";

// Collections that must remain untouched
const PRESERVED_COLLECTIONS = new Set([
  "assets",
  "idCounters",
  "systemCounters",
]);

// Collections that will be deleted
const DELETE_COLLECTIONS = new Set([
  "users",
  "adminEmployees",

  "projects",
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

const EXECUTE =
  process.argv.includes("--execute") &&
  process.argv.includes("--confirm-delete");

// ============================================================
// HELPERS
// ============================================================

function printSection(title) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

  const authUser = await adminAuth.getUser(SUPERADMIN_UID);

  if (
    authUser.uid !== SUPERADMIN_UID ||
    normalizeEmail(authUser.email) !== normalizeEmail(SUPERADMIN_EMAIL) ||
    authUser.disabled
  ) {
    throw new Error(
      "Superadmin Auth verification failed. Aborting reset."
    );
  }

  console.log("AUTHENTICATION ACCOUNT: VERIFIED");
  console.log({
    uid: authUser.uid,
    email: authUser.email,
    disabled: authUser.disabled,
    emailVerified: authUser.emailVerified,
  });

  const employeeRef = adminDb
    .collection("adminEmployees")
    .doc(SUPERADMIN_EMPLOYEE_DOC_ID);

  const employeeSnapshot = await employeeRef.get();

  if (!employeeSnapshot.exists) {
    throw new Error(
      "Protected superadmin employee document was not found."
    );
  }

  const employee = employeeSnapshot.data();

  if (
    employee.uid !== SUPERADMIN_UID ||
    normalizeEmail(employee.email) !== normalizeEmail(SUPERADMIN_EMAIL) ||
    employee.role !== "superadmin"
  ) {
    throw new Error(
      "Superadmin employee profile verification failed. Aborting reset."
    );
  }

  console.log("\nADMIN EMPLOYEE RECORD: VERIFIED");
  console.log(`Document: ${SUPERADMIN_EMPLOYEE_DOC_ID}`);
  console.log(`Role: ${employee.role}`);

  const userRef = adminDb.collection("users").doc("U-26002");
  const userSnapshot = await userRef.get();

  if (userSnapshot.exists) {
    const user = userSnapshot.data();

    if (
      user.uid === SUPERADMIN_UID &&
      normalizeEmail(user.email) === normalizeEmail(SUPERADMIN_EMAIL)
    ) {
      console.log("\nSUPERADMIN USER PROFILE: VERIFIED");
      console.log("Document: users/U-26002");
    } else {
      console.log(
        "\nusers/U-26002 does not match the protected superadmin."
      );
      console.log("It will not receive special protection.");
    }
  }

  return {
    authUser,
    employeeRef,
    employee,
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

    if (PRESERVED_COLLECTIONS.has(name)) {
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

async function inspectAuthentication() {
  printSection("AUTHENTICATION PLAN");

  const users = await getAllAuthUsers();

  const protectedUsers = users.filter(
    (user) => user.uid === SUPERADMIN_UID
  );

  const usersToDelete = users.filter(
    (user) => user.uid !== SUPERADMIN_UID
  );

  if (protectedUsers.length !== 1) {
    throw new Error(
      "Expected exactly one protected superadmin Auth account."
    );
  }

  console.log(`Total Auth accounts: ${users.length}`);
  console.log(`Superadmin Auth accounts preserved: ${protectedUsers.length}`);
  console.log(`Auth accounts to delete: ${usersToDelete.length}`);

  return {
    users,
    usersToDelete,
  };
}

// ============================================================
// FIRESTORE DELETION PLAN
// ============================================================

async function inspectDeletionPlan(inventory) {
  printSection("FIRESTORE DELETION PLAN");

  const deletionPlan = [];
  let totalDocuments = 0;

  for (const collection of inventory) {
    if (!DELETE_COLLECTIONS.has(collection.name)) {
      continue;
    }

    const snapshot = await collection.ref.get();
    const documents = [];

    for (const document of snapshot.docs) {
      // Always preserve the verified superadmin employee record.
      if (
        collection.name === "adminEmployees" &&
        document.id === SUPERADMIN_EMPLOYEE_DOC_ID
      ) {
        continue;
      }

      // Preserve the superadmin user profile only when verified.
      if (collection.name === "users") {
        const data = document.data();

        const isProtectedSuperadmin =
          data.uid === SUPERADMIN_UID &&
          normalizeEmail(data.email) === normalizeEmail(SUPERADMIN_EMAIL);

        if (isProtectedSuperadmin) {
          continue;
        }
      }

      documents.push(document.ref);
    }

    deletionPlan.push({
      name: collection.name,
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

      console.log(
        `  DELETED: ${user.email || user.uid}`
      );
    } catch (error) {
      failed++;

      console.error(
        `  FAILED: ${user.email || user.uid}`,
        error.message
      );
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
// MAIN
// ============================================================

async function main() {
  console.log("\nESPASYO FULL APPLICATION DATA RESET");
  console.log("========================================");

  console.log(`Mode: ${EXECUTE ? "LIVE EXECUTION" : "DRY RUN"}`);
  console.log("Firebase Storage: NEVER TOUCHED");

  console.log(
    `Protected superadmin: ${SUPERADMIN_EMAIL} (${SUPERADMIN_UID})`
  );

  console.log(
    `Preserved collections: ${[...PRESERVED_COLLECTIONS].join(", ")}`
  );

  if (
    process.argv.includes("--execute") !==
    process.argv.includes("--confirm-delete")
  ) {
    throw new Error(
      "Live execution requires BOTH --execute and --confirm-delete."
    );
  }

  // 1. Verify the superadmin before planning any deletion.
  await validateSuperadmin();

  // 2. Inspect all root Firestore collections.
  const { inventory, unreviewed } = await inspectFirestore();

  // 3. Inspect Firebase Authentication accounts.
  const { usersToDelete } = await inspectAuthentication();

  // 4. Build the Firestore deletion plan.
  const { deletionPlan, totalDocuments } =
    await inspectDeletionPlan(inventory);

  // 5. Show protected records.
  printSection("PROTECTED FIRESTORE PROFILES");

  console.log(
    `  KEEP adminEmployees/${SUPERADMIN_EMPLOYEE_DOC_ID}`
  );

  console.log(
    "  KEEP any users profile only if its UID/email matches the protected superadmin"
  );

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
  if (EXECUTE && unreviewed.length > 0) {
    throw new Error(
      "LIVE EXECUTION BLOCKED: Unreviewed Firestore collections remain."
    );
  }

  // 8. Dry-run mode: stop without deleting anything.
  if (!EXECUTE) {
    printSection("DRY RUN COMPLETE");

    console.log("DRY RUN ONLY — NOTHING WAS DELETED.");

    console.log("\nReview every collection and count above.");

    console.log(
      "To execute, run:"
    );

    console.log(
      "node src/cleanup-espasyo.js --execute --confirm-delete"
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

  console.log(
    "Protected superadmin account and profile will remain."
  );

  console.log(
    "Preserved collections will remain untouched."
  );

  console.log(
    "Firebase Storage will remain untouched."
  );

  // 10. Execute deletion.
  await deleteAuthUsers(usersToDelete);
  await deleteFirestoreDocuments(deletionPlan);

  printSection("RESET COMPLETE");

  console.log("Espasyo application data reset completed.");
  console.log("Superadmin account preserved.");
  console.log("Assets and counters preserved.");
  console.log("Firebase Storage untouched.");
}

// ============================================================
// EXECUTION
// ============================================================

main().catch((error) => {
  console.error("\nRESET ABORTED");
  console.error(error);

  process.exitCode = 1;
});
