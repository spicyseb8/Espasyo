import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import { GeoPoint, Timestamp } from "firebase-admin/firestore";

import { adminDb, adminStorage } from "./firebase-admin.js";

const PROJECT_ID = "espasyo-6072d";
const BUCKET_NAME = "espasyo-6072d.firebasestorage.app";
const ASSETS_COLLECTION = "assets";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(ROOT, "..");
const AUDIT_ROOT = path.join(ROOT, "firebase-audit");
const MAX_SEQUENCE = 999;
const CURRENT_YEAR = String(new Date().getFullYear()).slice(-2);
const ASSET_PATH_FIELD =
  /(?:path|url|model|texture|thumbnail|diffuse|normal|rough|ao|base_color)/i;
const STORAGE_ROLE_BY_FIELD = [
  [/model/i, "model"],
  [/diffuse|base.?color/i, "diffuse"],
  [/thumbnail/i, "thumbnail"],
  [/normal/i, "normal"],
  [/rough/i, "roughness"],
  [/(?:^|_)ao(?:_|$)|ambient/i, "ao"],
];
const TYPE_PREFIX = {
  furniture: "F",
  floor: "FL",
  wall: "W",
};
const TYPE_ROOT = {
  furniture: "furniture",
  floor: "floors",
  wall: "walls",
};
const FURNITURE_CATEGORIES = new Set([
  "livingroom",
  "bedroom",
  "diningroom",
  "kitchen",
  "bathroom",
  "office",
]);
const OPENING_CATEGORIES = new Set(["door", "doors", "window", "windows"]);
const PROJECT_JSON_ROOT_FIELDS = new Set([
  "furniture",
  "doors",
  "windows",
  "floorFinishes",
  "wallFinishes",
]);
const SOURCE_ROOTS = [
  "client",
  "admin",
  "server",
];
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);
const SOURCE_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".vite",
  "build",
  "coverage",
  "dist",
  "firebase-audit",
  "node_modules",
  "out",
]);
const TOKEN_KEY = "firebaseStorageDownloadTokens";

function parseArguments(argv) {
  const flags = new Set(argv.filter((argument) => argument.startsWith("--")));
  const resumeIndex = argv.indexOf("--resume");
  const resumePath = resumeIndex >= 0 ? argv[resumeIndex + 1] : null;

  if (flags.has("--delete-orphans") && !flags.has("--apply")) {
    throw new Error("--delete-orphans is valid only with --apply.");
  }
  if (flags.has("--report") && flags.has("--apply")) {
    throw new Error("Choose either --report or --apply.");
  }
  if (resumeIndex >= 0 && (!flags.has("--apply") || !resumePath)) {
    throw new Error("--resume requires --apply and a backup directory path.");
  }

  const unknownFlags = [...flags].filter((flag) =>
    !["--report", "--apply", "--delete-orphans", "--resume"].includes(flag)
  );
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown option: ${unknownFlags[0]}`);
  }

  return {
    mode: flags.has("--apply") ? "apply" : flags.has("--report") ? "report" : "dry-run",
    deleteOrphans: flags.has("--delete-orphans"),
    resumePath,
  };
}

function timestampLabel(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function csvCell(value) {
  const text = value == null
    ? ""
    : Array.isArray(value) || typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows, columns) {
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

function safePathPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "other";
}

function normalizeStoragePath(value) {
  if (typeof value !== "string") return null;
  let input = value.trim();
  if (!input) return null;

  if (/^gs:\/\//i.test(input)) {
    const remainder = input.slice(5);
    const slash = remainder.indexOf("/");
    if (slash < 0 || remainder.slice(0, slash) !== BUCKET_NAME) return null;
    input = remainder.slice(slash + 1);
  } else if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (url.hostname === "firebasestorage.googleapis.com") {
        const marker = "/o/";
        const index = url.pathname.indexOf(marker);
        if (index < 0) return null;
        const bucket = url.pathname.slice(0, index).split("/").at(-1);
        if (bucket !== BUCKET_NAME) return null;
        input = decodeURIComponent(url.pathname.slice(index + marker.length));
      } else if (url.hostname === "storage.googleapis.com") {
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments[0] !== BUCKET_NAME) return null;
        input = segments.slice(1).map(decodeURIComponent).join("/");
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  input = input.replace(/^\/+/, "");
  if (!input || /[?#\\]/.test(input)) return null;
  return input;
}

function replaceStoragePathValue(originalValue, destinationPath) {
  if (typeof originalValue !== "string") return destinationPath;
  if (/^gs:\/\//i.test(originalValue)) {
    return `gs://${BUCKET_NAME}/${destinationPath}`;
  }
  if (/^https?:\/\//i.test(originalValue)) {
    const url = new URL(originalValue);
    if (url.hostname === "firebasestorage.googleapis.com") {
      url.pathname = `/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(destinationPath)}`;
    } else if (url.hostname === "storage.googleapis.com") {
      url.pathname = `/${BUCKET_NAME}/${destinationPath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
    }
    return url.toString();
  }
  return destinationPath;
}

function getPathRole(fieldName) {
  for (const [pattern, role] of STORAGE_ROLE_BY_FIELD) {
    if (pattern.test(fieldName)) return role;
  }
  return null;
}

function walkObject(value, visit, parts = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkObject(item, visit, [...parts, index]));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childParts = [...parts, key];
    visit(child, key, childParts);
    walkObject(child, visit, childParts);
  }
}

function getAtPath(value, parts) {
  return parts.reduce((current, part) => current?.[part], value);
}

function setAtPath(value, parts, replacement) {
  const parent = getAtPath(value, parts.slice(0, -1));
  if (parent && typeof parent === "object") {
    parent[parts.at(-1)] = replacement;
  }
}

function stringifyPath(parts) {
  return parts.reduce((result, part) => {
    if (typeof part === "number") return `${result}[${part}]`;
    return `${result}.${part}`;
  }, "$");
}

function serializeFirestoreValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) {
    return { __espasyoType: "Date", value: value.toISOString() };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {
      __espasyoType: "Bytes",
      value: Buffer.from(value).toString("base64"),
    };
  }
  if (value instanceof Timestamp) {
    return {
      __espasyoType: "Timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (value instanceof GeoPoint) {
    return {
      __espasyoType: "GeoPoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (typeof value.path === "string" && value.firestore) {
    return { __espasyoType: "DocumentReference", path: value.path };
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      serializeFirestoreValue(child),
    ]),
  );
}

function deserializeFirestoreValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deserializeFirestoreValue);

  if (value.__espasyoType === "Date") return new Date(value.value);
  if (value.__espasyoType === "Bytes") {
    return Buffer.from(value.value, "base64");
  }
  if (value.__espasyoType === "Timestamp") {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  if (value.__espasyoType === "GeoPoint") {
    return new GeoPoint(value.latitude, value.longitude);
  }
  if (value.__espasyoType === "DocumentReference") {
    return adminDb.doc(value.path);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      deserializeFirestoreValue(child),
    ]),
  );
}

function cloneFirestoreValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof Timestamp) {
    return value;
  }
  if (value instanceof GeoPoint) {
    return value;
  }
  if (typeof value.path === "string" && value.firestore) return value;
  if (Array.isArray(value)) return value.map(cloneFirestoreValue);
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      cloneFirestoreValue(child),
    ]),
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const serialized = serializeFirestoreValue(value);
    return `{${Object.keys(serialized).sort().map(
      (key) => `${JSON.stringify(key)}:${stableJson(serialized[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeReportValue(value) {
  if (Array.isArray(value)) return value.map(safeReportValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== TOKEN_KEY)
        .map(([key, child]) => [key, safeReportValue(child)]),
    );
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      url.searchParams.delete("token");
      return url.toString();
    } catch {
      return value;
    }
  }
  return value;
}

function normalizeIdReferences(value, idMap, root = "$") {
  const matches = [];
  const unresolved = [];
  const output = cloneFirestoreValue(value);

  function visit(current, parts, key, finishContext) {
    if (typeof current === "string") {
      const newId = idMap.get(current);
      if (!newId) return;
      const knownAssetId = key === "assetId";
      const knownFinish = finishContext;
      if (knownAssetId || knownFinish) {
        matches.push({ path: stringifyPath(parts), oldId: current, newId });
        setAtPath(output, parts, newId);
      } else {
        unresolved.push({
          path: stringifyPath(parts),
          oldId: current,
          reason: "Asset ID occurs in an unrecognized field.",
        });
      }
      return;
    }
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((child, index) =>
        visit(child, [...parts, index], key, finishContext)
      );
      return;
    }

    for (const [childKey, child] of Object.entries(current)) {
      const childParts = [...parts, childKey];
      const childIsFinish = finishContext ||
        (parts.length === 0 && PROJECT_JSON_ROOT_FIELDS.has(childKey) &&
          (childKey === "floorFinishes" || childKey === "wallFinishes"));
      visit(child, childParts, childKey, childIsFinish);
    }
  }

  const initial = value;
  if (initial && typeof initial === "object" && !Array.isArray(initial)) {
    for (const [key, child] of Object.entries(initial)) {
      const isFinish = key === "floorFinishes" || key === "wallFinishes";
      visit(child, [key], key, isFinish);
    }
  } else {
    visit(initial, [], "", false);
  }

  return { output, matches, unresolved };
}

function collectAllStrings(value, strings = []) {
  if (typeof value === "string") {
    strings.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((child) => collectAllStrings(child, strings));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((child) => collectAllStrings(child, strings));
  }
  return strings;
}

async function assertFirebaseTarget() {
  const currentApp = getApp();
  if (adminStorage.name !== BUCKET_NAME) {
    throw new Error(
      `Configured bucket ${adminStorage.name} does not match ${BUCKET_NAME}.`,
    );
  }

  const serviceAccountPath = path.join(ROOT, "serviceAccountKey.json");
  const credentials = JSON.parse(await fs.readFile(serviceAccountPath, "utf8"));
  if (credentials.project_id !== PROJECT_ID) {
    throw new Error(
      `Configured service account project ${credentials.project_id} does not match ${PROJECT_ID}.`,
    );
  }
  if (currentApp.options.projectId && currentApp.options.projectId !== PROJECT_ID) {
    throw new Error(
      `Initialized Firebase project ${currentApp.options.projectId} does not match ${PROJECT_ID}.`,
    );
  }
}

async function scanFirestore() {
  const documents = [];
  const visited = new Set();

  async function readCollection(collectionReference, rootCollection) {
    if (visited.has(collectionReference.path)) return;
    visited.add(collectionReference.path);
    const snapshot = await collectionReference.get();

    for (const document of snapshot.docs) {
      documents.push({
        path: document.ref.path,
        id: document.id,
        rootCollection,
        data: document.data(),
      });
      const subcollections = await document.ref.listCollections();
      for (const subcollection of subcollections) {
        await readCollection(subcollection, rootCollection);
      }
    }
  }

  const rootCollections = await adminDb.listCollections();
  const collectionSummary = [];
  for (const collectionReference of rootCollections) {
    const before = documents.length;
    await readCollection(collectionReference, collectionReference.id);
    collectionSummary.push({
      name: collectionReference.id,
      documentCount: documents.length - before,
    });
  }

  return { documents, collectionSummary };
}

async function scanStorage() {
  const [files] = await adminStorage.getFiles({ autoPaginate: true });
  const objects = [];
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    objects.push({
      name: file.name,
      size: Number(metadata.size) || 0,
      contentType: metadata.contentType ?? null,
      md5Hash: metadata.md5Hash ?? null,
      crc32c: metadata.crc32c ?? null,
      generation: metadata.generation ?? null,
      metageneration: metadata.metageneration ?? null,
      timeCreated: metadata.timeCreated ?? null,
      updated: metadata.updated ?? null,
      cacheControl: metadata.cacheControl ?? null,
      contentDisposition: metadata.contentDisposition ?? null,
      contentEncoding: metadata.contentEncoding ?? null,
      contentLanguage: metadata.contentLanguage ?? null,
      metadata: metadata.metadata ?? {},
    });
  }
  return objects;
}

async function readProjectJsonObjects(storageObjects) {
  const jsonObjects = [];
  const unresolved = [];
  for (const object of storageObjects) {
    if (!object.name.startsWith("projects/") || !object.name.endsWith(".json")) {
      continue;
    }
    try {
      const [buffer] = await adminStorage.file(object.name).download();
      const data = JSON.parse(buffer.toString("utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Saved project root must be a JSON object.");
      }
      jsonObjects.push({
        path: object.name,
        data,
        bytes: buffer,
        size: buffer.byteLength,
      });
    } catch (error) {
      unresolved.push({
        kind: "saved-project-json",
        path: object.name,
        reason: `Unable to parse saved project JSON: ${error.message}`,
      });
    }
  }
  return { jsonObjects, unresolved };
}

async function allocateIds(assets, occupiedIds = []) {
  const occupied = new Set();
  for (const id of occupiedIds) occupied.add(id);
  for (const asset of assets) {
    if (!TYPE_PREFIX[asset.data.asset_type]) {
      throw new Error(
        `Cannot allocate a migration ID for unsupported asset ${asset.docId} with type ${String(asset.data.asset_type)}.`,
      );
    }
    occupied.add(asset.docId);
  }

  const allocation = [];
  for (const type of ["furniture", "floor", "wall"]) {
    const typeAssets = assets
      .filter((asset) => asset.data.asset_type === type)
      .sort((first, second) => first.docId.localeCompare(second.docId));
    let sequence = 1;

    for (const asset of typeAssets) {
      let candidate;
      while (sequence <= MAX_SEQUENCE) {
        candidate = `${TYPE_PREFIX[type]}-${String(sequence).padStart(3, "0")}${CURRENT_YEAR}`;
        sequence += 1;
        if (!occupied.has(candidate)) break;
        candidate = null;
      }
      if (!candidate) {
        throw new Error(
          `${type} needs more than ${MAX_SEQUENCE} IDs for year 20${CURRENT_YEAR}, or all IDs are occupied.`,
        );
      }
      occupied.add(candidate);
      allocation.push({
        oldId: asset.docId,
        newId: candidate,
        type,
        sequence: Number(candidate.match(/-(\d{3})\d{2}$/)?.[1]),
        year: `20${CURRENT_YEAR}`,
      });
    }
  }

  return allocation;
}

function flattenAssetPathFields(data) {
  const paths = [];
  walkObject(data, (value, key, parts) => {
    if (typeof value !== "string" || !ASSET_PATH_FIELD.test(key)) return;
    const normalized = normalizeStoragePath(value);
    if (!normalized) {
      if (/^https?:\/\//i.test(value) || /^gs:\/\//i.test(value)) {
        paths.push({ field: stringifyPath(parts), parts, value, normalized: null });
      }
      return;
    }
    paths.push({ field: stringifyPath(parts), parts, value, normalized });
  });
  return paths;
}

function extensionForObject(object) {
  const extension = path.posix.extname(object.name).toLowerCase();
  if (extension) return extension;
  const byContentType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "model/gltf-binary": ".glb",
  };
  return byContentType[object.contentType] ?? null;
}

function roleForObject(object, fields, type) {
  const actualRole = object.contentType === "model/gltf-binary" ||
      /\.glb$/i.test(object.name)
    ? "model"
    : object.contentType?.startsWith("image/")
      ? null
      : null;
  if (actualRole) return actualRole;

  const roles = [...new Set(fields.map((field) => getPathRole(field)))].filter(Boolean);
  if (roles.length === 1) return roles[0];
  if (roles.includes("diffuse") && object.contentType?.startsWith("image/")) {
    return "diffuse";
  }
  if (roles.length > 1 && roles.every((role) => role !== "model")) {
    return roles.includes("diffuse") ? "diffuse" : roles[0];
  }
  if (type === "floor" || type === "wall") {
    return object.contentType?.startsWith("image/") ? "diffuse" : null;
  }
  return null;
}

function getAssetTypePrefix(type) {
  if (!TYPE_ROOT[type]) return null;
  return TYPE_ROOT[type];
}

function makeCanonicalPath(asset, newId, role, object) {
  const root = getAssetTypePrefix(asset.data.asset_type);
  const category = safePathPart(asset.data.category);
  const extension = extensionForObject(object);
  if (!root || !extension) return null;
  if (role === "model" && extension !== ".glb") return null;

  const filename = role === "model"
    ? `model${extension}`
    : `${role}${extension}`;
  return `assets/${root}/${category}/${newId}/${filename}`;
}

function validateAsset(asset, pathValues, objectByPath) {
  const data = asset.data;
  const issues = [];
  const warnings = [];
  const type = data.asset_type;
  const validStatus = ["available", "not_available"];
  const supportedTypes = ["furniture", "floor", "wall"];

  if (typeof data.name !== "string" || !data.name.trim()) {
    issues.push("Name is missing or is not a non-empty string.");
  }
  if (!supportedTypes.includes(type)) {
    issues.push(`Unsupported asset_type: ${String(type)}.`);
  }
  if (typeof data.category !== "string" || !data.category.trim()) {
    issues.push("Category is missing or is not a non-empty string.");
  }
  if (typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0) {
    issues.push("Price must be a finite number greater than or equal to zero.");
  }
  if (data.asset_status == null) {
    warnings.push("asset_status is missing; current loaders may exclude this asset.");
  } else if (!validStatus.includes(data.asset_status)) {
    issues.push(`Invalid asset_status: ${String(data.asset_status)}.`);
  }

  if (type === "furniture") {
    const category = String(data.category ?? "").toLowerCase().replace(/[\s_-]+/g, "");
    if (!FURNITURE_CATEGORIES.has(category) && !OPENING_CATEGORIES.has(category)) {
      issues.push("Furniture category is not supported by the server creator or existing asset loaders.");
    } else if (OPENING_CATEGORIES.has(category)) {
      warnings.push("Legacy door/window category is supported by existing loaders but rejected by create-asset.js.");
    }
    const model = pathValues.find(({ field, normalized }) =>
      /model|storage_path/i.test(field) && normalized && objectByPath.has(normalized)
    );
    const modelPath = model?.normalized;
    const modelObject = modelPath ? objectByPath.get(modelPath) : null;
    if (!modelObject || (!/\.glb$/i.test(modelPath) &&
      modelObject.contentType !== "model/gltf-binary")) {
      issues.push("Furniture requires a resolvable GLB model file.");
    }
  }

  if (type === "floor") {
    if (typeof data.length !== "number" || !Number.isFinite(data.length) || data.length <= 0) {
      issues.push("Floor length is missing or is not a positive number.");
    }
    if (typeof data.width !== "number" || !Number.isFinite(data.width) || data.width <= 0) {
      issues.push("Floor width is missing or is not a positive number.");
    }
    const diffuse = pathValues.find(({ field, normalized }) =>
      /diffuse|base.?color/i.test(field) && normalized && objectByPath.has(normalized)
    );
    if (!diffuse) issues.push("Floor requires an existing diffuse texture file.");
  }

  if (type === "wall") {
    const texture = pathValues.find(({ field, normalized }) =>
      /diffuse|base.?color/i.test(field) && normalized && objectByPath.has(normalized)
    );
    if (!texture && !/^#[0-9a-f]{6}$/i.test(data.color ?? "")) {
      issues.push("Wall requires an existing texture file or a six-digit hex color.");
    }
  }

  for (const field of ["roughness", "metalness"]) {
    if (data[field] != null && (
      typeof data[field] !== "number" ||
      !Number.isFinite(data[field]) ||
      data[field] < 0 ||
      data[field] > 1
    )) {
      issues.push(`${field} must be a number between 0 and 1.`);
    }
  }

  for (const item of pathValues) {
    if (!item.normalized) {
      warnings.push(`${item.field} is external or not a URL for the configured Firebase bucket.`);
      continue;
    }
    if (objectByPath.has(item.normalized)) continue;
    const hasChildren = [...objectByPath.keys()].some((objectPath) =>
      objectPath.startsWith(`${item.normalized}/`)
    );
    if (hasChildren && item.field.endsWith(".storage_path")) {
      warnings.push(`${item.field} is a folder prefix, not an object path.`);
    } else {
      issues.push(`${item.field} references a missing Storage object: ${item.normalized}`);
    }
  }

  return { issues: [...new Set(issues)], warnings: [...new Set(warnings)] };
}

function planStorageMappings(assets, idMapping, storageObjects) {
  const objectByPath = new Map(storageObjects.map((object) => [object.name, object]));
  const mappings = [];
  const unresolved = [];
  const assetPathRows = [];
  const repairAliases = new Map();

  for (const asset of assets) {
    const newId = idMapping.get(asset.docId);
    const fields = flattenAssetPathFields(asset.data);
    const existingRows = fields.filter((field) =>
      field.normalized && objectByPath.has(field.normalized)
    );

    for (const field of fields) {
      if (!field.normalized || objectByPath.has(field.normalized)) continue;
      const children = storageObjects.filter((object) =>
        object.name.startsWith(`${field.normalized}/`) && object.size > 0
      );
      if (field.field.endsWith(".storage_path")) {
        const mainCandidates = existingRows.filter((row) => {
          const role = getPathRole(row.parts.at(-1));
          return (asset.data.asset_type === "furniture" && role === "model") ||
            (asset.data.asset_type !== "furniture" && role === "diffuse");
        });
        const distinct = [...new Set(mainCandidates.map((row) => row.normalized))];
        if (distinct.length === 1) {
          repairAliases.set(
            `${asset.docId}\u0000${field.normalized}`,
            distinct[0],
          );
        } else {
          unresolved.push({
            kind: "storage-path",
            assetId: asset.docId,
            field: field.field,
            path: field.normalized,
            reason: children.length > 0
              ? "Directory prefix cannot be repaired to one verified primary file."
              : "No exact Storage object or verifiable directory-prefix repair exists.",
          });
        }
      } else {
        unresolved.push({
          kind: "storage-path",
          assetId: asset.docId,
          field: field.field,
          path: field.normalized,
          reason: "Referenced Storage object does not exist.",
        });
      }
    }

    const bySourcePath = new Map();
    for (const row of existingRows) {
      if (!bySourcePath.has(row.normalized)) bySourcePath.set(row.normalized, []);
      bySourcePath.get(row.normalized).push(row);
    }

    const rowsForAsset = [];
    const rolesSeen = new Map();
    for (const [sourcePath, references] of bySourcePath) {
      const object = objectByPath.get(sourcePath);
      const roles = references.map((reference) =>
        getPathRole(String(reference.parts.at(-1)))
      );
      const role = roleForObject(object, roles, asset.data.asset_type);
      if (!role) {
        unresolved.push({
          kind: "storage-path",
          assetId: asset.docId,
          path: sourcePath,
          fields: references.map((reference) => reference.field),
          reason: "File role or canonical extension cannot be determined safely.",
        });
        continue;
      }

      if (!rolesSeen.has(role)) rolesSeen.set(role, new Set());
      rolesSeen.get(role).add(sourcePath);
      const destination = makeCanonicalPath(asset, newId, role, object);
      if (!destination) {
        unresolved.push({
          kind: "storage-path",
          assetId: asset.docId,
          path: sourcePath,
          fields: references.map((reference) => reference.field),
          reason: `Cannot assign a real filename and extension for role ${role}.`,
        });
        continue;
      }

      const row = {
        assetId: asset.docId,
        newAssetId: newId,
        assetType: asset.data.asset_type,
        category: asset.data.category ?? null,
        role,
        sourcePath,
        destinationPath: destination,
        fields: references.map((reference) => reference.field),
        size: object.size,
        contentType: object.contentType,
        md5Hash: object.md5Hash,
        crc32c: object.crc32c,
        targetExists: objectByPath.has(destination),
        copyVerified: false,
        repair: false,
      };
      mappings.push(row);
      rowsForAsset.push(row);
    }

    for (const [role, paths] of rolesSeen) {
      if (paths.size > 1) {
        unresolved.push({
          kind: "storage-role-conflict",
          assetId: asset.docId,
          role,
          paths: [...paths],
          reason: "Multiple distinct files are assigned to one field role; no file will be chosen arbitrarily.",
        });
      }
    }

    for (const field of fields) {
      const aliasSource = repairAliases.get(
        `${asset.docId}\u0000${field.normalized}`,
      );
      if (!aliasSource) continue;
      const fileMapping = rowsForAsset.find((row) => row.sourcePath === aliasSource);
      if (fileMapping) {
        mappings.push({
          ...fileMapping,
          sourcePath: field.normalized,
          fields: [field.field],
          repair: true,
          repairFrom: aliasSource,
        });
      }
    }

    assetPathRows.push({
      assetId: asset.docId,
      newAssetId: newId,
      references: fields.map((field) => ({
        field: field.field,
        originalValue: safeReportValue(field.value),
        storagePath: field.normalized,
        exists: field.normalized ? objectByPath.has(field.normalized) : false,
        repairPath: repairAliases.get(
          `${asset.docId}\u0000${field.normalized}`,
        ) ?? null,
      })),
    });
  }

  const destinationOwners = new Map();
  for (const row of mappings.filter((mapping) => !mapping.repair)) {
    if (!destinationOwners.has(row.destinationPath)) {
      destinationOwners.set(row.destinationPath, []);
    }
    destinationOwners.get(row.destinationPath).push(row);
  }
  for (const [destination, owners] of destinationOwners) {
    if (owners.length > 1) {
      unresolved.push({
        kind: "canonical-path-collision",
        path: destination,
        reason: "More than one distinct source is assigned to the same canonical object path.",
      });
    }
  }

  return {
    mappings,
    assetPathRows,
    unresolved,
    objectByPath,
    repairAliases,
  };
}

function makeIdMappingRows(assets, allocation) {
  const assetById = new Map(assets.map((asset) => [asset.docId, asset]));
  return allocation.map((entry) => {
    const asset = assetById.get(entry.oldId);
    return {
      oldDocumentId: entry.oldId,
      oldIdField: asset?.data.id ?? null,
      newDocumentId: entry.newId,
      newIdField: entry.newId,
      assetType: entry.type,
      name: asset?.data.name ?? null,
      category: asset?.data.category ?? null,
      sequence: entry.sequence,
      year: entry.year,
      referencesFound: 0,
      targetExists: false,
    };
  });
}

function findProjectIdReferences(
  projectJsonObjects,
  firestoreDocuments,
  idMap,
  storageMappings,
) {
  const references = [];
  const unresolved = [];
  const projectJsonUpdates = [];

  for (const object of projectJsonObjects) {
    const result = normalizeIdReferences(object.data, idMap);
    const pathResult = pathReferenceTransformer(result.output, storageMappings);
    for (const match of result.matches) {
      references.push({
        location: "saved-project-json",
        documentPath: object.path,
        field: match.path,
        oldId: match.oldId,
        newId: match.newId,
      });
    }
    unresolved.push(...[...result.unresolved, ...pathResult.unresolved].map((issue) => ({
      ...issue,
      location: "saved-project-json",
      documentPath: object.path,
    })));
    if (result.matches.length > 0 || pathResult.matches.length > 0) {
      projectJsonUpdates.push({
        path: object.path,
        referenceCount: result.matches.length,
        pathReferenceCount: pathResult.matches.length,
        oldMd5Hash: null,
        contentWillBeUpdated: true,
      });
    }
  }

  const firestoreUpdates = [];
  for (const document of firestoreDocuments) {
    if (document.rootCollection === ASSETS_COLLECTION) continue;
    const result = normalizeIdReferences(document.data, idMap);
    const pathResult = pathReferenceTransformer(result.output, storageMappings);
    for (const match of result.matches) {
      references.push({
        location: "firestore",
        documentPath: document.path,
        field: match.path,
        oldId: match.oldId,
        newId: match.newId,
      });
    }
    unresolved.push(...[...result.unresolved, ...pathResult.unresolved].map((issue) => ({
      ...issue,
      location: "firestore",
      documentPath: document.path,
    })));
    if (result.matches.length > 0 || pathResult.matches.length > 0) {
      firestoreUpdates.push({
        path: document.path,
        rootCollection: document.rootCollection,
        referenceCount: result.matches.length,
        pathReferenceCount: pathResult.matches.length,
      });
    }
  }

  return { references, unresolved, projectJsonUpdates, firestoreUpdates };
}

async function scanStaticCodeReferences(idMapping) {
  const occurrences = [];
  const unresolved = [];
  const files = [];

  async function listSourceFiles(directory, relativeDirectory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const paths = [];
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (SOURCE_IGNORED_DIRECTORIES.has(entry.name)) continue;
        paths.push(...await listSourceFiles(absolutePath, relativePath));
      } else if (entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        paths.push(relativePath);
      }
    }
    return paths;
  }

  const sourceFiles = [];
  for (const relativeRoot of SOURCE_ROOTS) {
    const absoluteRoot = path.join(REPOSITORY_ROOT, relativeRoot);
    try {
      sourceFiles.push(...await listSourceFiles(absoluteRoot, relativeRoot));
    } catch (error) {
      unresolved.push({
        kind: "source-reference",
        file: relativeRoot,
        reason: `Unable to inspect application source: ${error.message}`,
      });
    }
  }

  for (const relativePath of sourceFiles) {
    const contents = await fs.readFile(
      path.join(REPOSITORY_ROOT, relativePath),
      "utf8",
    );
    const lines = contents.split(/\r?\n/);
    const declarations = new Map();
    const declarationPattern = /DEFAULT_FLOOR_MATERIAL_ID\s*=\s*(["'])(.*?)\1/g;
    for (const match of contents.matchAll(declarationPattern)) {
      const line = contents.slice(0, match.index).split(/\r?\n/).length;
      declarations.set(match[2], line);
    }

    const fileReferences = [];
    for (const [oldId, newId] of idMapping) {
      lines.forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, "").trim();
        if (!code.includes(oldId)) return;
        const declarationLine = declarations.get(oldId);
        const recognized = declarationLine != null &&
          Math.abs(declarationLine - (index + 1)) <= 1;
        const row = {
          file: relativePath,
          line: index + 1,
          oldId,
          newId,
          recognizedReference: recognized,
          sourceLine: line.trim(),
        };
        occurrences.push(row);
        if (recognized) fileReferences.push(row);
        else unresolved.push({
          kind: "source-reference",
          ...row,
          reason: "Asset ID occurs in executable code outside a verified default-floor constant.",
        });
      });
    }

    if (fileReferences.length > 0) {
      files.push({ path: relativePath, referenceCount: fileReferences.length });
    }
  }

  return { occurrences, unresolved, files };
}

function buildDuplicateCandidates(storageObjects) {
  const byHash = new Map();
  for (const object of storageObjects) {
    if (!object.name.startsWith("assets/") || object.name.endsWith("/")) continue;
    const hash = object.md5Hash && object.crc32c
      ? `${object.size}\u0000${object.md5Hash}\u0000${object.crc32c}`
      : null;
    if (!hash) continue;
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(object);
  }

  return [...byHash.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      size: group[0].size,
      md5Hash: group[0].md5Hash,
      crc32c: group[0].crc32c,
      paths: group.map((object) => object.name),
      candidateOnly: true,
      deletionApproved: false,
      reason: "Matching Cloud Storage MD5 and CRC32C metadata; references and canonical copies still require verification.",
    }));
}

function buildDeletionCandidates(storageObjects, allReferencedPaths, mappings) {
  const bySource = new Map();
  for (const mapping of mappings.filter((item) => !item.repair)) {
    if (!bySource.has(mapping.sourcePath)) bySource.set(mapping.sourcePath, []);
    bySource.get(mapping.sourcePath).push(mapping);
  }

  return storageObjects
    .filter((object) => object.name.startsWith("assets/") && !object.name.endsWith("/"))
    .map((object) => {
      const copies = bySource.get(object.name) ?? [];
      const referenced = allReferencedPaths.has(object.name);
      const replacementPlanExists = copies.length > 0;
      return {
        path: object.name,
        size: object.size,
        md5Hash: object.md5Hash,
        crc32c: object.crc32c,
        currentlyReferenced: referenced,
        plannedReplacementPaths: copies.map((copy) => copy.destinationPath),
        replacementVerified: false,
        eligibleAfterApply: replacementPlanExists && referenced &&
          copies.every((copy) => copy.md5Hash && copy.crc32c),
        deletionScheduled: false,
        reason: replacementPlanExists
          ? "Can be considered only after every replacement and reference update is verified."
          : referenced
            ? "Referenced object has no planned verified replacement."
            : "Unreferenced asset-scope object has no replacement; retained conservatively.",
      };
    });
}

function collectReferencedStoragePaths(documents, projectJsonObjects) {
  const referenced = new Set();
  const add = (value) => {
    if (typeof value !== "string") return;
    const normalized = normalizeStoragePath(value);
    if (normalized) referenced.add(normalized);
  };

  documents.forEach((document) => collectAllStrings(document.data).forEach(add));
  projectJsonObjects.forEach((object) =>
    collectAllStrings(object.data).forEach(add)
  );
  return referenced;
}

function buildAuditReport({
  assets,
  collectionSummary,
  storageObjects,
  projectJsonObjects,
  projectJsonUnresolved,
  idRows,
  storagePlan,
  idReferences,
  staticReferences,
  duplicateCandidates,
  unresolved,
  allReferencedPaths,
  mode,
}) {
  const objectByPath = storagePlan.objectByPath;
  const validation = assets.map((asset) => {
    const paths = flattenAssetPathFields(asset.data);
    const result = validateAsset(asset, paths, objectByPath);
    const temporaryDimensions = asset.data.asset_type === "floor" &&
      (
        typeof asset.data.length !== "number" ||
        !Number.isFinite(asset.data.length) ||
        asset.data.length <= 0 ||
        typeof asset.data.width !== "number" ||
        !Number.isFinite(asset.data.width) ||
        asset.data.width <= 0
      )
      ? {
          length: typeof asset.data.length === "number" &&
            Number.isFinite(asset.data.length) && asset.data.length > 0
            ? asset.data.length
            : 1,
          width: typeof asset.data.width === "number" &&
            Number.isFinite(asset.data.width) && asset.data.width > 0
            ? asset.data.width
            : 1,
          dimensionsArePlaceholder: true,
          units: "meters",
        }
      : null;
    return {
      documentId: asset.docId,
      idField: asset.data.id ?? null,
      assetType: asset.data.asset_type ?? null,
      name: asset.data.name ?? null,
      category: asset.data.category ?? null,
      status: asset.data.asset_status ?? null,
      fieldsPresent: Object.keys(asset.data),
      issueCount: result.issues.length,
      issues: result.issues,
      warnings: result.warnings,
      plannedTemporaryDimensions: temporaryDimensions,
    };
  });

  const typeCounts = Object.fromEntries(
    ["furniture", "floor", "wall"].map((type) => [
      type,
      assets.filter((asset) => asset.data.asset_type === type).length,
    ]),
  );
  const idUseCount = new Map();
  for (const reference of idReferences.references) {
    idUseCount.set(reference.oldId, (idUseCount.get(reference.oldId) ?? 0) + 1);
  }
  for (const row of idRows) row.referencesFound = idUseCount.get(row.oldDocumentId) ?? 0;

  const sourcePaths = new Set(storageObjects.map((object) => object.name));
  const pathReferences = [];
  const missingPaths = [];
  for (const asset of assets) {
    for (const field of flattenAssetPathFields(asset.data)) {
      if (!field.normalized) continue;
      const exists = sourcePaths.has(field.normalized);
      const childCount = storageObjects.filter((object) =>
        object.name.startsWith(`${field.normalized}/`) && object.size > 0
      ).length;
      const repairPath = storagePlan.repairAliases.get(
        `${asset.docId}\u0000${field.normalized}`,
      ) ?? null;
      const row = {
        documentId: asset.docId,
        assetId: asset.data.id ?? asset.docId,
        name: asset.data.name ?? null,
        assetType: asset.data.asset_type ?? null,
        category: asset.data.category ?? null,
        field: field.field,
        path: field.normalized,
        exists,
        isDirectoryPrefix: !exists && childCount > 0,
        verifiedRepairPath: repairPath,
      };
      pathReferences.push(row);
      if (!exists && !repairPath) missingPaths.push(row);
    }
  }

  const assetObjects = storageObjects.filter((object) =>
    object.name.startsWith("assets/")
  );
  const duplicateReferenceGroups = new Map();
  for (const asset of assets) {
    for (const field of flattenAssetPathFields(asset.data)) {
      if (!field.normalized || !sourcePaths.has(field.normalized)) continue;
      if (!duplicateReferenceGroups.has(field.normalized)) {
        duplicateReferenceGroups.set(field.normalized, []);
      }
      duplicateReferenceGroups.get(field.normalized).push({
        documentId: asset.docId,
        field: field.field,
      });
    }
  }
  const deletionCandidates = buildDeletionCandidates(
    storageObjects,
    allReferencedPaths,
    storagePlan.mappings,
  );

  return {
    generatedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    collection: ASSETS_COLLECTION,
    mode,
    summary: {
      firestoreDocuments: assets.length,
      storageObjects: storageObjects.length,
      assetStorageObjects: assetObjects.length,
      assetStorageBytes: assetObjects.reduce((sum, object) => sum + object.size, 0),
      projectsJsonFilesInspected: projectJsonObjects.length,
      assetsByType: typeCounts,
      idsToMigrate: idRows.length,
      verifiedIdReferences: idReferences.references.length,
      sourceCodeReferences: staticReferences.occurrences.filter(
        (reference) => reference.recognizedReference
      ).length,
      storagePathReferences: pathReferences.length,
      missingStoragePathReferences: missingPaths.length,
      directoryPrefixRepairs: pathReferences.filter(
        (reference) => reference.verifiedRepairPath
      ).length,
      validationIssues: validation.reduce((sum, row) => sum + row.issueCount, 0),
      validationWarnings: validation.reduce((sum, row) => sum + row.warnings.length, 0),
      temporaryDimensionPlaceholders: validation.filter(
        (row) => row.plannedTemporaryDimensions,
      ).length,
      duplicateContentGroups: duplicateCandidates.length,
      duplicateReferenceGroups: [...duplicateReferenceGroups.values()].filter(
        (group) => group.length > 1
      ).length,
      unresolvedReferences: unresolved.length,
      deletionCandidates: deletionCandidates.length,
      firestoreCollections: collectionSummary,
    },
    assets: validation,
    storageInventory: storageObjects.map((object) => ({
      ...object,
      metadata: safeReportValue(object.metadata),
      downloadTokenPresent: Boolean(object.metadata?.[TOKEN_KEY]),
    })),
    pathReferences,
    idMapping: idRows,
    storagePathMapping: storagePlan.mappings,
    duplicateCandidates,
    duplicateReferenceGroups: [...duplicateReferenceGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([storagePath, references]) => ({ storagePath, references })),
    projectJsonUpdates: idReferences.projectJsonUpdates,
    firestoreReferenceUpdates: idReferences.firestoreUpdates,
    sourceCodeReferences: staticReferences.occurrences,
    unresolvedReferences: unresolved,
    deletionCandidates,
  };
}

async function writeReportFiles(report, outputDirectory) {
  await fs.mkdir(outputDirectory, { recursive: true });
  const outputs = [
    ["audit.json", report],
    ["id-mapping.json", report.idMapping],
    ["storage-path-mapping.json", report.storagePathMapping],
    ["duplicate-candidates.json", report.duplicateCandidates],
    ["unresolved-references.json", report.unresolvedReferences],
    ["deletions.json", report.deletionCandidates],
  ];
  await Promise.all(outputs.map(([name, value]) =>
    fs.writeFile(
      path.join(outputDirectory, name),
      JSON.stringify(safeReportValue(value), null, 2),
      "utf8",
    )
  ));
  await Promise.all([
    fs.writeFile(
      path.join(outputDirectory, "audit.csv"),
      toCsv([{
        generatedAt: report.generatedAt,
        projectId: report.projectId,
        bucket: report.bucket,
        summary: report.summary,
      }], ["generatedAt", "projectId", "bucket", "summary"]),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "id-mapping.csv"),
      toCsv(report.idMapping, [
        "oldDocumentId", "oldIdField", "newDocumentId", "newIdField",
        "assetType", "name", "category", "sequence", "year", "referencesFound",
      ]),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "duplicate-candidates.csv"),
      toCsv(report.duplicateCandidates, [
        "size", "md5Hash", "crc32c", "paths", "candidateOnly",
        "deletionApproved", "reason",
      ]),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "unresolved-references.csv"),
      toCsv(report.unresolvedReferences, [
        "kind", "location", "documentPath", "file", "line", "assetId",
        "field", "path", "sourcePath", "reason",
      ]),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "deletions.csv"),
      toCsv(report.deletionCandidates, [
        "path", "size", "md5Hash", "crc32c", "currentlyReferenced",
        "plannedReplacementPaths", "replacementVerified", "eligibleAfterApply",
        "deletionScheduled", "reason",
      ]),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "storage-path-mapping.csv"),
      toCsv(report.storagePathMapping, [
        "assetId", "newAssetId", "assetType", "category", "role",
        "sourcePath", "destinationPath", "fields", "size", "contentType",
        "md5Hash", "crc32c", "repair", "repairFrom", "copyVerified",
      ]),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "path-audit.csv"),
      toCsv(report.pathReferences, [
        "documentId", "assetId", "name", "assetType", "category",
        "field", "path", "exists", "isDirectoryPrefix", "verifiedRepairPath",
      ]),
      "utf8",
    ),
  ]);
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temporaryPath, filePath);
}

async function buildPlan(mode) {
  const { documents, collectionSummary } = await scanFirestore();
  const storageObjects = await scanStorage();
  const { jsonObjects, unresolved: projectJsonUnresolved } =
    await readProjectJsonObjects(storageObjects);
  const assets = documents
    .filter((document) => document.path.startsWith(`${ASSETS_COLLECTION}/`) &&
      !document.path.slice(ASSETS_COLLECTION.length + 1).includes("/"))
    .map((document) => ({ docId: document.id, data: document.data }))
    .sort((first, second) => first.docId.localeCompare(second.docId));

  const allocation = await allocateIds(
    assets,
    documents.map((document) => document.id),
  );
  const idMapping = new Map(allocation.map((item) => [item.oldId, item.newId]));
  const idRows = makeIdMappingRows(assets, allocation);
  const storagePlan = planStorageMappings(assets, idMapping, storageObjects);
  const idReferences = findProjectIdReferences(
    jsonObjects,
    documents,
    idMapping,
    storagePlan.mappings,
  );
  const staticReferences = await scanStaticCodeReferences(idMapping);
  const duplicateCandidates = buildDuplicateCandidates(storageObjects);
  const allReferencedPaths = collectReferencedStoragePaths(documents, jsonObjects);
  const unresolved = [
    ...projectJsonUnresolved,
    ...storagePlan.unresolved,
    ...idReferences.unresolved,
    ...staticReferences.unresolved,
    ...storagePlan.mappings
      .filter((mapping) => mapping.targetExists && !mapping.repair)
      .map((mapping) => ({
        kind: "canonical-path-collision",
        assetId: mapping.assetId,
        path: mapping.destinationPath,
        reason: "Canonical destination already exists; it will not be overwritten.",
      })),
  ];

  const report = buildAuditReport({
    assets,
    collectionSummary,
    storageObjects,
    projectJsonObjects: jsonObjects,
    projectJsonUnresolved,
    idRows,
    storagePlan,
    idReferences,
    staticReferences,
    duplicateCandidates,
    unresolved,
    allReferencedPaths,
    mode,
  });

  return {
    assets,
    documents,
    storageObjects,
    projectJsonObjects: jsonObjects,
    collectionSummary,
    allocation,
    idMapping,
    idRows,
    storagePlan,
    idReferences,
    staticReferences,
    duplicateCandidates,
    allReferencedPaths,
    unresolved,
    report,
  };
}

async function writeBackup(plan, runId) {
  const backupRoot = path.join(AUDIT_ROOT, "backups");
  await fs.mkdir(backupRoot, { recursive: true });
  const backupDirectory = path.join(backupRoot, `asset-migration-${runId}`);
  await fs.mkdir(backupDirectory);

  const firestoreReferencePaths = new Set(
    plan.idReferences.firestoreUpdates.map((item) => item.path),
  );
  const firestoreBackupDocuments = plan.documents.filter((document) =>
    document.rootCollection === ASSETS_COLLECTION ||
    firestoreReferencePaths.has(document.path)
  );
  const projectJsonBackup = plan.projectJsonObjects
    .filter((object) => plan.idReferences.projectJsonUpdates.some(
      (update) => update.path === object.path
    ))
    .map((object) => ({
      path: object.path,
      bytesBase64: object.bytes.toString("base64"),
      size: object.bytes.byteLength,
    }));
  const sourceCodeBackup = [];
  for (const file of plan.staticReferences.files) {
    const absolutePath = path.join(REPOSITORY_ROOT, file.path);
    sourceCodeBackup.push({
      path: file.path,
      contentsBase64: (await fs.readFile(absolutePath)).toString("base64"),
    });
  }

  const docsFile = path.join(backupDirectory, "firestore-documents.json");
  const projectsFile = path.join(backupDirectory, "saved-project-json.json");
  const codeFile = path.join(backupDirectory, "source-files.json");
  await fs.writeFile(
    docsFile,
    JSON.stringify(firestoreBackupDocuments.map((document) => ({
      path: document.path,
      rootCollection: document.rootCollection,
      data: serializeFirestoreValue(document.data),
    })), null, 2),
    "utf8",
  );
  await fs.writeFile(projectsFile, JSON.stringify(projectJsonBackup, null, 2), "utf8");
  await fs.writeFile(codeFile, JSON.stringify(sourceCodeBackup, null, 2), "utf8");

  const checksums = {};
  for (const file of [docsFile, projectsFile, codeFile]) {
    const contents = await fs.readFile(file);
    checksums[path.basename(file)] = crypto
      .createHash("sha256")
      .update(contents)
      .digest("hex");
  }

  const manifest = {
    version: 1,
    runId,
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    createdAt: new Date().toISOString(),
    backupCompleted: true,
    progress: {
      phase: "backup-complete",
      copyIntendedStoragePaths: [],
      copiedStoragePaths: [],
      createdAssetIds: [],
      updatedFirestoreDocuments: [],
      updatedProjectJsonPaths: [],
      updatedSourceFiles: [],
      deletedOldAssetIds: [],
      deletedStoragePaths: [],
    },
    checksums,
    plan: {
      idMapping: plan.idRows,
      storagePathMapping: plan.storagePlan.mappings,
      projectJsonUpdates: plan.idReferences.projectJsonUpdates,
      firestoreReferenceUpdates: plan.idReferences.firestoreUpdates,
      sourceCodeReferences: plan.staticReferences.files,
      duplicateCandidates: plan.duplicateCandidates,
      deletionCandidates: plan.report.deletionCandidates,
      unresolvedReferences: plan.unresolved,
    },
  };

  const manifestPath = path.join(backupDirectory, "migration-manifest.json");
  await writeJsonAtomic(manifestPath, manifest);
  return { backupDirectory, manifestPath, manifest };
}

async function loadVerifiedBackup(backupDirectory, manifest) {
  const expectedFiles = new Set([
    "firestore-documents.json",
    "saved-project-json.json",
    "source-files.json",
  ]);
  for (const [filename, expectedChecksum] of Object.entries(manifest.checksums ?? {})) {
    if (!expectedFiles.has(filename)) {
      throw new Error(`Unexpected backup file listed in manifest: ${filename}`);
    }
    const contents = await fs.readFile(path.join(backupDirectory, filename));
    const checksum = crypto.createHash("sha256").update(contents).digest("hex");
    if (checksum !== expectedChecksum) {
      throw new Error(`Backup checksum verification failed: ${filename}`);
    }
  }
  if (Object.keys(manifest.checksums ?? {}).length !== expectedFiles.size) {
    throw new Error("Resume backup is missing one or more checksum entries.");
  }

  const documents = JSON.parse(await fs.readFile(
    path.join(backupDirectory, "firestore-documents.json"),
    "utf8",
  ));
  return documents.map((document) => ({
    ...document,
    data: deserializeFirestoreValue(document.data),
  }));
}

function makeNewAssetData(asset, newId, mappings) {
  const output = cloneFirestoreValue(asset.data);
  output.id = newId;
  if (output.asset_type === "floor") {
    const lengthIsInvalid =
      typeof output.length !== "number" ||
      !Number.isFinite(output.length) ||
      output.length <= 0;
    const widthIsInvalid =
      typeof output.width !== "number" ||
      !Number.isFinite(output.width) ||
      output.width <= 0;

    if (lengthIsInvalid || widthIsInvalid) {
      if (lengthIsInvalid) output.length = 1;
      if (widthIsInvalid) output.width = 1;
      output.dimensions_are_placeholder = true;
    }
  }
  const rows = mappings.filter((mapping) =>
    mapping.assetId === asset.docId
  );
  const bySource = new Map(
    rows.map((row) => [row.sourcePath, row.destinationPath]),
  );
  const repaired = new Map(
    rows.filter((row) => row.repair).map((row) => [
      row.sourcePath,
      row.destinationPath,
    ]),
  );

  walkObject(output, (value, key, parts) => {
    if (typeof value !== "string" || !ASSET_PATH_FIELD.test(key)) return;
    const normalized = normalizeStoragePath(value);
    if (!normalized) return;
    const destination = bySource.get(normalized) ?? repaired.get(normalized);
    if (destination) {
      setAtPath(output, parts, replaceStoragePathValue(value, destination));
    }
  });

  return output;
}

function pathReferenceTransformer(data, mappings) {
  const output = cloneFirestoreValue(data);
  const bySource = new Map();
  for (const mapping of mappings) {
    if (!bySource.has(mapping.sourcePath)) bySource.set(mapping.sourcePath, new Set());
    bySource.get(mapping.sourcePath).add(mapping.destinationPath);
  }
  const matches = [];
  const unresolved = [];
  const destinations = new Set(mappings.map((mapping) => mapping.destinationPath));
  walkObject(output, (value, key, parts) => {
    if (typeof value !== "string" || !ASSET_PATH_FIELD.test(key)) return;
    const source = normalizeStoragePath(value);
    if (!source) return;
    if (!bySource.has(source)) {
      if (source.startsWith("assets/") && !destinations.has(source)) {
        unresolved.push({
          path: stringifyPath(parts),
          sourcePath: source,
          reason: "Asset-scope Storage path has no verified asset mapping.",
        });
      }
      return;
    }
    const destinations = [...bySource.get(source)];
    if (destinations.length !== 1) {
      unresolved.push({
        path: stringifyPath(parts),
        sourcePath: source,
        reason: "Storage path has multiple asset-specific canonical destinations.",
      });
      return;
    }
    setAtPath(
      output,
      parts,
      replaceStoragePathValue(value, destinations[0]),
    );
    matches.push({
      path: stringifyPath(parts),
      sourcePath: source,
      destinationPath: destinations[0],
    });
  });
  return { output, matches, unresolved };
}

async function verifyStorageCopy(mapping, allowExisting) {
  const source = adminStorage.file(mapping.sourcePath);
  const target = adminStorage.file(mapping.destinationPath);
  const [sourceMetadata] = await source.getMetadata();
  if (
    Number(sourceMetadata.size) !== mapping.size ||
    (mapping.md5Hash && mapping.md5Hash !== sourceMetadata.md5Hash) ||
    (mapping.crc32c && mapping.crc32c !== sourceMetadata.crc32c)
  ) {
    throw new Error(
      `Source object changed since the migration plan was created: ${mapping.sourcePath}`,
    );
  }

  const [exists] = await target.exists();
  if (exists) {
    if (!allowExisting) {
      throw new Error(`Unexpected canonical Storage destination exists: ${mapping.destinationPath}`);
    }
  } else {
    const token = sourceMetadata.metadata?.[TOKEN_KEY] ?? crypto.randomUUID();
    await source.copy(target, {
      contentType: sourceMetadata.contentType,
      cacheControl: sourceMetadata.cacheControl,
      contentDisposition: sourceMetadata.contentDisposition,
      contentEncoding: sourceMetadata.contentEncoding,
      contentLanguage: sourceMetadata.contentLanguage,
      metadata: {
        ...(sourceMetadata.metadata ?? {}),
        [TOKEN_KEY]: token,
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  }

  if (!sourceMetadata.md5Hash && !sourceMetadata.crc32c) {
    throw new Error(
      `Source object has no checksum metadata for verification: ${mapping.sourcePath}`,
    );
  }
  let [targetMetadata] = await target.getMetadata();
  if (
    Number(sourceMetadata.size) !== Number(targetMetadata.size) ||
    (sourceMetadata.md5Hash && sourceMetadata.md5Hash !== targetMetadata.md5Hash) ||
    (sourceMetadata.crc32c && sourceMetadata.crc32c !== targetMetadata.crc32c)
  ) {
    throw new Error(`Copied Storage object failed checksum verification: ${mapping.destinationPath}`);
  }

  if (
    (sourceMetadata.contentType ?? null) !== (targetMetadata.contentType ?? null) ||
    (sourceMetadata.cacheControl ?? null) !== (targetMetadata.cacheControl ?? null) ||
    (sourceMetadata.contentDisposition ?? null) !==
      (targetMetadata.contentDisposition ?? null) ||
    (sourceMetadata.contentEncoding ?? null) !==
      (targetMetadata.contentEncoding ?? null) ||
    (sourceMetadata.contentLanguage ?? null) !==
      (targetMetadata.contentLanguage ?? null)
  ) {
    if (!allowExisting) {
      throw new Error(
        `Copied Storage metadata verification failed: ${mapping.destinationPath}`,
      );
    }
    await target.setMetadata({
      contentType: sourceMetadata.contentType,
      cacheControl: sourceMetadata.cacheControl,
      contentDisposition: sourceMetadata.contentDisposition,
      contentEncoding: sourceMetadata.contentEncoding,
      contentLanguage: sourceMetadata.contentLanguage,
      metadata: {
        ...(sourceMetadata.metadata ?? {}),
        [TOKEN_KEY]: sourceMetadata.metadata?.[TOKEN_KEY] ??
          targetMetadata.metadata?.[TOKEN_KEY] ??
          crypto.randomUUID(),
      },
    });
    [targetMetadata] = await target.getMetadata();
  }

  if (
    (sourceMetadata.contentType ?? null) !== (targetMetadata.contentType ?? null) ||
    (sourceMetadata.cacheControl ?? null) !== (targetMetadata.cacheControl ?? null) ||
    (sourceMetadata.contentDisposition ?? null) !==
      (targetMetadata.contentDisposition ?? null) ||
    (sourceMetadata.contentEncoding ?? null) !==
      (targetMetadata.contentEncoding ?? null) ||
    (sourceMetadata.contentLanguage ?? null) !==
      (targetMetadata.contentLanguage ?? null)
  ) {
    throw new Error(
      `Copied Storage metadata failed verification: ${mapping.destinationPath}`,
    );
  }
  return true;
}

async function createAndVerifyNewAssets(plan, manifest, manifestPath) {
  const assetById = new Map(plan.assets.map((asset) => [asset.docId, asset]));
  const targetByOldId = new Map(
    plan.idRows.map((row) => [row.oldDocumentId, row.newDocumentId]),
  );
  const mappings = plan.storagePlan.mappings;

  for (const mapping of mappings.filter((item) => !item.repair)) {
    const wasCopied = manifest.progress.copiedStoragePaths.includes(
      mapping.destinationPath,
    );
    const wasIntended = manifest.progress.copyIntendedStoragePaths?.includes(
      mapping.destinationPath,
    ) ?? false;
    if (!wasCopied && !wasIntended) {
      manifest.progress.copyIntendedStoragePaths ??= [];
      manifest.progress.copyIntendedStoragePaths.push(mapping.destinationPath);
      await writeJsonAtomic(manifestPath, manifest);
    }
    await verifyStorageCopy(mapping, wasCopied || wasIntended);
    if (!wasCopied) {
      manifest.progress.copiedStoragePaths.push(mapping.destinationPath);
      await writeJsonAtomic(manifestPath, manifest);
    }
    mapping.copyVerified = true;
  }
  manifest.progress.phase = "storage-copies-verified";
  await writeJsonAtomic(manifestPath, manifest);

  for (const row of plan.idRows) {
    const oldRef = adminDb.collection(ASSETS_COLLECTION).doc(row.oldDocumentId);
    const newRef = adminDb.collection(ASSETS_COLLECTION).doc(row.newDocumentId);
    const oldId = row.oldDocumentId;
    const newId = targetByOldId.get(oldId);
    const asset = assetById.get(oldId);
    const newData = makeNewAssetData(asset, newId, mappings);

    await adminDb.runTransaction(async (transaction) => {
      const [oldSnapshot, newSnapshot] = await Promise.all([
        transaction.get(oldRef),
        transaction.get(newRef),
      ]);
      if (!oldSnapshot.exists) {
        if (newSnapshot.exists && newSnapshot.get("id") === newId) return;
        throw new Error(`Original asset disappeared before migration: ${oldId}`);
      }
      if (newSnapshot.exists) {
        if (manifest.progress.createdAssetIds.includes(newId) &&
          newSnapshot.get("id") === newId) return;
        throw new Error(`Unexpected Firestore target document exists: ${newId}`);
      }
      transaction.create(newRef, newData);
    });

    const verifiedSnapshot = await newRef.get();
    if (!verifiedSnapshot.exists ||
      stableJson(verifiedSnapshot.data()) !== stableJson(newData)) {
      throw new Error(`Created asset verification failed: ${newId}`);
    }
    if (!manifest.progress.createdAssetIds.includes(newId)) {
      manifest.progress.createdAssetIds.push(newId);
      await writeJsonAtomic(manifestPath, manifest);
    }
  }
  manifest.progress.phase = "new-asset-documents-verified";
  await writeJsonAtomic(manifestPath, manifest);
}

function collectPostMigrationReferencePaths(documents, projectJsonObjects) {
  return collectReferencedStoragePaths(documents, projectJsonObjects);
}

async function updateReferenceDocuments(plan, manifest, manifestPath) {
  const docsByPath = new Map(plan.documents.map((document) => [document.path, document]));
  const idMap = new Map(plan.idRows.map((row) => [
    row.oldDocumentId,
    row.newDocumentId,
  ]));
  const pathUpdates = plan.storagePlan.mappings;

  for (const update of plan.idReferences.firestoreUpdates) {
    if (manifest.progress.updatedFirestoreDocuments.includes(update.path)) continue;
    const document = docsByPath.get(update.path);
    const idResult = normalizeIdReferences(document.data, idMap);
    const pathResult = pathReferenceTransformer(idResult.output, pathUpdates);
    if (idResult.unresolved.length || pathResult.unresolved.length) {
      throw new Error(`Unresolved Firestore reference in ${update.path}; refusing to update.`);
    }
    const reference = adminDb.doc(update.path);
    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (!current.exists) throw new Error(`Reference document disappeared: ${update.path}`);
      const currentResult = normalizeIdReferences(current.data(), idMap);
      const currentPathResult = pathReferenceTransformer(
        currentResult.output,
        pathUpdates,
      );
      transaction.set(reference, currentPathResult.output);
    });
    const verified = await reference.get();
    const verifyIds = normalizeIdReferences(verified.data(), idMap);
    if (verifyIds.matches.length > 0) {
      throw new Error(`Old asset ID remains in Firestore document ${update.path}.`);
    }
    manifest.progress.updatedFirestoreDocuments.push(update.path);
    await writeJsonAtomic(manifestPath, manifest);
  }

  const jsonObjectsByPath = new Map(
    plan.projectJsonObjects.map((object) => [object.path, object]),
  );
  for (const update of plan.idReferences.projectJsonUpdates) {
    if (manifest.progress.updatedProjectJsonPaths.includes(update.path)) continue;
    const stored = jsonObjectsByPath.get(update.path);
    const [currentBuffer] = await adminStorage.file(update.path).download();
    const currentData = JSON.parse(currentBuffer.toString("utf8"));
    const transformed = normalizeIdReferences(currentData, idMap);
    const paths = pathReferenceTransformer(transformed.output, pathUpdates);
    if (transformed.unresolved.length || paths.unresolved.length) {
      throw new Error(`Unresolved saved-project reference in ${update.path}; refusing to write.`);
    }
    const [metadata] = await adminStorage.file(update.path).getMetadata();
    await adminStorage.file(update.path).save(
      Buffer.from(JSON.stringify(paths.output, null, 2)),
      {
        resumable: false,
        metadata: {
          contentType: metadata.contentType ?? "application/json",
          cacheControl: metadata.cacheControl,
          contentDisposition: metadata.contentDisposition,
          contentEncoding: metadata.contentEncoding,
          contentLanguage: metadata.contentLanguage,
          metadata: metadata.metadata ?? {},
        },
      },
    );
    const [verifiedBuffer] = await adminStorage.file(update.path).download();
    const verifiedData = JSON.parse(verifiedBuffer.toString("utf8"));
    const verifyIds = normalizeIdReferences(verifiedData, idMap);
    if (verifyIds.matches.length > 0) {
      throw new Error(`Old asset IDs remain in saved project ${update.path}.`);
    }
    manifest.progress.updatedProjectJsonPaths.push(update.path);
    await writeJsonAtomic(manifestPath, manifest);
  }

  const filesToUpdate = plan.staticReferences.files;
  for (const file of filesToUpdate) {
    if (manifest.progress.updatedSourceFiles.includes(file.path)) continue;
    const absolutePath = path.join(REPOSITORY_ROOT, file.path);
    let contents = await fs.readFile(absolutePath, "utf8");
    for (const reference of plan.staticReferences.occurrences.filter(
      (item) => item.file === file.path && item.recognizedReference
    )) {
      const escaped = reference.oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const assignment = new RegExp(
        `(DEFAULT_FLOOR_MATERIAL_ID\\s*=\\s*["'])${escaped}(["'])`,
      );
      if (!assignment.test(contents)) {
        throw new Error(`Known source reference changed unexpectedly in ${file.path}.`);
      }
      contents = contents.replace(assignment, `$1${reference.newId}$2`);
    }
    await fs.writeFile(absolutePath, contents, "utf8");
    manifest.progress.updatedSourceFiles.push(file.path);
    await writeJsonAtomic(manifestPath, manifest);
  }

  const _storedObjectsWereBackedUp = plan.projectJsonObjects
    .filter((object) => plan.idReferences.projectJsonUpdates.some(
      (update) => update.path === object.path
    ))
    .length;
  void _storedObjectsWereBackedUp;
}

async function verifyAndDeleteOldDocuments(plan, manifest, manifestPath) {
  const mapping = new Map(plan.idRows.map((row) => [
    row.oldDocumentId,
    row.newDocumentId,
  ]));
  const referencedDocuments = [
    ...plan.idReferences.firestoreUpdates.map((item) => item.path),
  ];

  for (const documentPath of referencedDocuments) {
    const snapshot = await adminDb.doc(documentPath).get();
    if (!snapshot.exists) throw new Error(`Updated reference document missing: ${documentPath}`);
    const references = normalizeIdReferences(snapshot.data(), mapping);
    const paths = pathReferenceTransformer(
      snapshot.data(),
      plan.storagePlan.mappings,
    );
    if (references.matches.length || references.unresolved.length ||
      paths.matches.length || paths.unresolved.length) {
      throw new Error(`Asset ID reference verification failed: ${documentPath}`);
    }
  }
  for (const update of plan.idReferences.projectJsonUpdates) {
    const [buffer] = await adminStorage.file(update.path).download();
    const data = JSON.parse(buffer.toString("utf8"));
    const references = normalizeIdReferences(data, mapping);
    const paths = pathReferenceTransformer(data, plan.storagePlan.mappings);
    if (references.matches.length || references.unresolved.length ||
      paths.matches.length || paths.unresolved.length) {
      throw new Error(`Saved project reference verification failed: ${update.path}`);
    }
  }

  for (const row of plan.idRows) {
    if (manifest.progress.deletedOldAssetIds.includes(row.oldDocumentId)) continue;
    const oldRef = adminDb.collection(ASSETS_COLLECTION).doc(row.oldDocumentId);
    const newRef = adminDb.collection(ASSETS_COLLECTION).doc(row.newDocumentId);
    await adminDb.runTransaction(async (transaction) => {
      const [oldSnapshot, newSnapshot] = await Promise.all([
        transaction.get(oldRef),
        transaction.get(newRef),
      ]);
      if (!newSnapshot.exists || newSnapshot.get("id") !== row.newDocumentId) {
        throw new Error(`Verified replacement asset is missing: ${row.newDocumentId}`);
      }
      if (oldSnapshot.exists) transaction.delete(oldRef);
    });
    manifest.progress.deletedOldAssetIds.push(row.oldDocumentId);
    manifest.progress.phase = "old-asset-documents-removed";
    await writeJsonAtomic(manifestPath, manifest);
  }
}

async function deleteVerifiedSources(plan, manifest, manifestPath) {
  const mappingBySource = new Map();
  for (const mapping of plan.storagePlan.mappings.filter((item) => !item.repair)) {
    if (!mappingBySource.has(mapping.sourcePath)) mappingBySource.set(mapping.sourcePath, []);
    mappingBySource.get(mapping.sourcePath).push(mapping);
  }

  const refreshed = await buildPlan("delete-verification");
  const remainingReferences = collectPostMigrationReferencePaths(
    refreshed.documents,
    refreshed.projectJsonObjects,
  );

  for (const [sourcePath, mappings] of mappingBySource) {
    if (manifest.progress.deletedStoragePaths.includes(sourcePath)) continue;
    if (remainingReferences.has(sourcePath)) continue;
    const allReplacementsVerified = mappings.every((mapping) =>
      manifest.progress.copiedStoragePaths.includes(mapping.destinationPath)
    );
    if (!allReplacementsVerified) continue;
    const source = adminStorage.file(sourcePath);
    const [exists] = await source.exists();
    if (exists) await source.delete();
    manifest.progress.deletedStoragePaths.push(sourcePath);
    manifest.progress.phase = "verified-source-objects-removed";
    await writeJsonAtomic(manifestPath, manifest);
  }
}

async function executeApply(plan, { deleteOrphans, resumePath }) {
  let backupDirectory;
  let manifestPath;
  let manifest;
  if (resumePath) {
    backupDirectory = path.resolve(ROOT, resumePath);
    manifestPath = path.join(backupDirectory, "migration-manifest.json");
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.projectId !== PROJECT_ID || manifest.bucket !== BUCKET_NAME ||
      manifest.backupCompleted !== true) {
      throw new Error("Resume manifest is invalid or has no completed backup.");
    }
    if (manifest.plan.unresolvedReferences?.length) {
      throw new Error("Resume manifest contains unresolved references; migration is blocked.");
    }
    const backupDocuments = await loadVerifiedBackup(backupDirectory, manifest);
    const backupAssets = new Map(
      backupDocuments
        .filter((document) => document.path.startsWith(`${ASSETS_COLLECTION}/`) &&
          !document.path.slice(ASSETS_COLLECTION.length + 1).includes("/"))
        .map((document) => [
          document.path.slice(ASSETS_COLLECTION.length + 1),
          document.data,
        ]),
    );
    const originalAssets = manifest.plan.idMapping.map((row) => {
      const data = backupAssets.get(row.oldDocumentId);
      if (!data) {
        throw new Error(`Original asset is missing from the backup: ${row.oldDocumentId}`);
      }
      return { docId: row.oldDocumentId, data };
    });
    plan = { ...plan, assets: originalAssets };
  } else {
    if (plan.unresolved.length > 0) {
      throw new Error(
        `Migration is blocked by ${plan.unresolved.length} unresolved reference(s). See the report.`,
      );
    }
    const runId = timestampLabel();
    const backup = await writeBackup(plan, runId);
    backupDirectory = backup.backupDirectory;
    manifestPath = backup.manifestPath;
    manifest = backup.manifest;
  }

  const manifestIdRows = manifest.plan.idMapping;
  const manifestStorageRows = manifest.plan.storagePathMapping;
  const idRows = manifestIdRows;
  const storageMappings = manifestStorageRows;
  const idMapping = new Map(idRows.map((row) => [
    row.oldDocumentId,
    row.newDocumentId,
  ]));
  const activePlan = {
    ...plan,
    idRows,
    idMapping,
    storagePlan: {
      ...plan.storagePlan,
      mappings: storageMappings,
    },
    idReferences: {
      ...plan.idReferences,
      projectJsonUpdates: manifest.plan.projectJsonUpdates,
      firestoreUpdates: manifest.plan.firestoreReferenceUpdates,
    },
    staticReferences: {
      ...plan.staticReferences,
      files: manifest.plan.sourceCodeReferences,
    },
  };

  await createAndVerifyNewAssets(activePlan, manifest, manifestPath);
  await updateReferenceDocuments(activePlan, manifest, manifestPath);
  await verifyAndDeleteOldDocuments(activePlan, manifest, manifestPath);
  if (deleteOrphans) {
    await deleteVerifiedSources(activePlan, manifest, manifestPath);
  }
  manifest.progress.phase = deleteOrphans ? "complete-with-source-cleanup" : "complete";
  manifest.completedAt = new Date().toISOString();
  await writeJsonAtomic(manifestPath, manifest);

  return { backupDirectory, manifestPath, manifest };
}

function printSummary(report, outputDirectory) {
  console.log(`Mode: ${report.mode}`);
  console.log(`Firebase project: ${report.projectId}`);
  console.log(`Storage bucket: ${report.bucket}`);
  console.log(`Assets: ${report.summary.firestoreDocuments} (${Object.entries(
    report.summary.assetsByType
  ).map(([type, count]) => `${type} ${count}`).join(", ")})`);
  console.log(
    `Storage objects: ${report.summary.storageObjects}; asset-scope bytes: ${report.summary.assetStorageBytes}`,
  );
  console.log(
    `Project JSON files inspected: ${report.summary.projectsJsonFilesInspected}; verified ID references: ${report.summary.verifiedIdReferences}`,
  );
  console.log(
    `Storage paths: ${report.summary.storagePathReferences}; missing unresolved paths: ${report.summary.missingStoragePathReferences}; directory-prefix repairs: ${report.summary.directoryPrefixRepairs}`,
  );
  console.log(
    `Validation issues: ${report.summary.validationIssues}; unresolved migration references: ${report.summary.unresolvedReferences}`,
  );
  console.log(
    `Floor dimensions to receive temporary 1m placeholders: ${report.summary.temporaryDimensionPlaceholders}`,
  );
  console.log(
    `Duplicate content candidates: ${report.summary.duplicateContentGroups}; deletion candidates: ${report.summary.deletionCandidates}`,
  );
  console.log(`Report directory: ${outputDirectory}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await assertFirebaseTarget();

  if (options.mode === "apply" && options.resumePath) {
    const resumePath = path.resolve(ROOT, options.resumePath);
    const manifestPath = path.join(resumePath, "migration-manifest.json");
    const previous = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (previous.backupCompleted !== true) {
      throw new Error("Cannot resume: the original backup did not complete.");
    }
    if (previous.plan.unresolvedReferences?.length) {
      throw new Error("Cannot resume: the recorded plan contains unresolved references.");
    }
  }

  const plan = await buildPlan(options.mode);
  const runId = timestampLabel();
  const outputDirectory = path.join(
    AUDIT_ROOT,
    "reports",
    `asset-migration-${options.mode}-${runId}`,
  );
  await writeReportFiles(plan.report, outputDirectory);
  printSummary(plan.report, outputDirectory);

  if (options.mode === "apply") {
    const result = await executeApply(plan, options);
    console.log(`Migration backup and manifest: ${result.backupDirectory}`);
    console.log(`Migration phase: ${result.manifest.progress.phase}`);
  } else if (plan.unresolved.length > 0) {
    console.log(
      "No Firebase writes were made. Apply is blocked until all unresolved references are reviewed.",
    );
  } else {
    console.log("Dry run complete. No Firestore or Storage changes were made.");
    console.log("No --apply or --delete-orphans operation was executed.");
  }
}

main().catch((error) => {
  console.error("Asset cleanup migration failed:", error);
  process.exitCode = 1;
});
