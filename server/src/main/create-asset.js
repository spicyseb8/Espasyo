import path from "node:path";

import express from "express";
import multer from "multer";

import {
  adminDb,
  adminStorage,
} from "../firebase-admin.js";
import { createFurniturePreviewRenderer } from "../assets/render-furniture-preview.js";
import { requireRole } from "./authorization.js";

const router = express.Router();
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALLOWED_FURNITURE_CATEGORIES = new Set([
  "tables",
  "beds",
  "decorations",
  "toilets",
  "vanity",
  "cabinets",
  "appliances",
  "chairs",
  "sofas",
  "lavatory",
  "shelves",
  "livingroom",
  "bedroom",
  "diningroom",
  "kitchen",
  "bathroom",
  "office",
  "doors",
  "windows",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
}).fields([
  { name: "modelFile", maxCount: 1 },
  { name: "diffuseFile", maxCount: 1 },
  { name: "normalFile", maxCount: 1 },
  { name: "roughnessFile", maxCount: 1 },
  { name: "aoFile", maxCount: 1 },
]);

function getUploadedFile(files, fieldName) {
  return files?.[fieldName]?.[0] ?? null;
}

function parseOptionalNumber(value, fallback, fieldName) {
  if (value === undefined || value === "") return fallback;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return parsed;
}

function validateImage(file, fieldName) {
  if (file && !file.mimetype.startsWith("image/")) {
    throw new Error(`${fieldName} must be an image file.`);
  }
}

function safePathPart(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "other"
  );
}

function getAssetIdFormat(assetType, year) {
  if (assetType === "floor") {
    return {
      counterPrefix: "FL",
      matchesYear: new RegExp(`^FL-(\\d+)${year}$`),
      format: (sequence) =>
        `FL-${String(sequence).padStart(3, "0")}${year}`,
    };
  }

  if (assetType === "furniture") {
    return {
      counterPrefix: "F",
      matchesYear: new RegExp(`^F-(\\d+)${year}$`),
      format: (sequence) =>
        `F-${String(sequence).padStart(3, "0")}${year}`,
    };
  }

  return {
    counterPrefix: "W",
    matchesYear: new RegExp(`^W-${year}(\\d+)$`),
    format: (sequence) =>
      `W-${String(sequence).padStart(3, "0")}${year}`,
  };
}

function normalizeDuplicatePart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDuplicateCategory(value, assetType) {
  const category = normalizeDuplicatePart(value).replace(/[\s_-]+/g, "");

  if (assetType === "floor") {
    if (category === "tile" || category === "tiles") return "tiles";
    if (category === "brick" || category === "bricks") return "brick";
  }

  if (assetType === "furniture") {
    if (category === "door" || category === "doors") return "doors";
    if (category === "window" || category === "windows") return "windows";
  }

  return category;
}

function getAssetStorageFolder(assetType, category) {
  const categoryFolder = safePathPart(category);

  if (assetType === "floor") {
    const normalizedFolder =
      categoryFolder === "tile" || categoryFolder === "tiles"
        ? "tiles"
        : categoryFolder === "bricks"
          ? "brick"
          : categoryFolder;

    return `assets/floors/${normalizedFolder}`;
  }

  if (assetType === "furniture") {
    const isDoorOrWindow = ["door", "doors", "window", "windows"].includes(
      categoryFolder
    );
    return `assets/furniture/${isDoorOrWindow ? "doors" : categoryFolder}`;
  }

  return `assets/${assetType}/${categoryFolder}`;
}

async function reserveAssetId(assetType) {
  const year = new Date().getFullYear().toString().slice(-2);
  const idFormat = getAssetIdFormat(assetType, year);
  const counters = adminDb.collection("systemCounters");
  const counterRef = counters.doc(`asset-${idFormat.counterPrefix}-${year}`);
  const assets = adminDb.collection("assets");

  return adminDb.runTransaction(async (transaction) => {
    const [assetSnapshot, counterSnapshot] = await Promise.all([
      transaction.get(assets.where("asset_type", "==", assetType)),
      transaction.get(counterRef),
    ]);

    let highestSequence = Number(counterSnapshot.data()?.value) || 0;

    for (const document of assetSnapshot.docs) {
      const data = document.data();
      const existingId =
        typeof data.id === "string" ? data.id : document.id;
      const match = existingId.match(idFormat.matchesYear);

      if (match) {
        highestSequence = Math.max(highestSequence, Number(match[1]));
      }
    }

    let nextSequence = highestSequence + 1;
    let candidateId = idFormat.format(nextSequence);
    let candidateSnapshot = await transaction.get(assets.doc(candidateId));

    while (candidateSnapshot.exists) {
      nextSequence += 1;
      candidateId = idFormat.format(nextSequence);
      candidateSnapshot = await transaction.get(assets.doc(candidateId));
    }

    transaction.set(counterRef, {
      value: nextSequence,
      updated_at: new Date(),
    });

    return candidateId;
  });
}

async function createAssetRecord(asset) {
  return adminDb.runTransaction(async (transaction) => {
    const duplicateSnapshot = await transaction.get(
      adminDb
        .collection("assets")
        .where("asset_type", "==", asset.asset_type)
    );

    const duplicate = duplicateSnapshot.docs.find((document) => {
      const existing = document.data();

      return (
        normalizeDuplicatePart(existing.name) ===
          normalizeDuplicatePart(asset.name) &&
        normalizeDuplicateCategory(existing.category, asset.asset_type) ===
          normalizeDuplicateCategory(asset.category, asset.asset_type)
      );
    });

    if (duplicate) {
      const error = new Error(
        "An asset with this name and category already exists."
      );
      error.statusCode = 409;
      throw error;
    }

    transaction.create(adminDb.collection("assets").doc(asset.id), asset);
  });
}

function getStoragePath(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  let storagePath = trimmed;

  if (trimmed.startsWith("gs://")) {
    const match = trimmed.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match || match[1] !== adminStorage.name) return null;
    storagePath = match[2];
  } else if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/b\/([^/]+)\/o\/(.+)$/);
      if (!match || decodeURIComponent(match[1]) !== adminStorage.name) {
        return null;
      }
      storagePath = decodeURIComponent(match[2]);
    } catch {
      return null;
    }
  }

  const normalizedPath = path.posix.normalize(storagePath);
  if (
    !normalizedPath.startsWith("assets/") ||
    normalizedPath.split("/").includes("..")
  ) {
    return null;
  }

  return normalizedPath;
}

router.post(
  "/assets",
  requireRole("superadmin"),
  (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) return next();

      const status =
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
          ? 413
          : 400;

      return res.status(status).json({
        success: false,
        message:
          status === 413
            ? "Each uploaded file must be 100 MB or smaller."
            : error.message || "Unable to read uploaded asset files.",
      });
    });
  },
  async (req, res) => {
    const uploadedFiles = req.files ?? {};
    const uploadedObjects = [];
    let previewRenderer = null;

    try {
      const assetType = req.body.asset_type;
      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";
      const category =
        typeof req.body.category === "string"
          ? req.body.category.trim()
          : "";

      const rawPrice =
        assetType === "floor"
          ? req.body.pricePerPiece
          : req.body.price;
      const hasPrice = rawPrice !== undefined && rawPrice !== "";
      const price = hasPrice ? Number(rawPrice) : undefined;
      const assetStatus = req.body.asset_status || "available";

      const modelFile = getUploadedFile(uploadedFiles, "modelFile");
      const diffuseFile = getUploadedFile(uploadedFiles, "diffuseFile");
      const normalFile = getUploadedFile(uploadedFiles, "normalFile");
      const roughnessFile = getUploadedFile(uploadedFiles, "roughnessFile");
      const aoFile = getUploadedFile(uploadedFiles, "aoFile");

      // Flooring dimensions are received in meters.
      // They are required only when creating a floor asset.
      let floorLength;
      let floorWidth;

      if (assetType === "floor") {
        if (
          req.body.length === undefined ||
          req.body.length === ""
        ) {
          throw new Error("Floor length is required.");
        }

        if (
          req.body.width === undefined ||
          req.body.width === ""
        ) {
          throw new Error("Floor width is required.");
        }

        floorLength = Number(req.body.length);
        floorWidth = Number(req.body.width);

        if (!Number.isFinite(floorLength) || floorLength <= 0) {
          throw new Error("Floor length must be greater than 0.");
        }

        if (!Number.isFinite(floorWidth) || floorWidth <= 0) {
          throw new Error("Floor width must be greater than 0.");
        }
      }

      if (!["furniture", "floor", "wall"].includes(assetType)) {
        throw new Error("Asset type must be furniture, floor, or wall.");
      }

      if (!name) {
        throw new Error("Asset name is required.");
      }

      if (!category) {
        throw new Error("Asset category is required.");
      }

      const normalizedCategory = category
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
      const priceIsOptional =
        assetType === "furniture" &&
        ["decorations", "appliances"].includes(normalizedCategory);

      if (
        (!priceIsOptional && !hasPrice) ||
        (hasPrice && (!Number.isFinite(price) || price < 0))
      ) {
        throw new Error("Price must be a number of 0 or more.");
      }

      if (!["available", "not_available"].includes(assetStatus)) {
        throw new Error("Asset status is invalid.");
      }

      if (assetType === "furniture") {
        const categoryAllowed =
          ALLOWED_FURNITURE_CATEGORIES.has(normalizedCategory);

        if (process.env.NODE_ENV !== "production") {
          console.debug("Furniture category validation:", {
            assetType,
            submittedCategory: category,
            normalizedCategory,
            allowed: categoryAllowed,
          });
        }

        if (!categoryAllowed) {
          throw new Error(
            "Furniture category is not supported by the client library."
          );
        }

        if (!modelFile) {
          throw new Error("Upload a GLB model for furniture.");
        }

        if (
          path.extname(modelFile.originalname).toLowerCase() !== ".glb"
        ) {
          throw new Error("Furniture models must be GLB files.");
        }
      }

      if (assetType === "floor" && !diffuseFile) {
        throw new Error("Upload a diffuse texture for floors.");
      }

      if (
        assetType === "wall" &&
        !diffuseFile &&
        !/^#[0-9a-f]{6}$/i.test(req.body.color ?? "")
      ) {
        throw new Error("Walls need a diffuse texture or a valid color.");
      }

      validateImage(diffuseFile, "Diffuse texture");
      validateImage(normalFile, "Normal map");
      validateImage(roughnessFile, "Roughness map");
      validateImage(aoFile, "Ambient occlusion map");

      const roughness = parseOptionalNumber(
        req.body.roughness,
        0.8,
        "Roughness"
      );

      const metalness = parseOptionalNumber(
        req.body.metalness,
        0,
        "Metalness"
      );

      if (roughness < 0 || roughness > 1) {
        throw new Error("Roughness must be between 0 and 1.");
      }

      if (metalness < 0 || metalness > 1) {
        throw new Error("Metalness must be between 0 and 1.");
      }

      const placementSurface =
        req.body.placement_surface || "floor";

      if (!["floor", "wall", "furniture"].includes(placementSurface)) {
        throw new Error("Furniture placement surface is invalid.");
      }

      const assetId = await reserveAssetId(assetType);
      const folder = getAssetStorageFolder(assetType, category);

      const uploadFile = async (file, role) => {
        if (!file) return null;

        const extension = path.extname(file.originalname).toLowerCase();
        const storagePath = `${folder}/${assetId}/${role}${extension}`;

        const storageFile = adminStorage.file(storagePath);

        uploadedObjects.push(storageFile);

        await storageFile.save(file.buffer, {
          resumable: false,
          metadata: {
            contentType:
              file.mimetype || "application/octet-stream",
            cacheControl: "public, max-age=31536000",
          },
        });

        return storagePath;
      };

      const [
        modelPath,
        diffusePath,
        normalPath,
        roughnessPath,
        aoPath,
      ] = await Promise.all([
        uploadFile(modelFile, "model"),
        uploadFile(diffuseFile, "diffuse"),
        uploadFile(normalFile, "normal"),
        uploadFile(roughnessFile, "roughness"),
        uploadFile(aoFile, "ao"),
      ]);

      let thumbnailPath = null;
      if (assetType === "furniture" && modelPath && modelFile) {
        previewRenderer = await createFurniturePreviewRenderer();
        const previewBuffer = await previewRenderer.render(modelFile.buffer);
        thumbnailPath = `${path.posix.dirname(modelPath)}/preview.png`;
        const previewFile = adminStorage.file(thumbnailPath);
        uploadedObjects.push(previewFile);
        await previewFile.save(previewBuffer, {
          resumable: false,
          metadata: {
            contentType: "image/png",
            cacheControl: "public, max-age=31536000",
          },
        });
      }

      const now = new Date();

      const asset = {
        id: assetId,
        name,
        asset_type: assetType,
        category,
        asset_status: assetStatus,
        created_at: now,
        updated_at: now,
      };

      if (assetType === "floor") {
        asset.pricePerPiece = price;
        asset.length = floorLength;
        asset.width = floorWidth;
      } else {
        if (price !== undefined) {
          asset.price = price;
        }
      }

      if (modelPath) {
        asset.storage_path = modelPath;
        asset.model_path = modelPath;
        asset.placement_surface = placementSurface;
        asset.rotation_offset_y = 0;
        asset.depth_offset = 0;
        asset.snap_targets = ["wall", "furniture"];
      }

      if (thumbnailPath) {
        asset.thumbnail_path = thumbnailPath;
      }

      if (diffusePath) {
        asset.diffuse_path = diffusePath;

        if (assetType === "wall") {
          asset.base_color_path = diffusePath;
        }
      }

      if (normalPath) {
        asset.normal_path = normalPath;
      }

      if (roughnessPath) {
        asset.rough_path = roughnessPath;
        asset.roughness_path = roughnessPath;
      }

      if (aoPath) {
        asset.ao_path = aoPath;
      }

      if (assetType !== "furniture") {
        if (
          typeof req.body.color === "string" &&
          req.body.color
        ) {
          asset.color = req.body.color;
        }

        asset.roughness = roughness;
        asset.metalness = metalness;
      }

      await createAssetRecord(asset);

      return res.status(201).json({
        success: true,
        asset,
      });
    } catch (error) {
      await Promise.allSettled(
        uploadedObjects.map((file) =>
          file.delete({ ignoreNotFound: true })
        )
      );

      console.error("Asset creation failed:", error);

      return res.status(error?.statusCode ?? 400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create asset.",
      });
    } finally {
      if (previewRenderer) {
        try {
          await previewRenderer.close();
        } catch (error) {
          console.error("Failed to close the furniture preview renderer:", error);
        }
      }
    }
  }
);

router.delete(
  "/assets/:id",
  requireRole("superadmin"),
  async (req, res) => {
    const assetId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: "Asset ID is required.",
      });
    }

    try {
      const assetRef = adminDb.collection("assets").doc(assetId);
      const assetSnapshot = await assetRef.get();

      if (!assetSnapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "Asset was not found.",
        });
      }

      const asset = assetSnapshot.data();
      const storageFields = [
        "storage_path",
        "model_path",
        "thumbnail_path",
        "diffuse_path",
        "base_color_path",
        "normal_path",
        "rough_path",
        "roughness_path",
        "ao_path",
        "storage_url",
        "model_url",
        "thumbnail_url",
        "diffuse_url",
        "base_color_url",
        "normal_url",
        "rough_url",
        "roughness_url",
        "ao_url",
      ];
      const storagePaths = new Set(
        storageFields
          .map((field) => getStoragePath(asset[field]))
          .filter(Boolean)
      );

      const deletionResults = await Promise.allSettled(
        [...storagePaths].map((storagePath) =>
          adminStorage.file(storagePath).delete({ ignoreNotFound: true })
        )
      );
      const failedDeletions = deletionResults.filter(
        (result) => result.status === "rejected"
      );

      if (failedDeletions.length > 0) {
        console.error(
          `Failed to delete ${failedDeletions.length} Storage object(s) for asset ${assetId}:`,
          failedDeletions.map((result) => result.reason)
        );
        return res.status(500).json({
          success: false,
          message: "Failed to delete all files for this asset.",
        });
      }

      await assetRef.delete();

      return res.json({
        success: true,
        message: "Asset deleted successfully.",
      });
    } catch (error) {
      console.error("Asset deletion failed:", error);
      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete asset.",
      });
    }
  }
);

export default router;