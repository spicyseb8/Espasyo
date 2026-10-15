
import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import {
    applicationDefault,
    initializeApp
} from "firebase-admin/app";

import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ==================================================
// CONFIGURATION
// ==================================================

const PROJECT_ID = "espasyo-6072d";

const BUCKET_NAME =
    process.env.FIREBASE_STORAGE_BUCKET ||
    "espasyo-6072d.firebasestorage.app";

const COLLECTION_NAME = "assets";

const OUTPUT_DIRECTORY = path.resolve("firebase-audit");

const require = createRequire(import.meta.url);

// ==================================================
// INITIALIZE FIREBASE ADMIN
// ==================================================

initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket: BUCKET_NAME
});

const db = getFirestore();
const bucket = getStorage().bucket();

// ==================================================
// HELPERS
// ==================================================

function normalizeStoragePath(value) {
    if (typeof value !== "string") {
        return null;
    }

    let input = value.trim();

    if (!input) {
        return null;
    }

    if (/^https?:\/\//i.test(input)) {
        try {
            const url = new URL(input);

            // Firebase Storage download URL
            const marker = "/o/";
            const index = url.pathname.indexOf(marker);

            if (index !== -1) {
                input = decodeURIComponent(
                    url.pathname.slice(index + marker.length)
                );
            } else {
                // Other URLs are not treated as Storage paths.
                return null;
            }
        } catch {
            return null;
        }
    } else if (input.startsWith("gs://")) {
        const withoutScheme = input.slice(5);
        const slash = withoutScheme.indexOf("/");

        if (slash === -1) {
            return null;
        }

        const bucketName = withoutScheme.slice(0, slash);

        if (bucketName !== BUCKET_NAME) {
            return null;
        }

        input = withoutScheme.slice(slash + 1);
    }

    input = input.replace(/^\/+/, "");

    if (
        input.includes("?") ||
        input.includes("#") ||
        input.includes("\\")
    ) {
        return null;
    }

    return input || null;
}

function collectPaths(data, prefix = "") {
    const results = [];

    if (!data || typeof data !== "object") {
        return results;
    }

    for (const [key, value] of Object.entries(data)) {
        const field = prefix ? `${prefix}.${key}` : key;

        if (typeof value === "string") {
            const looksLikeAssetField =
                /path|url|model|texture|thumbnail|diffuse|normal|rough|ao|base_color/i
                    .test(key);

            if (!looksLikeAssetField) {
                continue;
            }

            const normalized = normalizeStoragePath(value);

            if (normalized) {
                results.push({
                    field,
                    originalValue: value,
                    storagePath: normalized
                });
            }
        } else if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            typeof value.toDate !== "function"
        ) {
            results.push(...collectPaths(value, field));
        }
    }

    return results;
}

function normalizedName(value) {
    return value
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9]/g, "");
}

function getFileName(value) {
    return value.split("/").pop() || value;
}

function getParentPath(value) {
    const index = value.lastIndexOf("/");
    return index === -1 ? "" : value.slice(0, index);
}

function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

// ==================================================
// MAIN AUDIT
// ==================================================

async function main() {
    console.log("\n======================================");
    console.log(" ESPASYO FIREBASE ASSET AUDIT");
    console.log("======================================\n");

    console.log("Project:", PROJECT_ID);
    console.log("Bucket:", BUCKET_NAME);
    console.log("Collection:", COLLECTION_NAME);

    // 1. Read Firestore asset documents.
    console.log("\n[1/4] Reading Firestore assets...");

    const snapshot = await db
        .collection(COLLECTION_NAME)
        .get();

    console.log("Documents found:", snapshot.size);

    const documents = snapshot.docs.map((doc) => ({
        documentId: doc.id,
        data: doc.data()
    }));

    // 2. List actual objects in Storage.
    console.log("\n[2/4] Listing Firebase Storage objects...");

    const [storageFiles] = await bucket.getFiles({
        autoPaginate: true
    });

    const actualPaths = new Set(
        storageFiles.map((file) => file.name)
    );

    console.log("Storage objects found:", actualPaths.size);

    // Index files for suggestions.
    const filesByName = new Map();
    const filesByNormalizedName = new Map();

    for (const filePath of actualPaths) {
        const fileName = getFileName(filePath);
        const baseName = normalizedName(fileName);

        if (!filesByName.has(fileName.toLowerCase())) {
            filesByName.set(fileName.toLowerCase(), []);
        }

        filesByName.get(fileName.toLowerCase()).push(filePath);

        if (!filesByNormalizedName.has(baseName)) {
            filesByNormalizedName.set(baseName, []);
        }

        filesByNormalizedName.get(baseName).push(filePath);
    }

    // 3. Check each Firestore path.
    console.log("\n[3/4] Checking asset references...");

    const references = [];
    const documentSummary = [];

    for (const document of documents) {
        const { documentId, data } = document;
        const paths = collectPaths(data);

        documentSummary.push({
            documentId,
            id: data.id ?? null,
            name: data.name ?? null,
            asset_type: data.asset_type ?? null,
            category: data.category ?? null,
            asset_status: data.asset_status ?? null,
            referenceCount: paths.length
        });

        for (const reference of paths) {
            const exists = actualPaths.has(
                reference.storagePath
            );

            const fileName = getFileName(
                reference.storagePath
            );

            const parent = getParentPath(
                reference.storagePath
            );

            const exactNameCandidates =
                filesByName.get(fileName.toLowerCase()) || [];

            const normalizedCandidates =
                filesByNormalizedName.get(
                    normalizedName(fileName)
                ) || [];

            const filesUnderExpectedParent = [
                ...actualPaths
            ].filter((filePath) =>
                filePath.startsWith(`${parent}/`)
            );

            let status = exists ? "OK" : "MISSING";

            if (
                !exists &&
                (
                    exactNameCandidates.length > 0 ||
                    normalizedCandidates.length > 0
                )
            ) {
                status = "POSSIBLE_RENAMED_OR_DUPLICATE";
            }

            references.push({
                documentId,
                assetId: data.id ?? documentId,
                assetName: data.name ?? "",
                assetType: data.asset_type ?? "",
                category: data.category ?? "",
                assetStatus: data.asset_status ?? "",
                field: reference.field,
                originalValue: reference.originalValue,
                storagePath: reference.storagePath,
                exists,
                status,
                exactNameCandidates,
                normalizedCandidates,
                filesUnderExpectedParent
            });
        }
    }

    // 4. Detect duplicate references.
    console.log("\n[4/4] Preparing reports...");

    const referenceGroups = new Map();

    for (const reference of references) {
        const key = reference.storagePath;

        if (!referenceGroups.has(key)) {
            referenceGroups.set(key, []);
        }

        referenceGroups.get(key).push(reference);
    }

    const duplicateReferences = [];

    for (const [storagePath, group] of referenceGroups) {
        if (group.length > 1) {
            duplicateReferences.push({
                storagePath,
                count: group.length,
                documents: group.map((item) => ({
                    documentId: item.documentId,
                    assetName: item.assetName,
                    field: item.field
                }))
            });
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        projectId: PROJECT_ID,
        bucket: BUCKET_NAME,
        collection: COLLECTION_NAME,
        summary: {
            firestoreDocuments: snapshot.size,
            storageObjects: actualPaths.size,
            referencesChecked: references.length,
            validReferences: references.filter(
                (item) => item.exists
            ).length,
            missingReferences: references.filter(
                (item) => !item.exists
            ).length,
            possibleRenamedOrDuplicate:
                references.filter(
                    (item) =>
                        item.status ===
                        "POSSIBLE_RENAMED_OR_DUPLICATE"
                ).length,
            duplicateReferenceGroups:
                duplicateReferences.length
        },
        documents: documentSummary,
        references,
        duplicateReferences
    };

    await fs.mkdir(OUTPUT_DIRECTORY, {
        recursive: true
    });

    await fs.writeFile(
        path.join(OUTPUT_DIRECTORY, "report.json"),
        JSON.stringify(report, null, 2),
        "utf8"
    );

    const csvColumns = [
        "documentId",
        "assetId",
        "assetName",
        "assetType",
        "category",
        "assetStatus",
        "field",
        "storagePath",
        "exists",
        "status",
        "exactNameCandidates",
        "normalizedCandidates"
    ];

    const csvRows = references.map((item) =>
        csvColumns
            .map((column) => {
                const value = item[column];

                return csvEscape(
                    Array.isArray(value)
                        ? value.join(" | ")
                        : value
                );
            })
            .join(",")
    );

    await fs.writeFile(
        path.join(OUTPUT_DIRECTORY, "references.csv"),
        [
            csvColumns.join(","),
            ...csvRows
        ].join("\n"),
        "utf8"
    );

    console.log("\n======================================");
    console.log(" AUDIT SUMMARY");
    console.log("======================================");

    console.table(report.summary);

    console.log("\nMissing references:");

    for (const item of references.filter(
        (reference) => !reference.exists
    )) {
        console.log(
            `\n[${item.status}] ${item.assetName || item.documentId}`
        );

        console.log("  Document:", item.documentId);
        console.log("  Field:", item.field);
        console.log("  Requested:", item.storagePath);

        if (item.exactNameCandidates.length > 0) {
            console.log(
                "  Exact filename found elsewhere:",
                item.exactNameCandidates
            );
        }

        if (item.normalizedCandidates.length > 0) {
            console.log(
                "  Similar filename candidates:",
                item.normalizedCandidates
            );
        }

        if (item.filesUnderExpectedParent.length > 0) {
            console.log(
                "  Files under expected parent:",
                item.filesUnderExpectedParent.slice(0, 10)
            );
        }
    }

    console.log("\nReports saved to:");
    console.log(
        path.join(OUTPUT_DIRECTORY, "report.json")
    );
    console.log(
        path.join(OUTPUT_DIRECTORY, "references.csv")
    );

    console.log(
        "\nAudit complete. No Firestore or Storage objects were changed."
    );
}

main().catch((error) => {
    console.error("\nFirebase asset audit failed:");
    console.error(error);
    process.exitCode = 1;
});
