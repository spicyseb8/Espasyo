import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { resolveUserProfileByAuthUid } from "../../../shared/auth/userProfileLookup.mjs";

import { db } from "./firebase";

interface UserProfile {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
}

export interface UserProfileRecord {
  id: string;
  [field: string]: unknown;
}

export async function createUserProfile(
  userId: string,
  profile: UserProfile
) {
  await setDoc(doc(db, "users", userId), {
    id: userId,
    full_name: profile.full_name,
    email: profile.email,
    phone_number: profile.phone_number,
    address: profile.address,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

export async function getUserProfileByAuthUid(
  userUid: string,
): Promise<UserProfileRecord | null> {
  const uid = userUid.trim();
  if (!uid) throw new Error("A signed-in user ID is required.");

  const matchingDocuments = await getDocsFromServer(
    query(collection(db, "users"), where("uid", "==", uid), limit(2)),
  );
  const matchingProfiles = matchingDocuments.docs.map(accountDocument => ({
    ...accountDocument.data(),
    id: accountDocument.id,
  }));
  const legacyDocument = matchingProfiles.length === 0
    ? await getDocFromServer(doc(db, "users", uid))
    : null;
  const legacyProfile = legacyDocument?.exists()
    ? { ...legacyDocument.data(), id: legacyDocument.id }
    : null;
  return resolveUserProfileByAuthUid(uid, matchingProfiles, legacyProfile);
}