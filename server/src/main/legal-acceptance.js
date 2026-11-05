import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../firebase-admin.js";
import { LEGAL_DOCUMENT_VERSIONS } from "../../../shared/legalDocumentVersions.mjs";
import { findClientAccountByIdentifier } from "./client-account.js";

export function createSaveLegalAcceptanceHandler({
  dbClient = adminDb,
  serverTimestamp = FieldValue.serverTimestamp,
  versions = LEGAL_DOCUMENT_VERSIONS,
  logError = console.error,
} = {}) {
  return async (req, res) => {
    const account = req.legalAcceptanceAccount;
    if (!account?.id || !account?.uid) {
      return res.status(403).json({
        success: false,
        message: "An active client account is required.",
      });
    }

    if (
      req.body?.accepted !== true ||
      req.body?.termsVersion !== versions.termsVersion ||
      req.body?.privacyPolicyVersion !== versions.privacyPolicyVersion
    ) {
      return res.status(400).json({
        success: false,
        message: "Please review and agree to the current policies.",
      });
    }

    try {
      const profile = dbClient.collection("users").doc(account.id);
      await profile.set({
        legalAcceptance: {
          ...versions,
          acceptedAt: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
      }, { merge: true });

      const savedProfile = await profile.get();
      if (!hasCurrentAcceptance(savedProfile.data()?.legalAcceptance, versions)) {
        return res.status(500).json({
          success: false,
          accepted: false,
          message: "Unable to verify your agreement. Please retry.",
        });
      }

      return res.json({ success: true, accepted: true });
    } catch (error) {
      logError("Unable to save client legal acceptance:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to save your agreement. Please retry.",
      });
    }
  };
}

function hasCurrentAcceptance(acceptance, versions) {
  return acceptance?.termsVersion === versions.termsVersion &&
    acceptance?.privacyPolicyVersion === versions.privacyPolicyVersion &&
    acceptance.acceptedAt != null;
}

export function createGetLegalAcceptanceHandler({
  dbClient = adminDb,
  versions = LEGAL_DOCUMENT_VERSIONS,
  logError = console.error,
} = {}) {
  return async (req, res) => {
    const account = req.legalAcceptanceAccount;
    if (!account?.id || !account?.uid) {
      return res.status(403).json({
        success: false,
        message: "An active client account is required.",
      });
    }

    try {
      const profile = await dbClient.collection("users").doc(account.id).get();
      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        accepted: hasCurrentAcceptance(profile.data()?.legalAcceptance, versions),
      });
    } catch (error) {
      logError("Unable to verify client legal acceptance:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to verify your agreement. Please retry.",
      });
    }
  };
}

async function authenticateClient(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Sign in to continue." });
  }

  let token;
  try {
    token = await adminAuth.verifyIdToken(match[1], true);
  } catch (error) {
    console.error("Legal acceptance token verification failed:", error);
    return res.status(401).json({ success: false, message: "Your session is invalid. Sign in again." });
  }

  if (token.email_verified !== true) {
    return res.status(403).json({ success: false, message: "Verify your email before continuing." });
  }

  try {
    const account = await findClientAccountByIdentifier(adminDb, token.uid);
    if (!account) {
      return res.status(403).json({ success: false, message: "An active client account is required." });
    }
    req.legalAcceptanceAccount = account;
    return next();
  } catch (error) {
    console.error("Legal acceptance client lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to verify your client account." });
  }
}

const router = express.Router();
router.get("/client/legal-acceptance", authenticateClient, createGetLegalAcceptanceHandler());
router.post("/client/legal-acceptance", authenticateClient, createSaveLegalAcceptanceHandler());

export default router;
