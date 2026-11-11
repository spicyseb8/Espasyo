import {
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase";

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function resendVerificationEmail(
  email: string,
  password: string,
): Promise<boolean> {
  const { user } = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  try {
    await reload(user);
    if (user.emailVerified) return true;
    await sendEmailVerification(user);
    return false;
  } finally {
    if (auth.currentUser?.uid === user.uid) {
      await signOut(auth);
    }
  }
}

export function logout() {
  return signOut(auth);
}