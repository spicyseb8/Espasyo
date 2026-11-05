import assert from "node:assert/strict";
import test from "node:test";

import { findClientAccountByIdentifier } from "./client-account.js";

function createDb(seed = {}) {
  const collections = new Map(
    Object.entries(seed).map(([name, records]) => [name, new Map(Object.entries(records))]),
  );
  return {
    collection(name) {
      const records = collections.get(name) ?? new Map();
      return {
        doc(id) {
          return {
            id,
            async get() {
              const data = records.get(id);
              return {
                id,
                exists: data !== undefined,
                data: () => data,
              };
            },
          };
        },
        where(field, _operator, value) {
          return {
            limit() {
              return {
                async get() {
                  const match = [...records.entries()].find(([, data]) => data[field] === value);
                  return {
                    docs: match
                      ? [{ id: match[0], data: () => match[1] }]
                      : [],
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("created account is resolved by Auth UID and account document ID", async () => {
  const db = createDb({
    users: {
      "U-26001": {
        id: "U-26001",
        uid: "firebase-uid-1",
        account_status: "active",
        full_name: "New Client",
      },
    },
  });

  const byUid = await findClientAccountByIdentifier(db, "firebase-uid-1");
  const byAccountId = await findClientAccountByIdentifier(db, "U-26001");
  assert.equal(byUid.id, "U-26001");
  assert.equal(byUid.uid, "firebase-uid-1");
  assert.equal(byAccountId.id, byUid.id);
  assert.equal(byAccountId.uid, byUid.uid);
});

test("legacy user document IDs remain usable when the uid field is absent", async () => {
  const db = createDb({
    users: {
      "legacy-auth-uid": { account_status: "active", full_name: "Legacy Client" },
    },
  });
  const account = await findClientAccountByIdentifier(db, "legacy-auth-uid");
  assert.equal(account.id, "legacy-auth-uid");
  assert.equal(account.uid, "legacy-auth-uid");
});

test("inactive accounts can be selected for floor plans but cannot authenticate as clients", async () => {
  const db = createDb({
    users: {
      "U-26002": {
        uid: "firebase-uid-2",
        account_status: "suspended",
      },
    },
  });
  assert.equal(
    (await findClientAccountByIdentifier(db, "firebase-uid-2", { requireActive: false })).id,
    "U-26002",
  );
  assert.equal(await findClientAccountByIdentifier(db, "firebase-uid-2"), null);
});

test("admin and employee records are not resolved as client accounts", async () => {
  const adminDb = createDb({
    users: {
      "client-id": { uid: "admin-uid", role: "admin", account_status: "active" },
    },
  });
  const employeeDb = createDb({
    users: {
      "client-id": { uid: "employee-uid", account_status: "active" },
    },
    adminEmployees: {
      "employee-account": { uid: "employee-uid", role: "admin", account_status: "active" },
    },
  });
  assert.equal(await findClientAccountByIdentifier(adminDb, "admin-uid"), null);
  assert.equal(await findClientAccountByIdentifier(employeeDb, "employee-uid"), null);
});
