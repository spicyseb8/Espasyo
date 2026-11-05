import assert from "node:assert/strict";
import test from "node:test";

import {
  isClientAccessibleManagedProjectFileKind,
  isClientAssignedToPublishedProject,
  resolveManagedProjectFilePath,
  stripManagedFileUrlFields,
} from "./managed-project-file-access.js";

const ownerId = "client-uid";
const projectId = "PRJ-00126";
const versionId = "123e4567-e89b-42d3-a456-426614174000";
const submissionId = "123e4567-e89b-42d3-a456-426614174001";
const project = {
  projectId,
  ownerId,
  workflowType: "admin-managed",
  structuralStatus: "published",
  publishedStructuralRevision: 2,
  projectStatus: "submitted",
  jsonPath: `projects/${ownerId}/${projectId}/published-r2-a1b2c3.json`,
  draftJsonPath: `projects/${ownerId}/${projectId}/draft-r3-a1b2c3.json`,
  currentDesignVersionId: versionId,
  interiorJsonPath: `projects/${ownerId}/${projectId}/versions/${versionId}.json`,
  submittedSubmissionId: submissionId,
  approvedSubmissionId: submissionId,
};
const versionRecord = {
  projectId,
  ownerId,
  versionId,
  snapshotType: "design",
};
const submissionRecord = {
  projectId,
  ownerId,
  submissionId,
  snapshotType: "submission",
};

test("resolves only the project's published and editable structures", () => {
  const context = { project, projectId, ownerId };
  assert.equal(
    resolveManagedProjectFilePath({ ...context, kind: "structure" }),
    project.jsonPath,
  );
  assert.equal(
    resolveManagedProjectFilePath({ ...context, kind: "editable-structure" }),
    project.draftJsonPath,
  );
  assert.equal(
    resolveManagedProjectFilePath({
      ...context,
      kind: "structure",
      project: { ...project, jsonPath: "projects/other/secret.json" },
    }),
    null,
  );
});

test("requires matching version metadata and ignores supplied storage paths", () => {
  const context = { project, projectId, ownerId };
  assert.equal(
    resolveManagedProjectFilePath({
      ...context,
      kind: "version",
      fileId: versionId,
      versionRecord,
    }),
    `projects/${ownerId}/${projectId}/versions/${versionId}.json`,
  );
  assert.equal(
    resolveManagedProjectFilePath({
      ...context,
      kind: "version",
      fileId: versionId,
      versionRecord: { ...versionRecord, ownerId: "another-client" },
    }),
    null,
  );
  assert.equal(
    resolveManagedProjectFilePath({
      ...context,
      kind: "version",
      fileId: "../../secret",
      versionRecord,
    }),
    null,
  );
});

test("submission snapshots require matching records and valid lifecycle state", () => {
  const context = { project, projectId, ownerId, submissionRecord };
  assert.equal(
    resolveManagedProjectFilePath({ ...context, kind: "submitted" }),
    `projects/${ownerId}/${projectId}/submissions/${submissionId}.json`,
  );
  assert.equal(
    resolveManagedProjectFilePath({ ...context, kind: "approved" }),
    null,
  );
  assert.equal(
    resolveManagedProjectFilePath({
      ...context,
      kind: "approved",
      project: { ...project, projectStatus: "approved" },
    }),
    `projects/${ownerId}/${projectId}/submissions/${submissionId}.json`,
  );
  assert.equal(
    resolveManagedProjectFilePath({
      ...context,
      kind: "submission",
      fileId: submissionId,
      submissionRecord: { ...submissionRecord, projectId: "other-project" },
    }),
    null,
  );
});

test("rejects mismatched project owners and preserves fixed legacy paths", () => {
  assert.equal(
    resolveManagedProjectFilePath({
      project,
      projectId,
      ownerId: "another-client",
      kind: "structure",
    }),
    null,
  );
  assert.equal(
    resolveManagedProjectFilePath({
      project: {
        projectId,
        ownerId,
        workflowType: "admin-managed",
        interiorJsonPath: `projects/${ownerId}/${projectId}.interior.json`,
      },
      projectId,
      ownerId,
      kind: "interior",
    }),
    `projects/${ownerId}/${projectId}.interior.json`,
  );
});

test("client file authorization requires the exact published owner assignment", () => {
  const assignment = { ownerId, projectId };
  assert.equal(isClientAssignedToPublishedProject(project, assignment, projectId, ownerId), true);
  assert.equal(isClientAssignedToPublishedProject(
    project,
    { ...assignment, ownerId: "another-client" },
    projectId,
    ownerId,
  ), false);
  assert.equal(isClientAssignedToPublishedProject(
    { ...project, structuralStatus: "draft" },
    assignment,
    projectId,
    ownerId,
  ), false);
  assert.equal(isClientAssignedToPublishedProject(
    project,
    assignment,
    projectId,
    "another-client",
  ), false);
});

test("clients cannot load unpublished editable floor-plan drafts", () => {
  assert.equal(isClientAccessibleManagedProjectFileKind("structure"), true);
  assert.equal(isClientAccessibleManagedProjectFileKind("editable-structure"), false);
});

test("sanitizes reusable project and file download URLs from managed JSON", () => {
  const original = {
    projectId,
    jsonUrl: "https://storage.example/file?token=private",
    interiorJsonUrl: "https://storage.example/interior?token=private",
    submittedSnapshotUrl: "https://storage.example/submission?token=private",
    downloadUrl: "https://storage.example/version?token=private",
    projectName: "Plan",
  };
  const sanitized = stripManagedFileUrlFields(original);
  assert.deepEqual(sanitized, {
    projectId,
    projectName: "Plan",
  });
  assert.equal(original.jsonUrl.includes("token="), true);
});
