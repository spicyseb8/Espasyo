
import { adminDb } from "./firebase-admin.js";

const COLLECTION = "notifications";

function serialize(value) {
  if (value === null || value === undefined) return value;

  if (value?.toDate instanceof Function) {
    return value.toDate().toISOString();
  }

  if (value?._seconds !== undefined) {
    return new Date(value._seconds * 1000).toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (typeof value === "object") {
    if (value.path && value.constructor?.name === "DocumentReference") {
      return `[DocumentReference: ${value.path}]`;
    }

    const result = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = serialize(item);
    }

    return result;
  }

  return value;
}

async function main() {
  console.log("\nESPASYO NOTIFICATION INSPECTOR");
  console.log("==============================");
  console.log("MODE: READ ONLY");
  console.log("Firebase writes: NONE\n");

  const snapshot = await adminDb
    .collection(COLLECTION)
    .get();

  console.log(`Total notifications: ${snapshot.size}`);

  for (const doc of snapshot.docs) {
    console.log("\n--------------------------------");
    console.log(`DOCUMENT ID: ${doc.id}`);

    const data = doc.data();

    console.log("\nTOP-LEVEL FIELDS:");
    console.log(JSON.stringify(serialize(data), null, 2));

    const recipientsSnapshot = await doc.ref
      .collection("recipients")
      .get();

    console.log("\nRECIPIENT DOCUMENTS:");
    console.log(`Count: ${recipientsSnapshot.size}`);

    for (const recipient of recipientsSnapshot.docs) {
      console.log(`\nRecipient document ID: ${recipient.id}`);

      console.log(
        JSON.stringify(
          serialize(recipient.data()),
          null,
          2
        )
      );
    }
  }

  console.log("\n================================");
  console.log("INSPECTION COMPLETE");
  console.log("NO DATA WAS MODIFIED.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("INSPECTION FAILED:", error);
    process.exit(1);
  });
c