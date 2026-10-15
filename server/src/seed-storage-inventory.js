
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the existing Firebase Admin initialization.
import "./firebase-admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(
  __dirname,
  "storage-inventory"
);

const DEFAULT_BUCKET = "espasyo-6072d.firebasestorage.app";

function getBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.STORAGE_BUCKET ||
    DEFAULT_BUCKET
  );
}

function getExtension(filePath) {
  return path.posix.extname(filePath).toLowerCase() || "(no extension)";
}

function getTopFolder(filePath) {
  return filePath.includes("/")
    ? filePath.split("/")[0]
    : "(root)";
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function addToGroup(groups, key, sizeBytes) {
  if (!groups[key]) {
    groups[key] = {
      fileCount: 0,
      totalBytes: 0,
    };
  }

  groups[key].fileCount += 1;
  groups[key].totalBytes += sizeBytes;
}

function createSummaryRows(groups) {
  const rows = [
    ["group", "fileCount", "totalBytes", "totalMB", "totalMiB"]
      .join(","),
  ];

  const sortedGroups = Object.entries(groups).sort(
    (a, b) => b[1].totalBytes - a[1].totalBytes
  );

  for (const [name, group] of sortedGroups) {
    rows.push(
      [
        csvEscape(name),
        group.fileCount,
        group.totalBytes,
        (group.totalBytes / 1_000_000).toFixed(2),
        (group.totalBytes / (1024 * 1024)).toFixed(2),
      ].join(",")
    );
  }

  return rows.join("\n");
}

async function seedStorageInventory() {
  console.log("Starting Firebase Storage inventory...");
  console.log("Mode: READ ONLY");

  try {
    const bucketName = getBucketName();
    const bucket = getStorage().bucket(bucketName);

    console.log(`Bucket: ${bucketName}`);
    console.log("Reading existing Storage objects...");

    const [storageFiles] = await bucket.getFiles({
      autoPaginate: true,
    });

    const files = [];
    const byFolder = {};
    const byExtension = {};

    for (const file of storageFiles) {
      const metadata = file.metadata;
      const sizeBytes = Number(metadata.size ?? 0);

      const entry = {
        name: file.name,
        fileName: path.posix.basename(file.name),
        folder: getTopFolder(file.name),
        extension: getExtension(file.name),
        contentType: metadata.contentType ?? "",
        sizeBytes,
        sizeKB: Number((sizeBytes / 1000).toFixed(2)),
        sizeMB: Number((sizeBytes / 1_000_000).toFixed(4)),
        sizeMiB: Number((sizeBytes / (1024 * 1024)).toFixed(4)),
        updated: metadata.updated ?? null,
      };

      files.push(entry);

      addToGroup(byFolder, entry.folder, sizeBytes);
      addToGroup(byExtension, entry.extension, sizeBytes);
    }

    files.sort((a, b) => b.sizeBytes - a.sizeBytes);

    const totalBytes = files.reduce(
      (sum, file) => sum + file.sizeBytes,
      0
    );

    const report = {
      generatedAt: new Date().toISOString(),
      bucket: bucketName,
      readOnly: true,
      fileCount: files.length,
      totalBytes,
      totalMB: Number((totalBytes / 1_000_000).toFixed(2)),
      totalMiB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      byFolder,
      byExtension,
      largestFiles: files.slice(0, 25),
      files,
    };

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const fileColumns = [
      "name",
      "fileName",
      "folder",
      "extension",
      "contentType",
      "sizeBytes",
      "sizeKB",
      "sizeMB",
      "sizeMiB",
      "updated",
    ];

    const fileCsv = [
      fileColumns.join(","),
      ...files.map((file) =>
        fileColumns
          .map((column) => csvEscape(file[column]))
          .join(",")
      ),
    ].join("\n");

    await fs.writeFile(
      path.join(OUTPUT_DIR, "files.csv"),
      fileCsv,
      "utf8"
    );

    await fs.writeFile(
      path.join(OUTPUT_DIR, "folder-summary.csv"),
      createSummaryRows(byFolder),
      "utf8"
    );

    await fs.writeFile(
      path.join(OUTPUT_DIR, "extension-summary.csv"),
      createSummaryRows(byExtension),
      "utf8"
    );

    await fs.writeFile(
      path.join(OUTPUT_DIR, "report.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );

    console.log("\nInventory completed successfully.");
    console.log(`Files found: ${files.length}`);
    console.log(`Total storage: ${report.totalMB} MB`);
    console.log(`Total storage: ${report.totalMiB} MiB`);

    console.log("\nTop 10 largest files:");

    for (const file of files.slice(0, 10)) {
      console.log(
        `${file.sizeMB.toFixed(2)} MB | ${file.name}`
      );
    }

    console.log(`\nReports saved in: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error("Storage inventory failed:");
    console.error(error.message);
    process.exitCode = 1;
  }
}

seedStorageInventory();
