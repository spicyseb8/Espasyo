import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

import {
    getDownloadURL,
    ref
} from "firebase/storage";

import {
    db,
    storage
} from "../../firebase/firebase";

import {
    BuildTool
} from "../../context/BuildTool";

import type {
    Asset
} from "../../assets/Asset";

//==================================================
// FIREBASE BUILD-ASSET DOCUMENT
//==================================================

interface FirebaseBuildAssetDocument {
    id?: unknown;
    name?: unknown;
    asset_type?: unknown;
    asset_status?: unknown;
    category?: unknown;
    model_path?: unknown;
    model_url?: unknown;
    thumbnail_path?: unknown;
    thumbnail_url?: unknown;
    price?: unknown;
    scale?: unknown;
    rotation_offset_y?: unknown;
}

//==================================================
// CACHE
//==================================================

let cachedAssets: Asset[] = [];
let catalogLoaded = false;
let catalogPromise: Promise<Asset[]> | null = null;

//==================================================
// STORAGE URL
//==================================================

async function resolveStorageUrl(
    value: unknown
): Promise<string | undefined> {
    if (typeof value !== "string") {
        return undefined;
    }

    const path = value.trim();

    if (path === "") {
        return undefined;
    }

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
    ) {
        return path;
    }

    try {
        return await getDownloadURL(
            ref(storage, path)
        );
    } catch (error) {
        console.error(
            "Failed to resolve Firebase door/window Storage file:",
            path,
            error
        );

        return undefined;
    }
}

//==================================================
// PREFERRED URL
//==================================================

async function resolvePreferredUrl(
    directUrl: unknown,
    storagePath: unknown
): Promise<string | undefined> {
    if (typeof directUrl === "string") {
        const value = directUrl.trim();

        if (
            value.startsWith("http://") ||
            value.startsWith("https://") ||
            value.startsWith("data:")
        ) {
            return value;
        }
    }

    return resolveStorageUrl(storagePath);
}

//==================================================
// CATEGORY
//==================================================

function normalizeCategory(
    value: unknown
): "doors" | "windows" | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const category = value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    if (
        category === "door" ||
        category === "doors"
    ) {
        return "doors";
    }

    if (
        category === "window" ||
        category === "windows"
    ) {
        return "windows";
    }

    return undefined;
}

//==================================================
// LEGACY DEFAULTS
//==================================================

function getDefaultModelSettings(
    category: "doors" | "windows",
    modelPath: string
): {
    scale: number;
    rotationOffsetY: number;
} {
    if (category === "doors") {
        return {
            scale: 1,
            rotationOffsetY: Math.PI / 2
        };
    }

    const normalizedPath = modelPath
        .trim()
        .toLowerCase();

    if (
        normalizedPath.includes("slim_intersection_i")
    ) {
        return {
            scale: 0.6,
            rotationOffsetY: Math.PI / 2
        };
    }

    if (
        normalizedPath.includes("glass_window")
    ) {
        return {
            scale: 0.6,
            rotationOffsetY: 0
        };
    }

    return {
        scale: 0.6,
        rotationOffsetY: 0
    };
}

//==================================================
// BUILD ASSET
//==================================================

async function buildAsset(
    documentId: string,
    data: FirebaseBuildAssetDocument
): Promise<Asset | null> {
    if (
        typeof data.asset_type === "string" &&
        data.asset_type.trim().toLowerCase() !== "furniture"
    ) {
        return null;
    }

    // Only explicitly available doors and windows are loaded.
    if (
        typeof data.asset_status !== "string" ||
        data.asset_status.trim().toLowerCase() !== "available"
    ) {
        return null;
    }

    const category = normalizeCategory(data.category);

    if (!category) {
        return null;
    }

    const modelPath =
        typeof data.model_path === "string"
            ? data.model_path.trim()
            : "";

    const modelUrl = await resolvePreferredUrl(
        data.model_url,
        modelPath
    );

    if (!modelUrl) {
        console.warn(
            "Skipping Firebase door/window without a usable model_url/model_path:",
            documentId,
            data.model_url ?? data.model_path
        );

        return null;
    }

    const thumbnailUrl = await resolvePreferredUrl(
        data.thumbnail_url,
        data.thumbnail_path
    );

    const assetId =
        typeof data.id === "string" &&
        data.id.trim() !== ""
            ? data.id.trim()
            : documentId;

    const name =
        typeof data.name === "string" &&
        data.name.trim() !== ""
            ? data.name.trim()
            : assetId;

    const priceNumber = Number(data.price ?? 0);

    const defaults = getDefaultModelSettings(
        category,
        modelPath
    );

    const firebaseScale = Number(data.scale);
    const firebaseRotation = Number(
        data.rotation_offset_y
    );

    const scale =
        Number.isFinite(firebaseScale) &&
        firebaseScale > 0
            ? firebaseScale
            : defaults.scale;

    const rotationOffsetY =
        Number.isFinite(firebaseRotation)
            ? firebaseRotation
            : defaults.rotationOffsetY;

    const type =
        category === "doors"
            ? BuildTool.Door
            : BuildTool.Window;

    return {
        id: assetId,
        name,
        thumbnail: thumbnailUrl ?? "",
        model: modelUrl,
        type,
        price: Number.isFinite(priceNumber)
            ? priceNumber
            : 0,
        rotationOffsetY,
        scale,
        placementSurfaces: ["wall"]
    } satisfies Asset;
}

//==================================================
// LOAD CATALOG
//==================================================

async function loadCatalog(): Promise<Asset[]> {
    const assetsQuery = query(
        collection(db, "assets"),
        where("asset_type", "==", "furniture")
    );

    const snapshot = await getDocs(assetsQuery);

    const results = await Promise.allSettled(
        snapshot.docs.map(
            document =>
                buildAsset(
                    document.id,
                    document.data() as FirebaseBuildAssetDocument
                )
        )
    );

    const assets: Asset[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            if (result.value) {
                assets.push(result.value);
            }
        } else {
            console.error(
                "Failed to build Firebase door/window asset:",
                result.reason
            );
        }
    }

    assets.sort(
        (first, second) =>
            first.name.localeCompare(second.name)
    );

    cachedAssets = assets;
    catalogLoaded = true;

    return cachedAssets;
}

//==================================================
// GET ALL DOORS + WINDOWS
//==================================================

export async function getDoorWindowAssets(): Promise<Asset[]> {
    if (catalogLoaded) {
        return cachedAssets;
    }

    if (catalogPromise) {
        return catalogPromise;
    }

    catalogPromise = loadCatalog()
        .finally(() => {
            catalogPromise = null;
        });

    return catalogPromise;
}

//==================================================
// GET DOORS
//==================================================

export async function getDoorAssets(): Promise<Asset[]> {
    const assets = await getDoorWindowAssets();

    return assets.filter(
        asset => asset.type === BuildTool.Door
    );
}

//==================================================
// GET WINDOWS
//==================================================

export async function getWindowAssets(): Promise<Asset[]> {
    const assets = await getDoorWindowAssets();

    return assets.filter(
        asset => asset.type === BuildTool.Window
    );
}

//==================================================
// CACHED LOOKUP
//==================================================

export function getCachedDoorWindowAsset(
    assetId: string
): Asset | undefined {
    return cachedAssets.find(
        asset => asset.id === assetId
    );
}

export function getCachedDoorAsset(
    assetId: string
): Asset | undefined {
    const asset = getCachedDoorWindowAsset(assetId);

    return asset?.type === BuildTool.Door
        ? asset
        : undefined;
}

export function getCachedWindowAsset(
    assetId: string
): Asset | undefined {
    const asset = getCachedDoorWindowAsset(assetId);

    return asset?.type === BuildTool.Window
        ? asset
        : undefined;
}

//==================================================
// REFRESH
//==================================================

export async function refreshDoorWindowAssets(): Promise<Asset[]> {
    cachedAssets = [];
    catalogLoaded = false;
    catalogPromise = null;

    return getDoorWindowAssets();
}