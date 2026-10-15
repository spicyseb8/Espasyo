import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminDb, adminStorage } from "./firebase-admin.js";

const PROJECT_ID = "espasyo-6072d";
const BUCKET_NAME = "espasyo-6072d.firebasestorage.app";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(ROOT, "..");
const REPORT_ROOT = path.join(ROOT, "firebase-audit", "storage-cleanup");
const ASSET_ROOTS = [
  "assets/floor/",
  "assets/floors/",
  "assets/wall/",
  "assets/walls/",
  "assets/furniture/",
  "assets/openings/",
];
const SOURCE_ROOTS = ["client", "admin", "server"];
const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
  ".json", ".html", ".css", ".scss", ".less", ".svg", ".vue",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git", ".next", ".vite", "build", "coverage", "dist",
  "firebase-audit", "node_modules", "out",
]);

function parseArguments(argv) {
  const args = new Set(argv.filter((value) => value.startsWith("--")));
  const reportIndex = argv.indexOf("--report");
  const reportPath = reportIndex < 0 ? null : argv[reportIndex + 1];
  const unknown = [...args].filter((value) =>
    !["--apply", "--report"].includes(value)
  );
  if (unknown.length) throw new Error(`Unknown option: ${unknown[0]}`);
  if (args.has("--apply") !== Boolean(reportPath)) {
    throw new Error("Use no flags for a dry run, or --apply --report <dry-run-report.json>.");
  }
  return { apply: args.has("--apply"), reportPath };
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function csvCell(value) {
  const text = value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows, fields) {
  return [
    fields.map(csvCell).join(","),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(",")),
  ].join("\n");
}

function normalizeStoragePath(value) {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;

  if (/^gs:\/\//i.test(input)) {
    const remainder = input.slice(5);
    const slash = remainder.indexOf("/");
    if (slash < 0 || remainder.slice(0, slash) !== BUCKET_NAME) return null;
    return remainder.slice(slash + 1);
  }

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (url.hostname === "firebasestorage.googleapis.com") {
        const marker = "/o/";
        const index = url.pathname.indexOf(marker);
        if (index < 0 || url.pathname.slice(0, index).split("/").at(-1) !== BUCKET_NAME) {
          return null;
        }
        return decodeURIComponent(url.pathname.slice(index + marker.length));
      }
      if (url.hostname === "storage.googleapis.com") {
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments[0] !== BUCKET_NAME) return null;
        return segments.slice(1).map(decodeURIComponent).join("/");
      }
      return null;
    } catch {
      return null;
    }
  }

  const normalized = input.replace(/^\/+/, "");
  return /[?#\\]/.test(normalized) ? null : normalized;
}

function addReferencesFromValue(value, source, references, objectNames) {
  if (typeof value === "string") {
    const normalized = normalizeStoragePath(value);
    if (normalized) {
      for (const objectName of objectNames) {
        if (normalized === objectName ||
          objectName.startsWith(`${normalized.replace(/\/+$/, "")}/`)) {
          references.get(objectName).push({ source, value: normalized });
        }
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child) =>
      addReferencesFromValue(child, source, references, objectNames)
    );
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((child) =>
      addReferencesFromValue(child, source, references, objectNames)
    );
  }
}

async function scanFirestore() {
  const documents = [];
  const visited = new Set();

  async function readCollection(reference) {
    if (visited.has(reference.path)) return;
    visited.add(reference.path);
    const snapshot = await reference.get();
    for (const document of snapshot.docs) {
      documents.push({ path: document.ref.path, data: document.data() });
      const subcollections = await document.ref.listCollections();
      for (const subcollection of subcollections) {
        await readCollection(subcollection);
      }
    }
  }

  const collections = await adminDb.listCollections();
  for (const collection of collections) await readCollection(collection);
  return documents;
}

async function scanProjectJson(objects) {
  const projects = [];
  const errors = [];
  for (const object of objects) {
    if (!object.name.startsWith("projects/") || !object.name.endsWith(".json")) continue;
    try {
      const [buffer] = await adminStorage.file(object.name).download();
      projects.push({
        path: object.name,
        data: JSON.parse(buffer.toString("utf8")),
      });
    } catch (error) {
      errors.push({
        source: "saved-project-json",
        path: object.name,
        reason: `Unable to read or parse project JSON: ${error.message}`,
      });
    }
  }
  return { projects, errors };
}

async function listSourceFiles(directory, relativeDirectory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listSourceFiles(absolute, relative));
    } else if (entry.isFile() &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push({ absolute, relative });
    }
  }
  return results;
}

async function scanSourceReferences(objectNames, references) {
  const errors = [];
  let filesScanned = 0;
  for (const root of SOURCE_ROOTS) {
    let sourceFiles;
    try {
      sourceFiles = await listSourceFiles(
        path.join(REPOSITORY_ROOT, root),
        root,
      );
    } catch (error) {
      errors.push({
        source: "application-code",
        path: root,
        reason: `Unable to enumerate source files: ${error.message}`,
      });
      continue;
    }

    for (const file of sourceFiles) {
      let contents;
      try {
        contents = await fs.readFile(file.absolute, "utf8");
      } catch (error) {
        errors.push({
          source: "application-code",
          path: file.relative,
          reason: `Unable to read source file: ${error.message}`,
        });
        continue;
      }
      filesScanned += 1;
      const lines = contents.split(/\r?\n/);
      objectNames.forEach((objectName) => {
        const encodedName = encodeURIComponent(objectName);
        lines.forEach((line, index) => {
          if (line.includes(objectName) || line.includes(encodedName)) {
            references.get(objectName).push({
              source: "application-code",
              file: file.relative,
              line: index + 1,
            });
          }
        });
      });
    }
  }
  return { filesScanned, errors };
}

function isCanonicalPath(name) {
  return /^assets\/(?:furniture\/[^/]+\/F-\d{5}|floors\/[^/]+\/FL-\d{5}|walls\/[^/]+\/W-\d{5}|openings\/[^/]+\/[^/]+)\/[^/]+$/i
    .test(name);
}

function classifyObjects(objects, references, scanComplete) {
  const groups = new Map();
  for (const object of objects) {
    if (!groups.has(object.sha256)) groups.set(object.sha256, []);
    groups.get(object.sha256).push(object);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([sha256, members]) => ({
      sha256,
      size: members[0].size,
      paths: members.map((object) => object.name),
    }));

  const rows = objects.map((object) => {
    const members = groups.get(object.sha256) ?? [];
    const duplicates = members.filter((member) => member.name !== object.name);
    const refs = references.get(object.name) ?? [];
    let status = "keep";
    let reason = refs.length
      ? "Referenced by Firestore, saved project data, or application source."
      : "No content-identical replacement is available; retain conservatively.";
    let replacementPath = null;

    if (!scanComplete) {
      status = "manual-review";
      reason = "Reference scan was incomplete; deletion is not considered safe.";
    } else if (duplicates.length && refs.length === 0) {
      const referencedCanonical = duplicates.find((candidate) =>
        isCanonicalPath(candidate.name) &&
        (references.get(candidate.name)?.length ?? 0) > 0
      );
      const canonical = duplicates.find((candidate) =>
        isCanonicalPath(candidate.name)
      );
      if (referencedCanonical) {
        status = "safe-to-delete";
        replacementPath = referencedCanonical.name;
        reason = "SHA-256 content matches a canonical replacement that remains referenced; no references to this path were found.";
      } else if (canonical && (references.get(canonical.name)?.length ?? 0) === 0) {
        status = "manual-review";
        replacementPath = canonical.name;
        reason = "An identical canonical file exists, but neither copy has a verified live reference.";
      } else {
        status = "manual-review";
        reason = "Identical content exists, but no retained canonical copy with verified references was established.";
      }
    } else if (duplicates.length) {
      status = "keep";
      reason = "This duplicate path is referenced; no reference migration is proposed in this cleanup.";
    }

    if (refs.length > 0 && !isCanonicalPath(object.name)) {
      status = "manual-review";
      reason = "Referenced object is retained, but its path does not follow the requested target folder structure.";
    }

    return {
      path: object.name,
      size: object.size,
      contentType: object.contentType,
      generation: object.generation,
      md5Hash: object.md5Hash,
      crc32c: object.crc32c,
      sha256: object.sha256,
      duplicatePaths: duplicates.map((member) => member.name),
      referenceCount: refs.length,
      references: refs,
      replacementPath,
      status,
      reason,
    };
  });
  return { rows, duplicateGroups };
}

async function buildAuditReport() {
  const [files] = await adminStorage.getFiles({ autoPaginate: true });
  const inventory = [];
  const scanErrors = [];

  for (const file of files) {
    const name = file.name;
    if (!ASSET_ROOTS.some((prefix) => name.startsWith(prefix)) || name.endsWith("/")) {
      continue;
    }
    try {
      const [metadata] = await file.getMetadata();
      const [contents] = await file.download();
      inventory.push({
        name,
        size: Number(metadata.size) || contents.byteLength,
        contentType: metadata.contentType ?? null,
        generation: String(metadata.generation ?? ""),
        md5Hash: metadata.md5Hash ?? null,
        crc32c: metadata.crc32c ?? null,
        metadata: metadata.metadata ?? {},
        sha256: crypto.createHash("sha256").update(contents).digest("hex"),
      });
    } catch (error) {
      scanErrors.push({
        source: "storage-object",
        path: name,
        reason: `Unable to hash or inspect object: ${error.message}`,
      });
    }
  }

  const documents = await scanFirestore();
  const { projects, errors: projectErrors } = await scanProjectJson(files);
  scanErrors.push(...projectErrors);

  const objectNames = inventory.map((object) => object.name);
  const references = new Map(objectNames.map((name) => [name, []]));
  for (const document of documents) {
    addReferencesFromValue(
      document.data,
      `firestore:${document.path}`,
      references,
      objectNames,
    );
  }
  for (const project of projects) {
    addReferencesFromValue(
      project.data,
      `saved-project:${project.path}`,
      references,
      objectNames,
    );
  }
  const sourceScan = await scanSourceReferences(objectNames, references);
  scanErrors.push(...sourceScan.errors);

  const complete = scanErrors.length === 0 &&
    inventory.length === files.filter((file) =>
      ASSET_ROOTS.some((prefix) => file.name.startsWith(prefix)) &&
      !file.name.endsWith("/")
    ).length;
  const { rows, duplicateGroups } = classifyObjects(
    inventory,
    references,
    complete,
  );
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    mode: "dry-run",
    scanComplete: complete,
    summary: {
      assetObjectsInspected: inventory.length,
      assetBytesInspected: inventory.reduce((total, object) => total + object.size, 0),
      firestoreDocumentsScanned: documents.length,
      savedProjectsScanned: projects.length,
      applicationSourceFilesScanned: sourceScan.filesScanned,
      duplicateContentGroups: duplicateGroups.length,
      safeToDelete: rows.filter((row) => row.status === "safe-to-delete").length,
      keep: rows.filter((row) => row.status === "keep").length,
      manualReview: rows.filter((row) => row.status === "manual-review").length,
      scanErrors: scanErrors.length,
    },
    duplicateGroups,
    objects: rows,
    scanErrors,
    deletionLog: [],
  };
}

async function writeReport(report, directory) {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "storage-cleanup-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(directory, "storage-cleanup-report.csv"),
    toCsv(report.objects, [
      "path", "size", "contentType", "generation", "md5Hash", "crc32c",
      "sha256", "duplicatePaths", "referenceCount", "references",
      "replacementPath", "status", "reason",
    ]),
    "utf8",
  );
  await fs.writeFile(
    path.join(directory, "duplicate-groups.csv"),
    toCsv(report.duplicateGroups, ["sha256", "size", "paths"]),
    "utf8",
  );
  await fs.writeFile(
    path.join(directory, "deletion-log.csv"),
    toCsv(report.deletionLog, [
      "path", "generation", "sha256", "deletedAt", "status", "error",
    ]),
    "utf8",
  );
  return path.join(directory, "storage-cleanup-report.json");
}

async function applyCleanup(reportPath) {
  const absoluteReportPath = path.resolve(ROOT, reportPath);
  const report = JSON.parse(await fs.readFile(absoluteReportPath, "utf8"));
  if (report.projectId !== PROJECT_ID || report.bucket !== BUCKET_NAME ||
    report.mode !== "dry-run" || report.scanComplete !== true ||
    report.scanErrors?.length) {
    throw new Error("The selected report is incomplete or targets a different Firebase project/bucket.");
  }

  const refreshed = await buildAuditReport();
  if (!refreshed.scanComplete) {
    throw new Error("Fresh reference scan is incomplete; refusing Storage deletion.");
  }
  const refreshedByPath = new Map(refreshed.objects.map((object) => [object.path, object]));
  const outputDirectory = path.join(REPORT_ROOT, `cleanup-apply-${timestampLabel()}`);
  const log = [];

  for (const candidate of report.objects.filter((object) =>
    object.status === "safe-to-delete"
  )) {
    const current = refreshedByPath.get(candidate.path);
    const replacement = refreshedByPath.get(candidate.replacementPath);
    const sourceFile = adminStorage.file(candidate.path);
    if (!current || !replacement || current.referenceCount !== 0 ||
      current.sha256 !== candidate.sha256 ||
      current.generation !== candidate.generation ||
      current.sha256 !== replacement.sha256 ||
      !isCanonicalPath(replacement.path) ||
      replacement.referenceCount === 0) {
      log.push({
        path: candidate.path,
        generation: candidate.generation,
        sha256: candidate.sha256,
        deletedAt: null,
        status: "skipped",
        error: "Fresh hash, generation, reference, or replacement verification failed.",
      });
      continue;
    }

    try {
      await sourceFile.delete({ ifGenerationMatch: Number(candidate.generation) });
      log.push({
        path: candidate.path,
        generation: candidate.generation,
        sha256: candidate.sha256,
        deletedAt: new Date().toISOString(),
        status: "deleted",
        error: null,
      });
      report.deletionLog.push(log[log.length - 1]);
      await writeReport(report, outputDirectory);
    } catch (error) {
      log.push({
        path: candidate.path,
        generation: candidate.generation,
        sha256: candidate.sha256,
        deletedAt: null,
        status: "failed",
        error: error.message,
      });
      report.deletionLog.push(log[log.length - 1]);
      await writeReport(report, outputDirectory);
      throw error;
    }
  }

  report.mode = "apply";
  report.appliedAt = new Date().toISOString();
  const finalReport = await writeReport(report, outputDirectory);
  console.log(`Deletion log and final report: ${finalReport}`);
  console.log(`Deleted: ${log.filter((entry) => entry.status === "deleted").length}`);
  console.log(`Skipped: ${log.filter((entry) => entry.status === "skipped").length}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.apply) {
    await applyCleanup(options.reportPath);
    return;
  }

  const report = await buildAuditReport();
  const outputDirectory = path.join(REPORT_ROOT, `dry-run-${timestampLabel()}`);
  const reportPath = await writeReport(report, outputDirectory);
  console.log(`Firebase project: ${report.projectId}`);
  console.log(`Storage bucket: ${report.bucket}`);
  console.log(`Objects inspected: ${report.summary.assetObjectsInspected}`);
  console.log(`Exact-content duplicate groups: ${report.summary.duplicateContentGroups}`);
  console.log(`Safe to delete: ${report.summary.safeToDelete}`);
  console.log(`Keep: ${report.summary.keep}`);
  console.log(`Manual review: ${report.summary.manualReview}`);
  console.log(`Reference scan complete: ${report.scanComplete}`);
  console.log(`Report: ${reportPath}`);
  console.log("Dry run only; no Storage objects were deleted.");
}

main().catch((error) => {
  console.error("Asset Storage cleanup failed:", error);
  process.exitCode = 1;
});
