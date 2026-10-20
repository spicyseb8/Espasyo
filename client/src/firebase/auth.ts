import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth, ensureSessionAuthPersistence } from "./firebase";

export async function register(email: string, password: string) {
  await ensureSessionAuthPersistence();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email: string, password: string) {
  await ensureSessionAuthPersistence();
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth).then(() => {
    localStorage.removeItem("espasyo_current_user_uid");
  });
}