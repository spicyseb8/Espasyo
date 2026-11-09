import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicGalleryItems,
  createPublicGalleryResponse,
  createPublicProjectSnapshot,
  hasApprovedConsentSnapshot,
  isPubliclyEligibleProject,
  isSafePublicThumbnailPath,
} from "./public-project-access.js";
import { isClientAssignedToPublishedProject } from "./managed-project-file-access.js";

const viewerUid = "viewer-uid";
const ownerUid = "other-owner-uid";
const publicId = "123e4567-e89b-42d3-a456-426614174000";
const projectId = "internal-project-id";

function eligibleProject(overrides = {}) {
  return {
    workflowType: "admin-managed",
    projectStatus: "approved",
    publicConsent: true,
    isPublic: true,
    publicId,
    ownerId: ownerUid,
    ...overrides,
  };
}

test("public preview eligibility rejects private, unconsented, and unapproved projects", () => {
  assert.equal(isPubliclyEligibleProject(eligibleProject({ isPublic: false }), viewerUid), false);
  assert.equal(isPubliclyEligibleProject(eligibleProject({ publicConsent: null }), viewerUid), false);
  assert.equal(isPubliclyEligibleProject(eligibleProject({ publicConsent: false }), viewerUid), false);
  const missingConsent = eligibleProject();
  delete missingConsent.publicConsent;
  assert.equal(isPubliclyEligibleProject(missingConsent, viewerUid), false);
  assert.equal(isPubliclyEligibleProject(eligibleProject({ projectStatus: "submitted" }), viewerUid), false);
  assert.equal(isPubliclyEligibleProject(eligibleProject({ projectStatus: "revision-requested" }), viewerUid), false);
  assert.equal(isPubliclyEligibleProject(eligibleProject({ ownerId: viewerUid }), viewerUid), false);
});

test("public gallery excludes the current user's projects and returns only safe listing fields", () => {
  const own = eligibleProject({ ownerId: viewerUid, publicId: "own-public-id" });
  const other = eligibleProject({
    publicNumber: 14,
    thumbnailPath: `projects/${ownerUid}/${projectId}.jpg`,
  });
  other.approvedSubmissionId = "submission-record-id";
  const items = createPublicGalleryItems([
    { projectId: "own-internal-id", data: own },
    { projectId, data: other },
  ], viewerUid);

  assert.deepEqual(items, [{
    projectId,
    ownerId: ownerUid,
    publicId,
    approvedSubmissionId: "submission-record-id",
    publicNumber: 14,
    title: "Design Inspiration #14",
    thumbnailPath: `projects/${ownerUid}/${projectId}.jpg`,
  }]);
  assert.equal(isSafePublicThumbnailPath(items[0].thumbnailPath, ownerUid, projectId), true);
  assert.equal(isSafePublicThumbnailPath("projects/someone-else/private.jpg", ownerUid, projectId), false);
  assert.deepEqual(
    createPublicGalleryResponse(items, new Map([[publicId, "/api/projects/public/example/thumbnail"]])),
    [{
      publicId,
      title: "Design Inspiration #14",
      thumbnailUrl: "/api/projects/public/example/thumbnail",
    }],
  );
});

test("generic public design titles use the stored number, not gallery position", () => {
  const projects = [
    { projectId: "first", data: eligibleProject({ publicNumber: 8, publicId: "first-id" }) },
    { projectId: "second", data: eligibleProject({ publicNumber: 23, publicId: "second-id" }) },
  ];
  assert.deepEqual(
    createPublicGalleryItems(projects, viewerUid).map(item => item.title),
    ["Design Inspiration #8", "Design Inspiration #23"],
  );
  assert.deepEqual(
    createPublicGalleryItems([projects[1]], viewerUid).map(item => item.title),
    ["Design Inspiration #23"],
  );
});

test("public gallery pagination defaults, caps limits, and accepts an opaque cursor", async () => {
  const { getPublicGalleryPageOptions } = await import("./public-project-access.js");
  assert.deepEqual(getPublicGalleryPageOptions({}), { limit: 12, cursor: null });
  assert.deepEqual(getPublicGalleryPageOptions({ limit: "100", cursor: publicId }), {
    limit: 30,
    cursor: publicId,
  });
  assert.throws(() => getPublicGalleryPageOptions({ limit: "0" }), /positive integer/);
  assert.throws(() => getPublicGalleryPageOptions({ limit: "1.5" }), /positive integer/);
  assert.throws(() => getPublicGalleryPageOptions({ cursor: "x".repeat(129) }), /cursor is invalid/);
});

test("public preview snapshot allowlists render data and strips private and internal fields", () => {
  const preview = createPublicProjectSnapshot({
    projectId,
    ownerId: ownerUid,
    projectName: "Private project title",
    estimatedCost: 750000,
    approvedBy: "admin-uid",
    wallHeight: 3,
    gridSize: { ownerEmail: "private@example.com" },
    walls: [{
      id: "wall-1",
      start: { id: "corner-1", position: { x: 0, y: 0, z: 0 }, ownerEmail: "private@example.com" },
      end: { id: "corner-2", position: { x: 4, y: 0, z: 0 } },
      ownerId: ownerUid,
    }],
    corners: [{ id: "corner-1", position: { x: 0, y: 0, z: 0 }, ownerId: ownerUid }],
    doors: [],
    windows: [],
    openings: [],
    floors: [{
      floorId: "floor-1",
      name: "Client's private floor name",
      structure: {
        walls: [{ id: "wall-1", start: { id: "c1", position: { x: 0, y: 0, z: 0 } }, end: { id: "c2", position: { x: 4, y: 0, z: 0 } }, ownerId: ownerUid }],
        corners: [],
        doors: [],
        windows: [],
        openings: [],
      },
    }],
  }, {
    projectId,
    ownerId: ownerUid,
    maximumBudget: 500000,
    costEstimate: { total: 99999 },
    furniture: [{
      id: "furniture-1",
      assetId: "public-catalog-asset",
      position: { x: 1, y: 0, z: 2 },
      rotationY: 0,
      modelOffset: { x: 0, y: 0, z: 0 },
      width: 1,
      depth: 1,
      height: 1,
      clientEmail: "private@example.com",
    }],
    floors: [{
      floorId: "floor-1",
      furniture: [{
        id: "floor-furniture",
        assetId: "public-catalog-asset",
        position: { x: 1, y: 0, z: 2 },
        rotationY: 0,
        modelOffset: { x: 0, y: 0, z: 0 },
        width: 1,
        depth: 1,
        height: 1,
        ownerId: ownerUid,
      }],
      floorFinishes: { "room-1": "floor-material" },
    }],
  }, "Design Inspiration #1");

  assert.equal(preview.projectName, "Design Inspiration #1");
  assert.equal(preview.wallHeight, 3);
  assert.equal(preview.gridSize, undefined);
  assert.equal(preview.walls[0].start.position.x, 0);
  assert.equal(preview.walls[0].ownerId, undefined);
  assert.equal(preview.walls[0].start.ownerEmail, undefined);
  assert.equal(preview.furniture[0].clientEmail, undefined);
  assert.equal(preview.floors[0].name, "Floor 1");
  assert.equal(preview.floors[0].furniture[0].ownerId, undefined);
  for (const key of [
    "projectId",
    "ownerId",
    "estimatedCost",
    "maximumBudget",
    "costEstimate",
    "approvedBy",
    "publicConsent",
    "isPublic",
    "publicId",
  ]) {
    assert.equal(Object.hasOwn(preview, key), false, `unexpected ${key} in public preview`);
  }
});

test("only the approved submission's explicit consent validates the public snapshot", () => {
  const project = {
    ...eligibleProject(),
    approvedSubmissionId: "submission-id",
  };
  const submission = {
    projectId,
    ownerId: ownerUid,
    submissionId: "submission-id",
    snapshotType: "submission",
    publicConsent: true,
  };
  assert.equal(hasApprovedConsentSnapshot(project, projectId, submission), true);
  assert.equal(hasApprovedConsentSnapshot(project, projectId, {
    ...submission,
    publicConsent: false,
  }), false);
  assert.equal(hasApprovedConsentSnapshot(project, projectId, {
    ...submission,
    submissionId: "different-submission",
  }), false);
});

test("public preview-only access is rejected by client save endpoint assignment checks", () => {
  const project = {
    projectId,
    ownerId: ownerUid,
    workflowType: "admin-managed",
    structuralStatus: "published",
    publishedStructuralRevision: 1,
    projectStatus: "approved",
    publicConsent: true,
    isPublic: true,
    publicId,
  };
  assert.equal(isClientAssignedToPublishedProject(
    project,
    { ownerId: viewerUid, projectId },
    projectId,
    viewerUid,
  ), false);
});

test("public preview-only access is rejected by client submit endpoint assignment checks", () => {
  const project = {
    projectId,
    ownerId: ownerUid,
    workflowType: "admin-managed",
    structuralStatus: "published",
    publishedStructuralRevision: 1,
    projectStatus: "approved",
    publicConsent: true,
    isPublic: true,
    publicId,
  };
  assert.equal(isClientAssignedToPublishedProject(
    project,
    { ownerId: viewerUid, projectId },
    projectId,
    viewerUid,
  ), false);
});
