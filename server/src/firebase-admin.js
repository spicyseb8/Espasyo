import {
  applicationDefault,
  cert,
  initializeApp,
} from "firebase-admin/app";

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

const projectId = process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ||
  "espasyo-6072d.firebasestorage.app";

let credential;
let serviceAccount;
try {
  const serviceAccountFile = await readFile(serviceAccountPath, "utf8");
  serviceAccount = JSON.parse(serviceAccountFile);
  credential = cert(serviceAccount);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  credential = applicationDefault();
}

const app = initializeApp({
  credential,
  ...((projectId || serviceAccount?.project_id)
    ? { projectId: projectId || serviceAccount.project_id }
    : {}),
  storageBucket,
});


export const adminAuth = getAuth(app);

export const adminDb = getFirestore(app);

export const adminStorage = getStorage(app).bucket();