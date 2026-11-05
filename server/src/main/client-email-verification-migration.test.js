import assert from "node:assert/strict";
import test from "node:test";

import { migrateClientEmailVerification } from "./client-email-verification-migration.js";

function createHarness({
  userRecords = [],
  employeeRecords = [],
  authUsers = [],
} = {}) {
  const profiles = new Map(
    userRecords.map(([id, data]) => [id, structuredClone(data)])
  );
  const employees = new Map(employeeRecords);
  const accounts = new Map(authUsers.map(user => [user.uid, { ...user }]));
  const updates = [];

  function collection(records) {
    return {
      async get() {
        return {
          size: records.size,
          docs: [...records.entries()].map(([id, data]) => ({
            id,
            ref: {
              async get() {
                return {
                  exists: records.has(id),
                  data: () => records.get(id),
                };
              },
            },
            data: () => data,
          })),
        };
      },
    };
  }

  const adminDb = {
    collection(name) {
      return collection(name === "users" ? profiles : employees);
    },
  };
  const adminAuth = {
    async getUser(uid) {
      const user = accounts.get(uid);
      if (!user) {
        const error = new Error("User not found");
        error.code = "auth/user-not-found";
        throw error;
      }
      return { ...user };
    },
    async updateUser(uid, changes) {
      updates.push(uid);
      Object.assign(accounts.get(uid), changes);
      return { ...accounts.get(uid) };
    },
  };

  return {
    adminAuth,
    adminDb,
    accounts,
    updates,
  };
}

function clientProfile(id, uid, email = `${uid}@example.com`) {
  return [
    id,
    {
      id,
      uid,
      email,
      full_name: "Client Name",
      account_status: "active",
      phone_number: "09123456789",
    },
  ];
}

test("dry run identifies only verified client identities and changes no Auth users", async () => {
  const missingAuthProfile = clientProfile("U-26003", "missing-auth");
  const harness = createHarness({
    userRecords: [
      clientProfile("U-26001", "client-uid"),
      clientProfile("U-26002", "mismatched-uid", "other@example.com"),
      missingAuthProfile,
    ],
    employeeRecords: [
      ["A-26001", { id: "A-26001", uid: "employee-uid", role: "admin" }],
    ],
    authUsers: [
      {
        uid: "client-uid",
        email: "client-uid@example.com",
        emailVerified: false,
      },
      {
        uid: "mismatched-uid",
        email: "mismatched-uid@example.com",
        emailVerified: false,
      },
      {
        uid: "employee-uid",
        email: "employee-uid@example.com",
        emailVerified: false,
      },
    ],
  });

  const result = await migrateClientEmailVerification(harness);

  assert.deepEqual(result, {
    inspected: 3,
    eligible: 1,
    alreadyVerified: 0,
    migrated: 0,
    skipped: 2,
  });
  assert.deepEqual(harness.updates, []);
  assert.equal(harness.accounts.get("client-uid").emailVerified, false);
  assert.equal(harness.accounts.get("employee-uid").emailVerified, false);
});

test("apply verifies matching client accounts and preserves inactive status", async () => {
  const inactive = clientProfile("U-26001", "inactive-client");
  inactive[1].account_status = "suspended";
  const harness = createHarness({
    userRecords: [inactive],
    authUsers: [{
      uid: "inactive-client",
      email: "inactive-client@example.com",
      emailVerified: false,
      disabled: true,
    }],
  });

  const result = await migrateClientEmailVerification({
    ...harness,
    apply: true,
  });

  assert.deepEqual(result, {
    inspected: 1,
    eligible: 1,
    alreadyVerified: 0,
    migrated: 1,
    skipped: 0,
  });
  assert.deepEqual(harness.updates, ["inactive-client"]);
  assert.equal(harness.accounts.get("inactive-client").emailVerified, true);
  assert.equal(harness.accounts.get("inactive-client").disabled, true);

  const secondRun = await migrateClientEmailVerification({
    ...harness,
    apply: true,
  });
  assert.equal(secondRun.eligible, 0);
  assert.equal(secondRun.alreadyVerified, 1);
  assert.equal(secondRun.migrated, 0);
  assert.deepEqual(harness.updates, ["inactive-client"]);
});

test("does not verify records without generated client IDs or with employee roles", async () => {
  const roleProfile = clientProfile("U-26001", "role-account");
  roleProfile[1].role = "admin";
  const harness = createHarness({
    userRecords: [
      ["legacy-uid-document", clientProfile("legacy-uid-document", "legacy-uid")[1]],
      roleProfile,
    ],
    authUsers: [
      {
        uid: "legacy-uid",
        email: "legacy-uid@example.com",
        emailVerified: false,
      },
      {
        uid: "role-account",
        email: "role-account@example.com",
        emailVerified: false,
      },
    ],
  });

  const result = await migrateClientEmailVerification({
    ...harness,
    apply: true,
  });

  assert.equal(result.eligible, 0);
  assert.equal(result.migrated, 0);
  assert.deepEqual(harness.updates, []);
});
