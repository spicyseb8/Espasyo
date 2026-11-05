function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isManagedProject(project, projectId, ownerId) {
  return project.workflowType === "admin-managed" &&
    project.projectId === projectId &&
    project.ownerId === ownerId;
}

export function isClientAssignedToPublishedProject(project, assignment, projectId, ownerId) {
  return isManagedProject(project, projectId, ownerId) &&
    project.structuralStatus === "published" &&
    Number.isSafeInteger(project.publishedStructuralRevision) &&
    project.publishedStructuralRevision >= 1 &&
    assignment?.ownerId === ownerId &&
    assignment?.projectId === projectId;
}

export function isClientAccessibleManagedProjectFileKind(kind) {
  return [
    "structure",
    "interior",
    "version",
    "submitted",
    "approved",
    "submission",
  ].includes(kind);
}

function isPublishedStructurePath(path, ownerId, projectId) {
  return path === `projects/${ownerId}/${projectId}.json` ||
    new RegExp(
      `^projects/${escapeRegExp(ownerId)}/${escapeRegExp(projectId)}/published-r[1-9]\\d*-[0-9a-f-]+\\.json$`,
      "i",
    ).test(path);
}

function isDraftStructurePath(path, ownerId, projectId) {
  return new RegExp(
    `^projects/${escapeRegExp(ownerId)}/${escapeRegExp(projectId)}/draft-r[1-9]\\d*-[0-9a-f-]+\\.json$`,
    "i",
  ).test(path);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripManagedFileUrlFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const sanitized = { ...value };
  for (const field of [
    "jsonUrl",
    "draftJsonUrl",
    "interiorJsonUrl",
    "downloadUrl",
    "snapshotUrl",
    "submittedSnapshotUrl",
    "approvedSnapshotUrl",
  ]) {
    delete sanitized[field];
  }
  return sanitized;
}

function isValidVersionRecord(record, projectId, ownerId, versionId) {
  return record &&
    record.projectId === projectId &&
    record.ownerId === ownerId &&
    record.versionId === versionId &&
    record.snapshotType === "design";
}

function isValidSubmissionRecord(record, projectId, ownerId, submissionId) {
  return record &&
    record.projectId === projectId &&
    record.ownerId === ownerId &&
    record.submissionId === submissionId &&
    record.snapshotType === "submission";
}

export function resolveManagedProjectFilePath({
  project,
  projectId,
  ownerId,
  kind,
  fileId,
  versionRecord,
  submissionRecord,
}) {
  if (!isManagedProject(project, projectId, ownerId)) return null;

  if (kind === "structure" || kind === "editable-structure") {
    const publishedPath = typeof project.jsonPath === "string" ? project.jsonPath : "";
    const draftPath = typeof project.draftJsonPath === "string" ? project.draftJsonPath : "";
    if (kind === "editable-structure" && isDraftStructurePath(draftPath, ownerId, projectId)) {
      return draftPath;
    }
    if (project.structuralStatus !== "published") return null;
    return isPublishedStructurePath(publishedPath, ownerId, projectId)
      ? publishedPath
      : null;
  }

  if (kind === "interior") {
    const versionId = project.currentDesignVersionId;
    if (typeof versionId === "string" && isUuid(versionId) &&
      isValidVersionRecord(versionRecord, projectId, ownerId, versionId)) {
      return `projects/${ownerId}/${projectId}/versions/${versionId}.json`;
    }
    const legacyPath = `projects/${ownerId}/${projectId}.interior.json`;
    return project.interiorJsonPath === legacyPath ? legacyPath : null;
  }

  if (kind === "version" && isUuid(fileId) &&
    isValidVersionRecord(versionRecord, projectId, ownerId, fileId)) {
    return `projects/${ownerId}/${projectId}/versions/${fileId}.json`;
  }

  let submissionId;
  if (kind === "submitted") submissionId = project.submittedSubmissionId;
  else if (kind === "approved") submissionId = project.approvedSubmissionId;
  else if (kind === "submission" && isUuid(fileId)) submissionId = fileId;

  if (typeof submissionId === "string" && isUuid(submissionId) &&
    isValidSubmissionRecord(submissionRecord, projectId, ownerId, submissionId)) {
    if (kind === "approved" && project.projectStatus !== "approved") return null;
    if (
      kind === "submitted" &&
      !["submitted", "revision-requested", "approved"].includes(project.projectStatus)
    ) return null;
    return `projects/${ownerId}/${projectId}/submissions/${submissionId}.json`;
  }

  return null;
}
