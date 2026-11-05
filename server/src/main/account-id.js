const ACCOUNT_ID_PREFIX = "U";

function getAccountSequence(id, year) {
  if (typeof id !== "string") return 0;
  const match = id.match(new RegExp(`^U-${String(year).slice(-2)}(\\d{3,})$`));
  return match ? Number(match[1]) : 0;
}

export async function generateAccountId(db, year = new Date().getFullYear()) {
  const yearSuffix = String(year).slice(-2);
  const prefix = `${ACCOUNT_ID_PREFIX}-${yearSuffix}`;
  const counterReference = db.collection("systemCounters").doc(`account-U-${yearSuffix}`);
  const counterSnapshot = await counterReference.get();
  let legacyHighest = 0;
  if (!counterSnapshot.exists) {
    const [usersSnapshot, employeesSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("adminEmployees").get(),
    ]);
    legacyHighest = [...usersSnapshot.docs, ...employeesSnapshot.docs].reduce(
      (highest, document) => {
        const data = document.data();
        return Math.max(
          highest,
          getAccountSequence(typeof data.id === "string" ? data.id : document.id, year),
        );
      },
      0,
    );
  }
  const initialCounter = Math.max(
    Number.isSafeInteger(counterSnapshot.data()?.value) ? counterSnapshot.data().value : 0,
    legacyHighest,
  );
  const users = db.collection("users");
  const employees = db.collection("adminEmployees");

  return db.runTransaction(async transaction => {
    const currentCounter = await transaction.get(counterReference);
    let sequence = Math.max(
      initialCounter,
      Number.isSafeInteger(currentCounter.data()?.value) ? currentCounter.data().value : 0,
    ) + 1;
    let accountId = `${prefix}${String(sequence).padStart(3, "0")}`;
    let [userDocument, employeeDocument] = await Promise.all([
      transaction.get(users.doc(accountId)),
      transaction.get(employees.doc(accountId)),
    ]);

    while (userDocument.exists || employeeDocument.exists) {
      sequence += 1;
      accountId = `${prefix}${String(sequence).padStart(3, "0")}`;
      [userDocument, employeeDocument] = await Promise.all([
        transaction.get(users.doc(accountId)),
        transaction.get(employees.doc(accountId)),
      ]);
    }

    transaction.set(counterReference, {
      value: sequence,
      updated_at: new Date(),
    });
    return accountId;
  });
}
