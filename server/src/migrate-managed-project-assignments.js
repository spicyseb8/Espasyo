import { adminDb } from "./firebase-admin.js";
import { migrateManagedProjectAssignments } from "./main/managed-project-assignment-migration.js";

const argumentsList = process.argv.slice(2);
const unknownArguments = argumentsList.filter(argument => argument !== "--apply");
if (unknownArguments.length) {
  throw new Error(`Unknown arguments: ${unknownArguments.join(", ")}`);
}

const apply = argumentsList.includes("--apply");
const result = await migrateManagedProjectAssignments(adminDb, { apply });
console.log(`${apply ? "Applied" : "Dry run"} assignment migration: ${JSON.stringify(result)}`);
if (result.conflicts) process.exitCode = 1;
