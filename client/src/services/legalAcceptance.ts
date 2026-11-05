import type { User } from "firebase/auth";

import { LEGAL_DOCUMENT_VERSIONS } from "../../../shared/legalDocumentVersions.mjs";
import { projectApi } from "./projectApi";

interface LegalAcceptanceResponse {
  accepted: boolean;
}

export async function getLegalAcceptance(user: User): Promise<boolean> {
  const response = await projectApi<{ accepted: boolean }>(
    "/client/legal-acceptance",
    { method: "GET", cache: "no-store" },
    user,
  );

  if (typeof response.accepted !== "boolean") {
    throw new Error("We could not verify your agreement. Please retry.");
  }
  return response.accepted;
}

export async function saveLegalAcceptance(user: User): Promise<void> {
  const response = await projectApi<LegalAcceptanceResponse>(
    "/client/legal-acceptance",
    {
      method: "POST",
      body: JSON.stringify({ accepted: true, ...LEGAL_DOCUMENT_VERSIONS }),
    },
    user,
  );

  if (response.accepted !== true) {
    throw new Error("The agreement was not confirmed as saved.");
  }
}
