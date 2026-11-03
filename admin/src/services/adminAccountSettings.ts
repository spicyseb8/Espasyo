import type { User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/firebase/firebase";
import { isAdminRole, type AdminRole } from "@/lib/adminRole";

export interface AdminAccountProfile {
  name: string;
  email: string;
  avatar: string;
  role: AdminRole;
  accountStatus: string;
  createdAt: unknown;
}

async function findCurrentAdminEmployee(
  user: User,
  role: AdminRole
) {
  if (auth.currentUser?.uid !== user.uid) {
    throw new Error("Your signed-in account changed. Please reload and try again.");
  }

  const employeeQuery = query(
    collection(db, "adminEmployees"),
    where("uid", "==", user.uid)
  );
  const employeeSnapshot = await getDocs(employeeQuery);

  if (employeeSnapshot.size !== 1) {
    throw new Error(
      employeeSnapshot.empty
        ? "Your admin employee profile could not be found."
        : "More than one admin employee profile is linked to your account. Contact support."
    );
  }

  const employeeDocument = employeeSnapshot.docs[0];
  const data = employeeDocument.data();

  if (
    data.uid !== user.uid ||
    !isAdminRole(data.role) ||
    data.role !== role
  ) {
    throw new Error("Your admin profile could not be verified. Please sign in again.");
  }

  return {
    reference: employeeDocument.ref,
    profile: {
      name:
        typeof data.name === "string"
          ? data.name
          : user.displayName ?? "",
      email:
        user.email ??
        (typeof data.email === "string" ? data.email : ""),
      avatar:
        typeof data.avatar === "string"
          ? data.avatar
          : user.photoURL ?? "",
      role: data.role,
      accountStatus:
        typeof data.account_status === "string"
          ? data.account_status
          : "Not available",
      createdAt: data.created_at,
    } satisfies AdminAccountProfile,
  };
}

export async function getCurrentAdminProfile(
  user: User,
  role: AdminRole
): Promise<AdminAccountProfile> {
  const { profile } = await findCurrentAdminEmployee(user, role);
  return profile;
}

export async function saveCurrentAdminProfile(
  user: User,
  role: AdminRole,
  changes: Pick<AdminAccountProfile, "name" | "avatar">
): Promise<AdminAccountProfile> {
  const name = changes.name.trim();
  if (!name) {
    throw new Error("Enter your first and last name.");
  }

  const { reference, profile } = await findCurrentAdminEmployee(user, role);

  if (auth.currentUser?.uid !== user.uid) {
    throw new Error("Your signed-in account changed. Please reload and try again.");
  }

  await updateDoc(reference, {
    name,
    avatar: changes.avatar,
    updated_at: serverTimestamp(),
  });

  return {
    ...profile,
    name,
    avatar: changes.avatar,
  };
}
