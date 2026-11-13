import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db, firebaseConfig } from "./firebase";

export interface CreateClientAccountData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
}

function mapCreateClientAccountError(error: unknown): unknown {
  const code = typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;

  switch (code) {
    case "auth/email-already-in-use":
    case "auth/email-already-exists":
      return new Error("An account with this email already exists.");
    case "auth/invalid-email":
      return new Error("Enter a valid email address.");
    case "auth/weak-password":
      return new Error("Choose a password with at least 8 characters.");
    case "auth/network-request-failed":
      return new Error("A network error interrupted account creation. Please try again.");
    default:
      return error;
  }
}

export async function createClientAccount(
  data: CreateClientAccountData,
): Promise<{ cleanupWarning?: string }> {
  const adminUser = auth.currentUser;
  if (!adminUser) {
    throw new Error("Sign in with an admin account to create a client account.");
  }

  const secondaryApp = initializeApp(firebaseConfig, "client-creator");
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>["user"] | null = null;
  let creationError: unknown;
  const cleanupWarnings: string[] = [];

  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      data.email.trim().toLowerCase(),
      data.password,
    );
    createdUser = userCredential.user;

    await sendEmailVerification(userCredential.user);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      id: userCredential.user.uid,
      uid: userCredential.user.uid,
      full_name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone_number: data.phoneNumber.trim(),
      address: data.address.trim(),
      avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(data.name.trim())}`,
      account_status: "active",
      isActive: true,
      role: "client",
      createdBy: adminUser.uid,
      createdAt: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    creationError = error;
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch (rollbackError) {
        console.error("Failed to roll back the client Auth user:", rollbackError);
        creationError = new Error(
          "Client creation failed and the new sign-in account could not be removed. Contact support before retrying.",
          { cause: error },
        );
      }
    }
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch (signOutError) {
      console.error("Failed to sign out the secondary client Auth app:", signOutError);
      if (creationError === undefined) {
        cleanupWarnings.push("The client was created, but the temporary Firebase session did not sign out cleanly.");
      }
    }

    try {
      await deleteApp(secondaryApp);
    } catch (deleteError) {
      console.error("Failed to delete the secondary client Firebase app:", deleteError);
      if (creationError === undefined) {
        cleanupWarnings.push("The client was created, but the temporary Firebase app could not be removed.");
      }
    }
  }

  if (creationError !== undefined) {
    throw mapCreateClientAccountError(creationError);
  }
  if (cleanupWarnings.length) {
    return { cleanupWarning: cleanupWarnings.join(" ") };
  }
  return {};
}
