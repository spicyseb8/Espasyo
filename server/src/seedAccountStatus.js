import { adminDb } from "./firebase-admin.js";


//==================================================
// DEFAULT ACCOUNT STATUS
//==================================================

const DEFAULT_ACCOUNT_STATUS = "active";


//==================================================
// SEED COLLECTION
//==================================================

async function seedCollection(
  collectionName
) {

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `PROCESSING COLLECTION: ${collectionName}`
  );

  console.log(
    "=============================================="
  );


  const collectionRef =
    adminDb.collection(
      collectionName
    );


  const snapshot =
    await collectionRef.get();


  let updated = 0;
  let alreadyCorrect = 0;
  let errors = 0;


  //--------------------------------------------------
  // PROCESS EACH DOCUMENT
  //--------------------------------------------------

  for (const documentSnapshot of snapshot.docs) {

    const documentId =
      documentSnapshot.id;

    const currentData =
      documentSnapshot.data();


    console.log("");
    console.log(
      `Checking ${collectionName}/${documentId}...`
    );


    //--------------------------------------------------
    // CURRENT STATUS
    //--------------------------------------------------

    const currentStatus =
      currentData?.account_status;


    console.log(
      "Current account status:",
      currentStatus ?? "(missing)"
    );


    //--------------------------------------------------
    // DON'T OVERWRITE EXISTING STATUS
    //--------------------------------------------------

    if (
      currentStatus !== undefined &&
      currentStatus !== null &&
      currentStatus !== ""
    ) {

      console.log(
        `✓ Account status already exists for ${documentId}`
      );

      alreadyCorrect++;

      continue;

    }


    //--------------------------------------------------
    // ADD DEFAULT STATUS
    //--------------------------------------------------

    try {

      await collectionRef
        .doc(documentId)
        .update({

          account_status:
            DEFAULT_ACCOUNT_STATUS,

          updated_at:
            new Date(),

        });


      console.log(
        `✓ Added account_status: active to ${documentId}`
      );

      updated++;

    } catch (error) {

      console.error(
        `❌ Failed to update ${documentId}`
      );

      console.error(
        error
      );

      errors++;

    }

  }


  //--------------------------------------------------
  // COLLECTION SUMMARY
  //--------------------------------------------------

  console.log("");
  console.log(
    `Finished ${collectionName}`
  );

  console.log(
    `Updated: ${updated}`
  );

  console.log(
    `Already had status: ${alreadyCorrect}`
  );

  console.log(
    `Errors: ${errors}`
  );


  return {
    updated,
    alreadyCorrect,
    errors,
  };

}


//==================================================
// MAIN SEEDER
//==================================================

async function seedAccountStatus() {

  console.log(
    "================================================"
  );

  console.log(
    "ACCOUNT STATUS SEEDER"
  );

  console.log(
    "================================================"
  );


  //--------------------------------------------------
  // USERS
  //--------------------------------------------------

  const usersResult =
    await seedCollection(
      "users"
    );


  //--------------------------------------------------
  // ADMIN EMPLOYEES
  //--------------------------------------------------

  const employeesResult =
    await seedCollection(
      "adminEmployees"
    );


  //--------------------------------------------------
  // FINAL SUMMARY
  //--------------------------------------------------

  const totalUpdated =
    usersResult.updated +
    employeesResult.updated;


  const totalAlreadyCorrect =
    usersResult.alreadyCorrect +
    employeesResult.alreadyCorrect;


  const totalErrors =
    usersResult.errors +
    employeesResult.errors;


  console.log("");
  console.log(
    "================================================"
  );

  console.log(
    "ACCOUNT STATUS SEEDER COMPLETE"
  );

  console.log(
    "================================================"
  );

  console.log(
    `Total updated: ${totalUpdated}`
  );

  console.log(
    `Already had status: ${totalAlreadyCorrect}`
  );

  console.log(
    `Errors: ${totalErrors}`
  );

  console.log(
    "================================================"
  );


  if (
    totalErrors > 0
  ) {

    console.log(
      "⚠️ Seeder completed with errors."
    );

  } else {

    console.log(
      "✓ All account documents were processed successfully."
    );

  }

}


//==================================================
// RUN SCRIPT
//==================================================

seedAccountStatus()
  .then(() => {

    console.log(
      "Script finished successfully."
    );

    process.exit(0);

  })
  .catch((error) => {

    console.error(
      "❌ Account status seeder failed:"
    );

    console.error(
      error
    );

    process.exit(1);

  });