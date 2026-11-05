import assert from "node:assert/strict";
import test from "node:test";

import { createAccountRecord } from "./account-creation.js";

function createHarness({ firestoreError, existingEmail } = {}) {
  const records = new Map([
    ["users", new Map()],
    ["adminEmployees", new Map()],
  ]);
  const authUsers = new Map();
  let nextUid = 1;
  const adminDb = {
    collection(name) {
      const documents = records.get(name);
      return {
        async get() {
          return {
            docs: [...documents.entries()].map(([id, value]) => ({
              id,
              data: () => value,
            })),
          };
        },
        doc(id) {
          return {
            async create(value) {
              if (firestoreError) throw firestoreError;
              if (documents.has(id)) {
                const error = new Error("already exists");
                error.code = "already-exists";
                throw error;
              }
              documents.set(id, value);
            },
          };
        },
      };
    },
  };
  const adminAuth = {
    async getUserByEmail(email) {
      if (existingEmail === email || [...authUsers.values()].some(user => user.email === email)) {
        return { uid: "existing" };
      }
      const error = new Error("not found");
      error.code = "auth/user-not-found";
      throw error;
    },
    async createUser({ email, password, displayName }) {
      if ([...authUsers.values()].some(user => user.email === email)) {
        const error = new Error("duplicate");
        error.code = "auth/email-already-exists";
        throw error;
      }
      const uid = `uid-${nextUid++}`;
      authUsers.set(uid, { uid, email, password, displayName, emailVerified: false });
      return { uid };
    },
    async deleteUser(uid) {
      authUsers.delete(uid);
    },
  };
  const createId = async () => "U-26001";
  return {
    dependencies: { adminAuth, adminDb, createId },
    records,
    authUsers,
  };
}

const clientInput = {
  accountType: "user",
  name: "Client One",
  email: "Client@Example.com",
  password: "password1",
  phoneNumber: "09123456789",
  address: "Manila",
};

test("creates a client Auth account and compatible Firestore user record", async () => {
  const harness = createHarness();
  const account = await createAccountRecord(clientInput, harness.dependencies);
  const user = harness.records.get("users").get("U-26001");
  assert.equal(account.accountType, "user");
  assert.equal(account.email, "client@example.com");
  assert.equal(user.uid, account.uid);
  assert.equal(user.full_name, "Client One");
  assert.equal(user.account_status, "active");
  assert.equal(harness.authUsers.get(account.uid).emailVerified, false);
  assert.equal(harness.authUsers.size, 1);
});

test("creates an employee account with its requested role and employee fields", async () => {
  const harness = createHarness();
  const account = await createAccountRecord({
    ...clientInput,
    accountType: "employee",
    role: "admin",
  }, harness.dependencies);
  const employee = harness.records.get("adminEmployees").get("U-26001");
  assert.equal(account.accountType, "employee");
  assert.equal(employee.role, "admin");
  assert.equal(employee.name, "Client One");
  assert.equal(employee.account_status, "active");
});

test("rejects duplicate email addresses recorded in Firestore", async () => {
  const harness = createHarness();
  harness.records.get("users").set("legacy-account", {
    email: " CLIENT@example.com ",
  });
  await assert.rejects(
    createAccountRecord(clientInput, harness.dependencies),
    { status: 409 },
  );
  assert.equal(harness.authUsers.size, 0);
});

test("rejects duplicate Firebase Authentication email addresses", async () => {
  const harness = createHarness({ existingEmail: "client@example.com" });
  await assert.rejects(
    createAccountRecord(clientInput, harness.dependencies),
    { status: 409 },
  );
  assert.equal(harness.authUsers.size, 0);
});

test("rolls back the new Auth account when the Firestore write fails", async () => {
  const harness = createHarness({ firestoreError: new Error("Firestore unavailable") });
  await assert.rejects(
    createAccountRecord(clientInput, harness.dependencies),
    /Firestore unavailable/,
  );
  assert.equal(harness.authUsers.size, 0);
  assert.equal(harness.records.get("users").size, 0);
});

test("rejects invalid form data and employee roles", async () => {
  const harness = createHarness();
  await assert.rejects(
    createAccountRecord({ ...clientInput, email: "not-an-email" }, harness.dependencies),
    { status: 400 },
  );
  await assert.rejects(
    createAccountRecord({ ...clientInput, accountType: "employee", role: "user" }, harness.dependencies),
    { status: 400 },
  );
  assert.equal(harness.authUsers.size, 0);
});
