import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  where,
} from "firebase/firestore";
import { resolveUserProfileByAuthUid } from "../../../shared/auth/userProfileLookup.mjs";

import { db } from "./firebase";

export interface UserProfileRecord {
  id: string;
  [field: string]: unknown;
}

export async function getUserProfileByAuthUid(
  userUid: string,
): Promise<UserProfileRecord | null> {
  const uid = userUid.trim();
  if (!uid) throw new Error("A signed-in user ID is required.");

  const directDocument = await getDocFromServer(doc(db, "users", uid));
  const directProfile = directDocument.exists()
    ? { ...directDocument.data(), id: directDocument.id }
    : null;
  if (directProfile) {
    return resolveUserProfileByAuthUid(uid, [], directProfile);
  }

  const matchingDocuments = await getDocsFromServer(
    query(collection(db, "users"), where("uid", "==", uid), limit(2)),
  );
  const matchingProfiles = matchingDocuments.docs.map(accountDocument => ({
    ...accountDocument.data(),
    id: accountDocument.id,
  }));
  return resolveUserProfileByAuthUid(uid, matchingProfiles, null);
}
