import assert from "node:assert/strict";
import test from "node:test";
import { createRequireRole } from "./authorization-core.js";

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createHarness({ tokenError, employee, databaseError, emailVerified = true } = {}) {
  const calls = { verifyIdToken: [], employeeLookup: 0, next: 0 };
  const authClient = {
    async verifyIdToken(token, checkRevoked) {
      calls.verifyIdToken.push({ token, checkRevoked });
      if (tokenError) throw tokenError;
      return {
        uid: "employee-uid",
        email_verified: emailVerified,
      };
    },
  };
  const dbClient = {
    collection(name) {
      assert.equal(name, "adminEmployees");
      return {
        where(field, operator, value) {
          assert.deepEqual([field, operator, value], ["uid", "==", "employee-uid"]);
          return {
            limit(count) {
              assert.equal(count, 1);
              return {
                async get() {
                  calls.employeeLookup += 1;
                  if (databaseError) throw databaseError;
                  return {
                    docs: employee
                      ? [{ data: () => employee }]
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
  const req = {
    get(name) {
      assert.equal(name, "authorization");
      return "Bearer test-token";
    },
  };
  const res = createResponse();
  const middleware = createRequireRole({ authClient, dbClient })("admin", "superadmin");

  return {
    calls,
    req,
    res,
    async invoke() {
      await middleware(req, res, () => {
        calls.next += 1;
      });
    },
  };
}

test("accepts an active authorized employee and enables token revocation checks", async () => {
  const harness = createHarness({
    employee: {
      uid: "employee-uid",
      role: "admin",
      account_status: "active",
      name: "Active Admin",
    },
  });

  await harness.invoke();

  assert.equal(harness.res.statusCode, 200);
  assert.equal(harness.calls.next, 1);
  assert.deepEqual(harness.calls.verifyIdToken, [
    { token: "test-token", checkRevoked: true },
  ]);
  assert.equal(harness.req.adminUser.role, "admin");
});

for (const tokenFailure of [
  ["expired", { code: "auth/id-token-expired" }],
  ["invalid", { code: "auth/argument-error" }],
  ["revoked", { code: "auth/id-token-revoked" }],
  ["disabled account", { code: "auth/user-disabled" }],
]) {
  test(`rejects ${tokenFailure[0]} Firebase tokens`, async () => {
    const harness = createHarness({ tokenError: tokenFailure[1] });

    await harness.invoke();

    assert.equal(harness.res.statusCode, 401);
    assert.equal(harness.calls.employeeLookup, 0);
    assert.equal(harness.calls.next, 0);
  });
}

test("rejects missing, inactive, suspended, and deleted employee records", async () => {
  for (const employee of [
    undefined,
    { role: "admin", account_status: "inactive" },
    { role: "admin", account_status: "suspended" },
    { role: "admin", account_status: "deleted" },
  ]) {
    const harness = createHarness({ employee });

    await harness.invoke();

    assert.equal(harness.res.statusCode, 403);
    assert.equal(harness.calls.next, 0);
  }
});

test("rejects insufficient roles and unverified email", async () => {
  const insufficientRole = createHarness({
    employee: { role: "user", account_status: "active" },
  });
  await insufficientRole.invoke();
  assert.equal(insufficientRole.res.statusCode, 403);
  assert.equal(insufficientRole.calls.next, 0);

  const unverified = createHarness({
    employee: { role: "admin", account_status: "active" },
    emailVerified: false,
  });
  await unverified.invoke();
  assert.equal(unverified.res.statusCode, 403);
  assert.equal(unverified.calls.employeeLookup, 0);
});

test("allows existing superadmin permissions and fails closed on lookup errors", async () => {
  const superadmin = createHarness({
    employee: { role: "superadmin", account_status: "active" },
  });
  await superadmin.invoke();
  assert.equal(superadmin.res.statusCode, 200);
  assert.equal(superadmin.calls.next, 1);

  const lookupFailure = createHarness({
    databaseError: new Error("Firestore unavailable"),
  });
  await lookupFailure.invoke();
  assert.equal(lookupFailure.res.statusCode, 500);
  assert.equal(lookupFailure.calls.next, 0);
});
