import { generateAccountId } from "./account-id.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failure(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function createAccountRecord(input, {
  adminAuth,
  adminDb,
  createId = () => generateAccountId(adminDb),
}) {
  const { accountType, name, email, password, phoneNumber, address, role } = input ?? {};
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!["user", "employee"].includes(accountType)) {
    throw failure(400, "Invalid account type. Use user or employee.");
  }
  if (!normalizedName || normalizedName.length > 120) {
    throw failure(400, "Enter a name of 1 to 120 characters.");
  }
  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw failure(400, "Enter a valid email address.");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw failure(400, "Password must be at least 6 characters.");
  }
  if (accountType === "employee" && !["admin", "superadmin"].includes(role)) {
    throw failure(400, "Employee role must be admin or superadmin.");
  }

  const [users, employees] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("adminEmployees").get(),
  ]);
  const duplicateInFirestore = [...users.docs, ...employees.docs].some(document =>
    typeof document.data().email === "string" &&
    document.data().email.trim().toLowerCase() === normalizedEmail
  );
  if (duplicateInFirestore) {
    throw failure(409, "An account with this email already exists.");
  }

  try {
    await adminAuth.getUserByEmail(normalizedEmail);
    throw failure(409, "An account with this email already exists.");
  } catch (error) {
    if (error.status) throw error;
    if (error.code !== "auth/user-not-found") throw error;
  }

  const accountId = await createId();
  let firebaseUser;
  try {
    firebaseUser = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: normalizedName,
      ...(accountType === "user" ? { emailVerified: true } : {}),
    });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw failure(409, "An account with this email already exists.");
    }
    throw failure(500, "Failed to create Firebase Authentication account.");
  }

  const now = new Date();
  const commonData = {
    id: accountId,
    email: normalizedEmail,
    uid: firebaseUser.uid,
    account_status: "active",
    created_at: now,
    updated_at: now,
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(normalizedName)}`,
  };
  const userRecord = accountType === "user"
    ? {
        ...commonData,
        full_name: normalizedName,
        phone_number: typeof phoneNumber === "string" ? phoneNumber.trim() : "",
        address: typeof address === "string" ? address.trim() : "",
      }
    : {
        ...commonData,
        name: normalizedName,
        role,
      };

  try {
    await adminDb.collection(accountType === "user" ? "users" : "adminEmployees")
      .doc(accountId)
      .create(userRecord);
  } catch (error) {
    try {
      await adminAuth.deleteUser(firebaseUser.uid);
    } catch (rollbackError) {
      console.error("Failed to rollback Firebase Auth user after Firestore write failure:", rollbackError);
      error.authRollbackFailed = true;
    }
    throw error;
  }

  return {
    id: accountId,
    uid: firebaseUser.uid,
    name: normalizedName,
    email: normalizedEmail,
    accountType,
    ...(accountType === "employee" ? { role } : {}),
    accountStatus: "active",
  };
}
