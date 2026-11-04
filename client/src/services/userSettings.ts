import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

export async function saveUserProfile(
  userId: string,
  profile: {
    fullName: string;
    email: string;
    photoUrl: string | null;
  }
): Promise<void> {
  await setDoc(
    doc(db, "users", userId),
    {
      full_name: profile.fullName,
      email: profile.email,
      ...(profile.photoUrl ? { photo_url: profile.photoUrl } : {}),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
}
