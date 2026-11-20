export const RESET_STORAGE_PREFIXES = Object.freeze([
  "projects/",
  "adminManagedFloorPlanDrafts/",
  "users/",
]);

function optionValue(args, name) {
  const inlineValue = args.find(argument => argument.startsWith(`${name}=`));
  if (inlineValue) return inlineValue.slice(name.length + 1).trim();

  const optionIndex = args.indexOf(name);
  const value = optionIndex >= 0 ? args[optionIndex + 1] : "";
  return value && !value.startsWith("--") ? value.trim() : "";
}

export function parseResetOptions(
  args,
  configuredProjectId,
  configuredStorageBucket,
) {
  const projectId = optionValue(args, "--project-id");
  const confirmedProjectId = optionValue(args, "--confirm-project-id");
  const confirmedStorageBucket = optionValue(args, "--confirm-storage-bucket");
  const execute = args.includes("--execute");

  if (!projectId) {
    throw new Error("Provide the Firebase target with --project-id <id>.");
  }
  if (!configuredProjectId || projectId !== configuredProjectId) {
    throw new Error(
      "The requested project ID does not match the Firebase Admin SDK configuration.",
    );
  }
  if (!configuredStorageBucket) {
    throw new Error("The Firebase Storage bucket is not configured.");
  }
  if (
    execute &&
    (confirmedProjectId !== projectId ||
      confirmedStorageBucket !== configuredStorageBucket)
  ) {
    throw new Error(
      "Live reset requires the exact project ID and storage bucket as explicit confirmations.",
    );
  }
  if (!execute && (confirmedProjectId || confirmedStorageBucket)) {
    throw new Error("Confirmations are only valid together with --execute.");
  }

  return { projectId, execute };
}

export function isProtectedSuperadminDocument(
  collectionName,
  documentId,
  data,
  superadmin,
) {
  if (!superadmin?.uid || !data || typeof data !== "object") return false;
  if (collectionName === "users") return data.uid === superadmin.uid;
  return collectionName === "adminEmployees" &&
    documentId === superadmin.documentId &&
    data.uid === superadmin.uid &&
    data.role === "superadmin";
}

export function isProjectUserStoragePath(path) {
  return RESET_STORAGE_PREFIXES.some(prefix => path.startsWith(prefix));
}

export function isAccountIdCounter(documentId) {
  return documentId.startsWith("account-");
}
