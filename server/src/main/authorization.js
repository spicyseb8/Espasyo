import { adminAuth, adminDb } from "../firebase-admin.js";
import { createRequireRole } from "./authorization-core.js";

export { createRequireRole };

export const requireRole = createRequireRole({
  authClient: adminAuth,
  dbClient: adminDb,
});
