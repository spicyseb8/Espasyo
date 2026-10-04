import crypto from "node:crypto";
import path from "node:path";

import express from "express";
import multer from "multer";

import {
  adminAuth,
  adminDb,
  adminStorage,
} from "../firebase-admin.js";

const router = express.Router();
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_FURNITURE_CATEGORIES = new Set([
  "livingroom",
  "bedroom",
  "diningroom",
  "kitchen",
  "bathroom",
  "office",
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
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "other";
}

function safeFileName(value) {
  const extension = path.extname(value).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const baseName = path.basename(value, path.extname(value))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
  return `${baseName}${extension}`;
}

async function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      success: false,
      message: "Sign in with an admin account to create assets.",
    });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(match[1]);
    if (decodedToken.email_verified !== true) {
      return res.status(403).json({
        success: false,
        message: "Verify your admin account email before creating assets.",
      });
    }

    const employeeSnapshot = await adminDb
      .collection("adminEmployees")
      .where("uid", "==", decodedToken.uid)
      .limit(1)
      .get();

    const role = employeeSnapshot.docs[0]?.data().role;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin employees can create assets.",
      });
    }

    next();
  } catch (error) {
    console.error("Asset create authentication failed:", error);
    return res.status(401).json({
      success: false,
      message: "Your admin session is invalid. Sign in again and retry.",
    });
  }
}

router.post(
  "/assets",
  requireAdmin,
  (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) return next();

      const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? 413
        : 400;

      return res.status(status).json({
        success: false,
        message: status === 413
          ? "Each uploaded file must be 100 MB or smaller."
          : error.message || "Unable to read uploaded asset files.",
      });
    });
  },
  async (req, res) => {
    const uploadedFiles = req.files ?? {};
    const uploadedObjects = [];

    try {
      const assetType = req.body.asset_type;
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
      const price = Number(req.body.price);
      const assetStatus = req.body.asset_status || "available";
      const modelFile = getUploadedFile(uploadedFiles, "modelFile");
      const diffuseFile = getUploadedFile(uploadedFiles, "diffuseFile");
      const normalFile = getUploadedFile(uploadedFiles, "normalFile");
      const roughnessFile = getUploadedFile(uploadedFiles, "roughnessFile");
      const aoFile = getUploadedFile(uploadedFiles, "aoFile");

      if (!["furniture", "floor", "wall"].includes(assetType)) {
        throw new Error("Asset type must be furniture, floor, or wall.");
      }
      if (!name) throw new Error("Asset name is required.");
      if (!category) throw new Error("Asset category is required.");
      if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a number of 0 or more.");
      if (!["available", "not_available"].includes(assetStatus)) {
        throw new Error("Asset status is invalid.");
      }

      if (assetType === "furniture") {
        const normalizedCategory = category.toLowerCase().replace(/[\s_-]+/g, "");
        if (!ALLOWED_FURNITURE_CATEGORIES.has(normalizedCategory)) {
          throw new Error("Furniture category is not supported by the client library.");
        }
        if (!modelFile) throw new Error("Upload a GLB model for furniture.");
        if (path.extname(modelFile.originalname).toLowerCase() !== ".glb") {
          throw new Error("Furniture models must be GLB files.");
        }
      }

      if (assetType === "floor" && !diffuseFile) {
        throw new Error("Upload a diffuse texture for floors.");
      }
      if (assetType === "wall" && !diffuseFile && !/^#[0-9a-f]{6}$/i.test(req.body.color ?? "")) {
        throw new Error("Walls need a diffuse texture or a valid color.");
      }

      validateImage(diffuseFile, "Diffuse texture");
      validateImage(normalFile, "Normal map");
      validateImage(roughnessFile, "Roughness map");
      validateImage(aoFile, "Ambient occlusion map");

      const roughness = parseOptionalNumber(req.body.roughness, 0.8, "Roughness");
      const metalness = parseOptionalNumber(req.body.metalness, 0, "Metalness");
      if (roughness < 0 || roughness > 1) throw new Error("Roughness must be between 0 and 1.");
      if (metalness < 0 || metalness > 1) throw new Error("Metalness must be between 0 and 1.");

      const placementSurface = req.body.placement_surface || "floor";
      if (!["floor", "wall", "furniture"].includes(placementSurface)) {
        throw new Error("Furniture placement surface is invalid.");
      }

      const assetRef = adminDb.collection("assets").doc();
      const folder = `assets/${assetType}/${safePathPart(category)}`;

      const uploadFile = async (file, role) => {
        if (!file) return null;
        const storagePath = `${folder}/${assetRef.id}-${role}-${safeFileName(file.originalname)}`;
        const storageFile = adminStorage.file(storagePath);
        uploadedObjects.push(storageFile);
        await storageFile.save(file.buffer, {
          resumable: false,
          metadata: {
            contentType: file.mimetype || "application/octet-stream",
            cacheControl: "public, max-age=31536000",
          },
        });
        return storagePath;
      };

      const [modelPath, diffusePath, normalPath, roughnessPath, aoPath] = await Promise.all([
        uploadFile(modelFile, "model"),
        uploadFile(diffuseFile, "diffuse"),
        uploadFile(normalFile, "normal"),
        uploadFile(roughnessFile, "roughness"),
        uploadFile(aoFile, "ao"),
      ]);

      const now = new Date();
      const asset = {
        id: assetRef.id,
        name,
        asset_type: assetType,
        category,
        price,
        asset_status: assetStatus,
        created_at: now,
        updated_at: now,
      };

      if (modelPath) {
        asset.storage_path = modelPath;
        asset.model_path = modelPath;
        asset.placement_surface = placementSurface;
        asset.rotation_offset_y = 0;
        asset.depth_offset = 0;
        asset.snap_targets = ["wall", "furniture"];
      }

      if (diffusePath) {
        asset.diffuse_path = diffusePath;
        if (assetType === "wall") asset.base_color_path = diffusePath;
      }
      if (normalPath) asset.normal_path = normalPath;
      if (roughnessPath) {
        asset.rough_path = roughnessPath;
        asset.roughness_path = roughnessPath;
      }
      if (aoPath) asset.ao_path = aoPath;
      if (assetType !== "furniture") {
        if (typeof req.body.color === "string" && req.body.color) asset.color = req.body.color;
        asset.roughness = roughness;
        asset.metalness = metalness;
      }

      await assetRef.set(asset);

      return res.status(201).json({ success: true, asset });
    } catch (error) {
      await Promise.allSettled(
        uploadedObjects.map((file) => file.delete({ ignoreNotFound: true }))
      );
      console.error("Asset creation failed:", error);
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to create asset.",
      });
    }
  }
);

export default router;