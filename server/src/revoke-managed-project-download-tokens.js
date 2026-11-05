import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "./firebase-admin.js";

const apply = process.argv.includes("--apply");
const MANAGED_PROJECTS = "projects";
const managedProjectSnapshots = await adminDb.collection(MANAGED_PROJECTS)
  .where("workflowType", "==", "admin-managed")
  .get();
const draftSnapshots = await adminDb.collection("adminManagedFloorPlanDrafts").get();
const projectIds = new Set(managedProjectSnapshots.docs.map(document => document.id));
const objectPaths = new Set();
const projectDocumentRefs = managedProjectSnapshots.docs.map(document => document.ref);
const draftDocumentRefs = draftSnapshots.docs.map(document => document.ref);

for (const document of managedProjectSnapshots.docs) {
  const project = document.data();
  const ownerId = typeof project.ownerId === "string" ? project.ownerId : "";
  if (!ownerId) continue;
  for (const exactPath of [
    `projects/${ownerId}/${document.id}.json`,
    `projects/${ownerId}/${document.id}.interior.json`,
  ]) {
    objectPaths.add(exactPath);
  }
  const prefix = `projects/${ownerId}/${document.id}/`;
  const [files] = await adminStorage.getFiles({ prefix });
  for (const file of files) {
    if (file.name.startsWith(prefix) && file.name.endsWith(".json")) {
      objectPaths.add(file.name);
    }
  }
}

for (const document of draftSnapshots.docs) {
  const draft = document.data();
  if (typeof draft.createdBy !== "string" || !draft.createdBy) continue;
  const prefix = `adminManagedFloorPlanDrafts/${draft.createdBy}/${document.id}/`;
  const [files] = await adminStorage.getFiles({ prefix });
  for (const file of files) {
    if (file.name.startsWith(prefix) && file.name.endsWith(".json")) {
      objectPaths.add(file.name);
    }
  }
}

const filesWithTokens = [];
for (const path of objectPaths) {
  const file = adminStorage.file(path);
  const [exists] = await file.exists();
  if (!exists) continue;
  const [metadata] = await file.getMetadata();
  if (metadata.metadata?.firebaseStorageDownloadTokens) {
    filesWithTokens.push(file);
  }
}

console.log(`Managed-project JSON objects with download tokens: ${filesWithTokens.length}`);
console.log(`Managed project records to sanitize: ${projectDocumentRefs.length}`);
console.log(`Managed draft records to sanitize: ${draftDocumentRefs.length}`);
if (!apply) {
  console.log("Dry run only. Re-run with --apply to revoke these tokens and remove URL metadata.");
  process.exit(0);
}

for (const file of filesWithTokens) {
  await file.setMetadata({
    metadata: {
      firebaseStorageDownloadTokens: null,
    },
  });
}

const versionRefsByProject = await Promise.all([...projectIds].map(async projectId => {
  const snapshot = await adminDb.collection("projectVersions")
    .where("projectId", "==", projectId)
    .get();
  return snapshot.docs.map(document => document.ref);
}));
const submissionRefsByProject = await Promise.all([...projectIds].map(async projectId => {
  const snapshot = await adminDb.collection("projectSubmissions")
    .where("projectId", "==", projectId)
    .get();
  return snapshot.docs.map(document => document.ref);
}));

const refsAndFields = [
  ...projectDocumentRefs.map(ref => ({
    ref,
    fields: [
      "jsonUrl",
      "draftJsonUrl",
      "interiorJsonUrl",
      "submittedSnapshotUrl",
      "approvedSnapshotUrl",
    ],
  })),
  ...draftDocumentRefs.map(ref => ({ ref, fields: ["draftJsonUrl"] })),
  ...versionRefsByProject.flat().map(ref => ({ ref, fields: ["downloadUrl"] })),
  ...submissionRefsByProject.flat().map(ref => ({ ref, fields: ["snapshotUrl"] })),
];

for (let offset = 0; offset < refsAndFields.length; offset += 450) {
  const batch = adminDb.batch();
  for (const item of refsAndFields.slice(offset, offset + 450)) {
    batch.update(item.ref, Object.fromEntries(
      item.fields.map(field => [field, FieldValue.delete()])
    ));
  }
  await batch.commit();
}

console.log("Managed-project download tokens revoked and URL metadata removed.");
