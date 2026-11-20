import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { projectApi } from "./projectApi";

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
  try {
    await projectApi("/client/profile-updated", { method: "POST" });
  } catch (error) {
    console.error("Profile was saved, but its activity could not be recorded:", error);
    throw error;
  }
}
