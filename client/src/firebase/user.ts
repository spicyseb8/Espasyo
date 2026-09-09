import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

interface UserProfile {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
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