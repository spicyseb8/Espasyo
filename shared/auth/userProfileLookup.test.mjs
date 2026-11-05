import assert from "node:assert/strict";
import test from "node:test";

import { resolveUserProfileByAuthUid } from "./userProfileLookup.mjs";

test("resolves the account document by its stored Auth UID, not its account ID", () => {
  const profile = { id: "U-26001", uid: "firebase-uid", full_name: "Client" };
  assert.equal(
    resolveUserProfileByAuthUid("firebase-uid", [profile], null),
    profile,
  );
});

test("supports legacy UID-keyed profiles without a uid field", () => {
  const profile = { id: "firebase-uid", full_name: "Legacy Client" };
  assert.equal(resolveUserProfileByAuthUid("firebase-uid", [], profile), profile);
});

test("rejects ambiguous or mismatched profile associations", () => {
  assert.throws(
    () => resolveUserProfileByAuthUid("firebase-uid", [
      { id: "U-1", uid: "firebase-uid" },
      { id: "U-2", uid: "firebase-uid" },
    ], null),
    /More than one account profile/,
  );
  assert.equal(
    resolveUserProfileByAuthUid(
      "firebase-uid",
      [],
      { id: "firebase-uid", uid: "different-uid" },
    ),
    null,
  );
});
