import assert from "node:assert/strict";
import test from "node:test";

import {
  canClientEditProject,
  canContinueAdminStructureSave,
  canTransitionProject,
  getClientEditLockReason,
  getPublicConsentFields,
  getPublicVisibilityUpdate,
  getProjectStatus,
  getProjectReviewVisibilityUpdate,
  isFutureProjectDeadline,
  isCurrentProjectAcknowledgement,
  isProjectDeadlineExpired,
} from "./project-workflow.js";

test("legacy managed projects map to available or ongoing without migration", () => {
  assert.equal(getProjectStatus({ structuralStatus: "published" }), "available");
  assert.equal(getProjectStatus({ clientDesignStarted: true }), "ongoing");
  assert.equal(getProjectStatus({ interiorJsonPath: "legacy.json" }), "ongoing");
  assert.equal(getProjectStatus({ projectStatus: "revision-requested" }), "revision-requested");
});

test("deadline validation supports legacy dates and Philippine local date-times", () => {
  assert.equal(isFutureProjectDeadline("2026-11-05", "2026-11-04"), true);
  assert.equal(isFutureProjectDeadline("2026-11-05T14:30", "2026-11-04"), true);
  assert.equal(isFutureProjectDeadline("2026-11-04", "2026-11-04"), false);
  assert.equal(isFutureProjectDeadline("2026-11-04T23:59", "2026-11-04"), false);
  assert.equal(isFutureProjectDeadline("2026-02-30", "2026-02-01"), false);
  assert.equal(isFutureProjectDeadline("2026-11-05T25:30", "2026-11-04"), false);
  assert.equal(isProjectDeadlineExpired("2026-11-03", "2026-11-04"), true);
  assert.equal(isProjectDeadlineExpired("2026-11-04", "2026-11-04"), false);
  assert.equal(isProjectDeadlineExpired("2026-11-04T14:00", "2026-11-04T13:59"), false);
  assert.equal(isProjectDeadlineExpired("2026-11-04T14:00", "2026-11-04T14:00"), true);
});

test("client edit lock checks time-specific deadline in Philippine local time", () => {
  const project = {
    projectStatus: "ongoing",
    deadline: "2026-11-04T14:00",
  };
  assert.equal(getClientEditLockReason(project, "2026-11-04T13:59"), null);
  assert.match(
    getClientEditLockReason(project, "2026-11-04T14:00"),
    /deadline has passed/,
  );
});

test("client editability blocks submitted, approved, and overdue projects", () => {
  assert.equal(canClientEditProject({ projectStatus: "available", deadline: "2026-11-05" }, "2026-11-04"), true);
  assert.equal(canClientEditProject({ projectStatus: "submitted", deadline: "2026-11-05" }, "2026-11-04"), false);
  assert.equal(canClientEditProject({ projectStatus: "approved", deadline: "2026-11-05" }, "2026-11-04"), false);
  assert.equal(canClientEditProject({ projectStatus: "revision-requested", deadline: "2026-11-03" }, "2026-11-04"), false);
  assert.equal(canClientEditProject({ projectStatus: "available" }, "2026-11-04"), false);
  assert.match(
    getClientEditLockReason({ projectStatus: "available" }, "2026-11-04"),
    /valid deadline/
  );
});

test("review transitions are restricted to submitted projects", () => {
  assert.equal(canTransitionProject("submitted", "approve"), true);
  assert.equal(canTransitionProject("submitted", "request-revision"), true);
  assert.equal(canTransitionProject("ongoing", "approve"), false);
  assert.equal(canTransitionProject("approved", "request-revision"), false);
});

test("public consent fields require explicit boolean consent and server timestamp", () => {
  const serverTimestamp = { serverTimestamp: true };
  assert.deepEqual(getPublicConsentFields(true, serverTimestamp), {
    publicConsent: true,
    publicConsentAt: serverTimestamp,
  });
  assert.deepEqual(getPublicConsentFields(false, serverTimestamp), {
    publicConsent: false,
    publicConsentAt: null,
  });
  assert.throws(() => getPublicConsentFields(true, null), /server timestamp/);
  assert.throws(() => getPublicConsentFields(undefined, null), /true or false/);
});

test("public visibility can only be enabled for approved projects with client consent", () => {
  assert.equal(getPublicVisibilityUpdate({
    projectStatus: "approved",
    publicConsent: false,
  }, true, "opaque-id"), null);
  assert.equal(getPublicVisibilityUpdate({
    projectStatus: "approved",
    publicConsent: null,
  }, true, "opaque-id"), null);
  assert.equal(getPublicVisibilityUpdate({
    projectStatus: "approved",
  }, true, "opaque-id"), null);
  assert.equal(getPublicVisibilityUpdate({
    projectStatus: "submitted",
    publicConsent: true,
  }, true, "opaque-id"), null);
  assert.deepEqual(getPublicVisibilityUpdate({
    projectStatus: "approved",
    publicConsent: true,
  }, true, "opaque-id", 1), {
    isPublic: true,
    publicId: "opaque-id",
    publicNumber: 1,
  });
});

test("public visibility can always be disabled and keeps an existing opaque identifier", () => {
  assert.deepEqual(getPublicVisibilityUpdate({
    projectStatus: "submitted",
    publicConsent: false,
    publicId: "existing-opaque-id",
  }, false, "new-id"), { isPublic: false });
  assert.deepEqual(getPublicVisibilityUpdate({
    projectStatus: "approved",
    publicConsent: true,
    publicId: "existing-opaque-id",
    publicNumber: 17,
  }, true, "new-id"), {
    isPublic: true,
    publicId: "existing-opaque-id",
    publicNumber: 17,
  });
});

test("approval and revision review transitions always force projects private", () => {
  assert.deepEqual(getProjectReviewVisibilityUpdate("approve"), { isPublic: false });
  assert.deepEqual(getProjectReviewVisibilityUpdate("request-revision"), { isPublic: false });
});

test("admin structure saves reject lifecycle changes that happen during upload", () => {
  assert.equal(
    canContinueAdminStructureSave(
      { projectStatus: "ongoing" },
      { projectStatus: "submitted" },
    ),
    false,
  );
  assert.equal(
    canContinueAdminStructureSave(
      { projectStatus: "submitted" },
      { projectStatus: "submitted" },
    ),
    false,
  );
  assert.equal(
    canContinueAdminStructureSave(
      { projectStatus: "ongoing" },
      { projectStatus: "ongoing" },
    ),
    true,
  );
});

test("acknowledgements require the exact project, user, agreement type, and version", () => {
  const acknowledgement = {
    projectId: "PRJ-00126",
    userId: "client-1",
    agreementType: "project-submission",
    agreementVersion: "2026-01",
    accepted: true,
  };
  assert.equal(isCurrentProjectAcknowledgement(
    acknowledgement,
    "PRJ-00126",
    "client-1",
    "project-submission",
    "2026-01",
  ), true);
  assert.equal(isCurrentProjectAcknowledgement(
    acknowledgement,
    "PRJ-00126",
    "client-2",
    "project-submission",
    "2026-01",
  ), false);
  assert.equal(isCurrentProjectAcknowledgement(
    acknowledgement,
    "PRJ-00126",
    "client-1",
    "project-submission",
    "2027-01",
  ), false);
});
