import assert from "node:assert/strict";
import test from "node:test";

import { generateAccountId } from "./account-id.js";

function createMemoryDb() {
  const collections = new Map([
    ["users", new Map()],
    ["adminEmployees", new Map()],
    ["systemCounters", new Map()],
  ]);
  let transactionQueue = Promise.resolve();

  function reference(collectionName, id) {
    return {
      collectionName,
      id,
      async get() {
        const value = collections.get(collectionName).get(id);
        return { exists: value !== undefined, data: () => value };
      },
    };
  }

  const db = {
    collection(name) {
      const records = collections.get(name);
      return {
        async get() {
          return {
            docs: [...records.entries()].map(([id, value]) => ({
              id,
              data: () => value,
            })),
          };
        },
        doc(id) {
          return reference(name, id);
        },
      };
    },
    async runTransaction(callback) {
      let release;
      const previous = transactionQueue;
      transactionQueue = new Promise(resolve => {
        release = resolve;
      });
      await previous;
      const writes = [];
      try {
        return await callback({
          get: ref => ref.get(),
          set(ref, value) {
            writes.push(() => collections.get(ref.collectionName).set(ref.id, value));
          },
        });
      } finally {
        for (const write of writes) write();
        release();
      }
    },
    seed(collectionName, id, value) {
      collections.get(collectionName).set(id, value);
    },
  };
  return db;
}

test("account IDs continue the established format after legacy records", async () => {
  const db = createMemoryDb();
  db.seed("users", "U-26007", { id: "U-26007" });
  db.seed("adminEmployees", "U-26006", { id: "U-26006" });
  const result = await generateAccountId(db, 2026);
  assert.equal(result, "U-26008");
});

test("concurrent ID reservations do not return the same account ID", async () => {
  const db = createMemoryDb();
  const ids = await Promise.all(
    Array.from({ length: 20 }, () => generateAccountId(db, 2026)),
  );
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.sort(), Array.from(
    { length: 20 },
    (_, index) => `U-26${String(index + 1).padStart(3, "0")}`,
  ));
});
