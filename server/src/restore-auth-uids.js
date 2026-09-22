import { adminDb } from "./firebase-admin.js";

const employeeUidMappings = {
  "AE-26001": "dZvdijPVLhNXTAQjhoCDWAJ80nX2",
  "AE-26002": "DBFU9TURiAZVKlmNBdAVJ8EsQoW2",
  "AE-26003": "AmeOIYHrOmPyv4ljOrV1wudAjlD3",
  "AE-26004": "qhTuHD01QTUlfK3mBEebxFktIEw1",
  "AE-26005": "QsnHsQtOWdWDL5Ua41PuJLg0bJp1",
  "AE-26006": "ehpYL5wkQATWFiOM1nRHX9P7dJh1",
  "AE-26007": "mf8dvMxBmUMNTZ4G4kB9jzowPWG3",
};

async function restoreEmployeeUids() {
  console.log(
    "=============================================="
  );
  console.log(
    "RESTORING ADMIN EMPLOYEE FIREBASE AUTH UIDs"
  );
  console.log(
    "=============================================="
  );

  const collectionRef = adminDb.collection(
    "adminEmployees"
  );

  let updated = 0;
  let missing = 0;
  let alreadyCorrect = 0;

  for (const [employeeId, firebaseUid] of Object.entries(
    employeeUidMappings
  )) {
    console.log("");
    console.log(
      `Checking adminEmployees/${employeeId}...`
    );

    const documentRef = collectionRef.doc(employeeId);
    const documentSnapshot = await documentRef.get();

    if (!documentSnapshot.exists) {
      console.log(
        `❌ Document not found: ${employeeId}`
      );

      missing++;
      continue;
    }

    const currentData = documentSnapshot.data();

    console.log(
      "Current UID:",
      currentData?.uid ?? "(missing)"
    );

    console.log(
      "Correct UID:",
      firebaseUid
    );

    if (currentData?.uid === firebaseUid) {
      console.log(
        `✓ UID already correct for ${employeeId}`
      );

      alreadyCorrect++;
      continue;
    }

    await documentRef.update({
      uid: firebaseUid,
      updated_at: new Date(),
    });

    console.log(
      `✓ Restored UID for ${employeeId}`
    );

    updated++;
  }

  console.log("");
  console.log(
    "=============================================="
  );
  console.log("RESTORE COMPLETE");
  console.log(
    "=============================================="
  );

  console.log(
    `Updated: ${updated}`
  );

  console.log(
    `Already correct: ${alreadyCorrect}`
  );

  console.log(
    `Missing: ${missing}`
  );

  console.log(
    "=============================================="
  );

  if (missing > 0) {
    console.log(
      "⚠️ Some employee documents were not found."
    );
  } else {
    console.log(
      "✓ All employee UID mappings were processed."
    );
  }
}

restoreEmployeeUids()
  .then(() => {
    console.log(
      "Script finished successfully."
    );

    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "❌ Restore script failed:"
    );

    console.error(error);

    process.exit(1);
  });