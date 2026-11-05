import assert from "node:assert/strict";
import test from "node:test";

import { getLoginErrorMessage } from "./loginErrors.mjs";

test("incorrect email and password errors do not reveal which credential was wrong", () => {
  for (const code of [
    "auth/invalid-credential",
    "auth/user-not-found",
    "auth/wrong-password",
  ]) {
    assert.equal(getLoginErrorMessage(code), "Invalid email or password.");
  }
});

test("invalid email and transient authentication errors are actionable", () => {
  assert.equal(
    getLoginErrorMessage("auth/invalid-email"),
    "Please enter a valid email address.",
  );
  assert.equal(
    getLoginErrorMessage("auth/network-request-failed"),
    "Network error. Please check your internet connection.",
  );
});
