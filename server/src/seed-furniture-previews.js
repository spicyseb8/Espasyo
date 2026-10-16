import path from "node:path";
import { adminDb, adminStorage } from "./firebase-admin.js";
import { createFurniturePreviewRenderer } from "./assets/render-furniture-preview.js";

function getStoragePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;

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

  if (storagePath.split("/").includes("..")) return null;
  const normalizedPath = path.posix.normalize(storagePath);
  return normalizedPath.startsWith("assets/") ? normalizedPath : null;
}

async function hasValidPngPreview(value) {
  const storagePath = getStoragePath(value);
  if (!storagePath || !storagePath.toLowerCase().endsWith(".png")) return false;

  try {
    const [metadata] = await adminStorage.file(storagePath).getMetadata();
    return (
      Number(metadata.size) > 0 &&
      metadata.contentType?.toLowerCase() === "image/png"
    );
  } catch (error) {
    if (error?.code === 404 || error?.code === "404") return false;
    throw error;
  }
}

function getFurnitureModelPath(asset) {
  return getStoragePath(
    asset.model_path ?? asset.storage_path ?? asset.model_url
  );
}

function parseArguments(args) {
  const options = {
    dryRun: args.includes("--dry-run"),
    regenerate: args.includes("--regenerate"),
  };
  const unknownArguments = args.filter(
    (argument) =>
      !["--dry-run", "--regenerate"].includes(argument)
  );

  if (unknownArguments.length > 0) {
    throw new Error(`Unknown option(s): ${unknownArguments.join(", ")}`);
  }
  return options;
}

async function seedFurniturePreviews() {
  const options = parseArguments(process.argv.slice(2));
  const snapshot = await adminDb
    .collection("assets")
    .where("asset_type", "==", "furniture")
    .get();

  console.log(
    `Found ${snapshot.size} furniture asset(s).${options.dryRun ? " Dry run: no files or records will be changed." : ""}`
  );

  let renderer = null;
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const document of snapshot.docs) {
      const asset = document.data();
      const assetId =
        typeof asset.id === "string" && asset.id.trim()
          ? asset.id.trim()
          : document.id;
      const currentPreviewValue =
        asset.thumbnail_path ?? asset.thumbnail_url;
      let generatedPath = null;

      try {
        const hasPreview = await hasValidPngPreview(currentPreviewValue);
        if (hasPreview && !options.regenerate) {
          console.log(`[skip] ${assetId}: valid PNG preview already exists.`);
          skipped += 1;
          continue;
        }

        const modelPath = getFurnitureModelPath(asset);
        if (!modelPath) {
          throw new Error("No Firebase Storage GLB path is recorded.");
        }

        const modelFile = adminStorage.file(modelPath);
        const [exists] = await modelFile.exists();
        if (!exists) {
          throw new Error(`GLB model not found in Storage: ${modelPath}`);
        }

        const thumbnailPath = `${path.posix.dirname(modelPath)}/preview.png`;
        if (options.dryRun) {
          console.log(
            `[dry-run] ${assetId}: would render ${modelPath} to ${thumbnailPath}.`
          );
          generated += 1;
          continue;
        }

        if (!renderer) {
          renderer = await createFurniturePreviewRenderer();
        }

        const [modelBuffer] = await modelFile.download();
        const previewBuffer = await renderer.render(modelBuffer);
        const previewFile = adminStorage.file(thumbnailPath);
        generatedPath = thumbnailPath;
        await previewFile.save(previewBuffer, {
          resumable: false,
          metadata: {
            contentType: "image/png",
            cacheControl: "public, max-age=31536000",
          },
        });

        await document.ref.update({
          thumbnail_path: thumbnailPath,
          updated_at: new Date(),
        });

        console.log(`[generated] ${assetId}: ${thumbnailPath}`);
        generated += 1;
      } catch (error) {
        if (
          generatedPath &&
          generatedPath !== getStoragePath(currentPreviewValue)
        ) {
          await adminStorage
            .file(generatedPath)
            .delete({ ignoreNotFound: true })
            .catch((cleanupError) => {
              console.error(
                `[cleanup failed] ${assetId}:`,
                cleanupError
              );
            });
        }
        console.error(
          `[failed] ${assetId}: ${error instanceof Error ? error.message : String(error)}`
        );
        failed += 1;
      }
    }
  } finally {
    if (renderer) {
      await renderer.close();
    }
  }

  console.log(
    `Finished furniture previews: ${generated} generated${options.dryRun ? " or planned" : ""}, ${skipped} skipped, ${failed} failed.`
  );
  if (failed > 0) process.exitCode = 1;
}

seedFurniturePreviews().catch((error) => {
  console.error(
    "Furniture preview seeding failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
