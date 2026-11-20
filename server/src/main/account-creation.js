import {
  normalizeFullName,
  validateEmail,
  validateFullName,
  validatePassword,
} from "../../../shared/auth/formValidation.mjs";
import { generateAccountId } from "./account-id.js";

const PHONE_CHARACTERS_PATTERN = /^[+()\d\s-]+$/;

function normalizePhilippinePhone(value) {
  if (typeof value !== "string") return "";
  const phone = value.trim();
  if (!phone || !PHONE_CHARACTERS_PATTERN.test(phone)) return "";

  const digits = phone.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  return "";
}

function failure(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function createClientProfileRecord(input, {
  adminAuth,
  adminDb,
  actorUid,
}) {
  const { uid, name, email, phoneNumber, address } = input ?? {};
  const normalizedName = typeof name === "string" ? normalizeFullName(name) : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPhone = normalizePhilippinePhone(phoneNumber);
  const normalizedAddress = typeof address === "string" ? address.trim() : "";

  if (typeof uid !== "string" || !uid.trim() || typeof actorUid !== "string" || !actorUid) {
    throw failure(400, "Client account identity is invalid.");
  }
  if (validateFullName(normalizedName) || normalizedName.length > 120) {
    throw failure(400, "Enter a valid full name with a first and last name.");
  }
  if (validateEmail(normalizedEmail)) {
    throw failure(400, "Enter a valid email address.");
  }
  if (!normalizedPhone) {
    throw failure(400, "Enter all 10 digits of a Philippine mobile number.");
  }
  if (!normalizedAddress) {
    throw failure(400, "Client address is required.");
  }

  let firebaseUser;
  try {
    firebaseUser = await adminAuth.getUser(uid);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw failure(400, "The client sign-in account could not be verified.");
    }
    throw error;
  }
  if (firebaseUser.email?.trim().toLowerCase() !== normalizedEmail) {
    throw failure(400, "Client email does not match the sign-in account.");
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

  const now = new Date();
  const record = {
    id: uid,
    uid,
    full_name: normalizedName,
    email: normalizedEmail,
    phone_number: normalizedPhone,
    address: normalizedAddress,
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(normalizedName)}`,
    account_status: "active",
    isActive: true,
    role: "client",
    createdBy: actorUid,
    createdAt: now,
    created_at: now,
    updated_at: now,
  };

  try {
    await adminDb.collection("users").doc(uid).create(record);
  } catch (error) {
    if (error.code === "already-exists") {
      throw failure(409, "A client profile already exists for this account.");
    }
    throw error;
  }

  return {
    id: uid,
    uid,
    name: normalizedName,
    email: normalizedEmail,
    accountType: "user",
  };
}

export async function createAccountRecord(input, {
  adminAuth,
  adminDb,
  createId = () => generateAccountId(adminDb),
}) {
  const { accountType, name, email, password, phoneNumber, address, role } = input ?? {};
  const normalizedName = typeof name === "string" ? normalizeFullName(name) : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!["user", "employee"].includes(accountType)) {
    throw failure(400, "Invalid account type. Use user or employee.");
  }
  if (validateFullName(normalizedName) || normalizedName.length > 120) {
    throw failure(400, "Enter a valid full name with a first and last name.");
  }
  if (validateEmail(normalizedEmail)) {
    throw failure(400, "Enter a valid email address.");
  }
  if (typeof password !== "string" || validatePassword(password)) {
    throw failure(400, "Password must meet all listed security requirements.");
  }
  if (accountType === "employee" && !["admin", "superadmin"].includes(role)) {
    throw failure(400, "Employee role must be admin or superadmin.");
  }

  const normalizedPhone = accountType === "user"
    ? normalizePhilippinePhone(phoneNumber)
    : "";
  if (accountType === "user" && !normalizedPhone) {
    throw failure(400, "Enter all 10 digits of a Philippine mobile number.");
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
        phone_number: normalizedPhone,
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
