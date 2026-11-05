import assert from "node:assert/strict";
import test from "node:test";

import { ensureEmailVerified } from "./loginVerification.mjs";

test("verified accounts continue without sending a verification email", async () => {
  const events = [];
  const result = await ensureEmailVerified(
    { emailVerified: true },
    async () => events.push("send"),
    async () => events.push("sign-out"),
  );
  assert.deepEqual(result, { verified: true, verificationSent: false });
  assert.deepEqual(events, []);
});

test("unverified accounts are sent a verification email and signed out", async () => {
  const events = [];
  const user = { emailVerified: false };
  const result = await ensureEmailVerified(
    user,
    async target => {
      assert.equal(target, user);
      events.push("send");
    },
    async () => events.push("sign-out"),
  );
  assert.deepEqual(result, { verified: false, verificationSent: true });
  assert.deepEqual(events, ["send", "sign-out"]);
  assert.equal(user.emailVerified, false);
});

test("verification delivery failures are reported without bypassing the verification gate", async () => {
  const events = [];
  const verificationError = new Error("email service unavailable");
  const result = await ensureEmailVerified(
    { emailVerified: false },
    async () => {
      throw verificationError;
    },
    async () => events.push("sign-out"),
  );
  assert.equal(result.verified, false);
  assert.equal(result.verificationSent, false);
  assert.equal(result.verificationError, verificationError);
  assert.deepEqual(events, ["sign-out"]);
});
