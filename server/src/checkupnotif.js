
import { adminDb } from "./firebase-admin.js";

const COLLECTION_NAME = "notifications";
const RECIPIENTS_SUBCOLLECTION = "recipients";

const EXECUTE =
  process.argv.includes("--execute") &&
  process.argv.includes("--confirm-repair");

const BATCH_LIMIT = 450;

function getRecipientUids(data) {
  const recipients = new Set();

  // Single recipient
  if (
    typeof data.recipientUid === "string" &&
    data.recipientUid.trim()
  ) {
    recipients.add(data.recipientUid.trim());
  }

  // Multiple recipients
  if (Array.isArray(data.recipientUids)) {
    for (const uid of data.recipientUids) {
      if (typeof uid === "string" && uid.trim()) {
        recipients.add(uid.trim());
      }
    }
  }

  return [...recipients];
}

function buildRecipientData(notificationId, data, uid) {
  return {
    ...data,
    notificationId,
    recipientUid: uid,
    isRead:
      typeof data.isRead === "boolean"
        ? data.isRead
        : false,
  };
}

async function main() {
  console.log("\nESPASYO NOTIFICATION RECIPIENT SEEDER");
  console.log("====================================");
  console.log(`Mode: ${EXECUTE ? "LIVE REPAIR" : "DRY RUN"}`);
  console.log("Top-level notifications: PRESERVED");
  console.log("Existing recipient documents: PRESERVED");
  console.log("Firebase Storage: NEVER TOUCHED\n");

  const snapshot = await adminDb
    .collection(COLLECTION_NAME)
    .get();

  console.log(`Notifications found: ${snapshot.size}\n`);

  let notificationsWithRecipients = 0;
  let notificationsWithoutRecipients = 0;
  let existingRecipients = 0;
  let missingRecipients = 0;
  let skippedInvalidRecipients = 0;

  const operations = [];

  for (const notificationDoc of snapshot.docs) {
    const notificationId = notificationDoc.id;
    const data = notificationDoc.data();

    const recipientUids = getRecipientUids(data);

    console.log("------------------------------------");
    console.log(`Notification: ${notificationId}`);

    if (recipientUids.length === 0) {
      notificationsWithoutRecipients++;

      console.log("SKIPPED: No explicit recipientUid or recipientUids.");
      continue;
    }

    notificationsWithRecipients++;

    console.log(`Intended recipients: ${recipientUids.length}`);

    for (const uid of recipientUids) {
      if (!uid || typeof uid !== "string") {
        skippedInvalidRecipients++;
        continue;
      }

      const recipientRef = notificationDoc.ref
        .collection(RECIPIENTS_SUBCOLLECTION)
        .doc(uid);

      const recipientSnapshot = await recipientRef.get();

      if (recipientSnapshot.exists) {
        existingRecipients++;
        console.log(`EXISTS: ${uid}`);
        continue;
      }

      missingRecipients++;

      console.log(
        `${EXECUTE ? "CREATE" : "WOULD CREATE"}: ${uid}`
      );

      operations.push({
        ref: recipientRef,
        data: buildRecipientData(notificationId, data, uid),
      });
    }
  }

  console.log("\n====================================");
  console.log("REPAIR SUMMARY");
  console.log("====================================");

  console.log(
    `Notifications with recipients: ${notificationsWithRecipients}`
  );

  console.log(
    `Notifications without recipient information: ${notificationsWithoutRecipients}`
  );

  console.log(`Existing recipient documents: ${existingRecipients}`);
  console.log(`Missing recipient documents: ${missingRecipients}`);

  console.log(
    `Invalid recipients skipped: ${skippedInvalidRecipients}`
  );

  console.log(`Documents to create: ${operations.length}`);

  if (!EXECUTE) {
    console.log("\nDRY RUN ONLY — NOTHING WAS WRITTEN.");

    console.log(
      "Review the recipient assignments before executing."
    );

    console.log(
      "\nTo execute, run:"
    );

    console.log(
      "node src/seed-notification-recipients.js --execute --confirm-repair"
    );

    return;
  }

  if (operations.length === 0) {
    console.log("\nNo missing recipient documents. Nothing to repair.");
    return;
  }

  console.log("\nSTARTING REPAIR...\n");

  let created = 0;

  for (
    let start = 0;
    start < operations.length;
    start += BATCH_LIMIT
  ) {
    const chunk = operations.slice(
      start,
      start + BATCH_LIMIT
    );

    const batch = adminDb.batch();

    for (const operation of chunk) {
      // Create only. Never overwrite an existing recipient.
      batch.create(operation.ref, operation.data);
    }

    await batch.commit();

    created += chunk.length;

    console.log(
      `Committed ${created}/${operations.length} recipient documents.`
    );
  }

  console.log("\n====================================");
  console.log("REPAIR COMPLETED");
  console.log("====================================");

  console.log(`Recipient documents created: ${created}`);
  console.log("Top-level notifications: UNCHANGED");
  console.log("Existing recipient documents: UNCHANGED");
  console.log("Firebase Storage: UNTOUCHED");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nNOTIFICATION SEEDER FAILED");
    console.error(error);
    process.exit(1);
  });
