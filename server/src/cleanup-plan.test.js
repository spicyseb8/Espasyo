import assert from "node:assert/strict";
import test from "node:test";

import {
  isAccountIdCounter,
  isProtectedSuperadminDocument,
  isProjectUserStoragePath,
  parseResetOptions,
} from "./cleanup-plan.js";

test("reset requires an exact configured project ID, including in dry-run mode", () => {
  assert.throws(
    () => parseResetOptions([], "espasyo-test", "espasyo-test.appspot.com"),
    /--project-id/,
  );
  assert.throws(
    () => parseResetOptions(
      ["--project-id=other"],
      "espasyo-test",
      "espasyo-test.appspot.com",
    ),
    /does not match/,
  );
  assert.deepEqual(
    parseResetOptions(
      ["--project-id", "espasyo-test"],
      "espasyo-test",
      "espasyo-test.appspot.com",
    ),
    { projectId: "espasyo-test", execute: false },
  );
});

test("live reset requires the exact project ID as an explicit confirmation", () => {
  assert.throws(
    () => parseResetOptions(
      ["--project-id=espasyo-test", "--execute"],
      "espasyo-test",
      "espasyo-test.appspot.com",
    ),
    /exact project ID and storage bucket/,
  );
  assert.throws(
    () => parseResetOptions([
      "--project-id=espasyo-test",
      "--execute",
      "--confirm-project-id=other",
      "--confirm-storage-bucket=espasyo-test.appspot.com",
    ], "espasyo-test", "espasyo-test.appspot.com"),
    /exact project ID and storage bucket/,
  );
  assert.throws(
    () => parseResetOptions([
      "--project-id=espasyo-test",
      "--execute",
      "--confirm-project-id=espasyo-test",
      "--confirm-storage-bucket=other.appspot.com",
    ], "espasyo-test", "espasyo-test.appspot.com"),
    /exact project ID and storage bucket/,
  );
  assert.deepEqual(
    parseResetOptions([
      "--project-id=espasyo-test",
      "--execute",
      "--confirm-project-id=espasyo-test",
      "--confirm-storage-bucket=espasyo-test.appspot.com",
    ], "espasyo-test", "espasyo-test.appspot.com"),
    { projectId: "espasyo-test", execute: true },
  );
});

test("only the verified superadmin employee and matching user profile are protected", () => {
  const superadmin = { uid: "root-uid", documentId: "root-profile" };
  assert.equal(
    isProtectedSuperadminDocument("adminEmployees", "root-profile", {
      uid: "root-uid",
      role: "superadmin",
    }, superadmin),
    true,
  );
  assert.equal(
    isProtectedSuperadminDocument("users", "client-profile", {
      uid: "root-uid",
    }, superadmin),
    true,
  );
  assert.equal(
    isProtectedSuperadminDocument("adminEmployees", "other-profile", {
      uid: "other-uid",
      role: "superadmin",
    }, superadmin),
    false,
  );
});

test("storage cleanup is restricted to project and user-owned prefixes", () => {
  assert.equal(isProjectUserStoragePath("projects/client/project.json"), true);
  assert.equal(
    isProjectUserStoragePath("adminManagedFloorPlanDrafts/admin/draft/data.json"),
    true,
  );
  assert.equal(isProjectUserStoragePath("users/client/profile/avatar"), true);
  assert.equal(isProjectUserStoragePath("assets/furniture/doors/model.glb"), false);
  assert.equal(isProjectUserStoragePath("unrelated/data.json"), false);
});

test("account counters can be cleared without deleting asset counters", () => {
  assert.equal(isAccountIdCounter("account-U-26"), true);
  assert.equal(isAccountIdCounter("asset-furniture-26"), false);
});
