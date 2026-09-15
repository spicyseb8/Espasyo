import { initializeApp, cert } from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";

import { getFirestore } from "firebase-admin/firestore";

import { getStorage } from "firebase-admin/storage";

import { readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";


const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


const serviceAccountPath = path.join(
  __dirname,
  "..",
  "serviceAccountKey.json"
);


const serviceAccountFile = await readFile(
  serviceAccountPath,
  "utf8"
);

const serviceAccount = JSON.parse(serviceAccountFile);


const app = initializeApp({
  credential: cert(serviceAccount),
});


export const adminAuth = getAuth(app);

export const adminDb = getFirestore(app);

export const adminStorage = getStorage(app).bucket(
  "espasyo-6072d.firebasestorage.app"
);