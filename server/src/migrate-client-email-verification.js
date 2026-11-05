import { adminAuth, adminDb } from "./firebase-admin.js";
import { migrateClientEmailVerification } from "./main/client-email-verification-migration.js";

const apply = process.argv.includes("--apply");
const result = await migrateClientEmailVerification({
  adminAuth,
  adminDb,
  apply,
});

console.log(`Client account records inspected: ${result.inspected}`);
console.log(`Unverified eligible client accounts: ${result.eligible}`);
console.log(`Already verified client accounts: ${result.alreadyVerified}`);
console.log(`Client accounts migrated: ${result.migrated}`);
console.log(`Records skipped after identity/classification checks: ${result.skipped}`);
if (!apply) {
  console.log("Dry run only. Re-run with --apply to verify eligible client accounts.");
}
