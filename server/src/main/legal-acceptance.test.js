import assert from "node:assert/strict";
import test from "node:test";
import { LEGAL_DOCUMENT_VERSIONS } from "../../../shared/legalDocumentVersions.mjs";
import {
  createGetLegalAcceptanceHandler,
  createSaveLegalAcceptanceHandler,
} from "./legal-acceptance.js";

function createResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers = { ...this.headers, [name]: value };
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("saves versioned acceptance to the authenticated client's existing profile", async () => {
  let saved;
  const timestamp = { serverTimestamp: true };
  const handler = createSaveLegalAcceptanceHandler({
    dbClient: {
      collection(name) {
        assert.equal(name, "users");
        return {
          doc(id) {
            assert.equal(id, "account-document-id");
            return {
              async set(data, options) {
                saved = { data, options };
              },
              async get() {
                return {
                  data: () => saved.data,
                };
              },
            };
          },
        };
      },
    },
    serverTimestamp: () => timestamp,
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
    body: { accepted: true, ...LEGAL_DOCUMENT_VERSIONS },
  }, response);

  assert.deepEqual(saved, {
    data: {
      legalAcceptance: { ...LEGAL_DOCUMENT_VERSIONS, acceptedAt: timestamp },
      updated_at: timestamp,
    },
    options: { merge: true },
  });
  assert.equal(response.body.accepted, true);
});

test("reports a failed write without returning a successful acceptance", async () => {
  const handler = createSaveLegalAcceptanceHandler({
    dbClient: {
      collection: () => ({
        doc: () => ({
          set: async () => {
            throw new Error("Firestore unavailable");
          },
        }),
      }),
    },
    logError: () => {},
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
    body: { accepted: true, ...LEGAL_DOCUMENT_VERSIONS },
  }, response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.accepted, undefined);
});

test("does not confirm acceptance when its saved value cannot be verified", async () => {
  const handler = createSaveLegalAcceptanceHandler({
    dbClient: {
      collection: () => ({
        doc: () => ({
          set: async () => {},
          get: async () => {
            throw new Error("Firestore read unavailable");
          },
        }),
      }),
    },
    logError: () => {},
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
    body: { accepted: true, ...LEGAL_DOCUMENT_VERSIONS },
  }, response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.accepted, undefined);
});

test("rejects acceptance without explicit agreement to both current versions", async () => {
  const handler = createSaveLegalAcceptanceHandler({
    dbClient: {
      collection: () => {
        throw new Error("The profile must not be written.");
      },
    },
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
    body: { accepted: true, termsVersion: "outdated", privacyPolicyVersion: "1.0" },
  }, response);

  assert.equal(response.statusCode, 400);
});

test("reports acceptance only when both current versions and a timestamp are present", async () => {
  const profile = {
    legalAcceptance: {
      ...LEGAL_DOCUMENT_VERSIONS,
      acceptedAt: { toDate: () => new Date() },
    },
  };
  const handler = createGetLegalAcceptanceHandler({
    dbClient: {
      collection: () => ({
        doc: () => ({
          get: async () => ({ data: () => profile }),
        }),
      }),
    },
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
  }, response);
  assert.equal(response.body.accepted, true);
  assert.equal(response.headers["Cache-Control"], "no-store");

  profile.legalAcceptance.termsVersion = "outdated";
  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
  }, response);
  assert.equal(response.body.accepted, false);
});

test("reads acceptance independently from each authenticated profile", async () => {
  const profiles = new Map([
    ["account-a", { legalAcceptance: { ...LEGAL_DOCUMENT_VERSIONS, acceptedAt: {} } }],
    ["account-b", {}],
  ]);
  const handler = createGetLegalAcceptanceHandler({
    dbClient: {
      collection: () => ({
        doc: id => ({
          get: async () => ({ data: () => profiles.get(id) }),
        }),
      }),
    },
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-a", uid: "auth-a" },
  }, response);
  assert.equal(response.body.accepted, true);

  await handler({
    legalAcceptanceAccount: { id: "account-b", uid: "auth-b" },
  }, response);
  assert.equal(response.body.accepted, false);
});

test("does not confirm acceptance when its timestamp is missing", async () => {
  const handler = createGetLegalAcceptanceHandler({
    dbClient: {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            data: () => ({ legalAcceptance: { ...LEGAL_DOCUMENT_VERSIONS } }),
          }),
        }),
      }),
    },
  });
  const response = createResponse();

  await handler({
    legalAcceptanceAccount: { id: "account-document-id", uid: "auth-uid" },
  }, response);

  assert.equal(response.body.accepted, false);
});
