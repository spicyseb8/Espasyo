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
} from "@/firebase/firebase";

import type {
    Asset
} from "../../components/project-loader/engine/assets/Asset";


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

    // Preferred: already-generated Firebase Storage URL.
    model_url?: unknown;

    thumbnail_path?: unknown;

    // Preferred: already-generated Firebase Storage URL.
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

let catalogPromise:
    Promise<Asset[]> | null = null;


//==================================================
// STORAGE URL
//==================================================

async function resolveStorageUrl(
    value: unknown
): Promise<string | undefined> {

    if (
        typeof value !== "string"
    ) {

        return undefined;
    }

    const path =
        value.trim();

    if (
        path === ""
    ) {

        return undefined;
    }

    //--------------------------------------------------
    // Already a URL
    //--------------------------------------------------

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
    ) {

        return path;
    }

    //--------------------------------------------------
    // Firebase Storage path
    //--------------------------------------------------

    try {

        return await getDownloadURL(
            ref(
                storage,
                path
            )
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

    //--------------------------------------------------
    // Prefer Firestore URL
    //--------------------------------------------------

    if (
        typeof directUrl === "string"
    ) {

        const value =
            directUrl.trim();

        if (
            value.startsWith("http://") ||
            value.startsWith("https://") ||
            value.startsWith("data:")
        ) {

            return value;
        }
    }

    //--------------------------------------------------
    // Backward compatibility
    //--------------------------------------------------

    return resolveStorageUrl(
        storagePath
    );
}


//==================================================
// CATEGORY
//==================================================

function normalizeCategory(
    value: unknown
): "doors" | "windows" | undefined {

    if (
        typeof value !== "string"
    ) {

        return undefined;
    }

    const category =
        value
            .trim()
            .toLowerCase()
            .replace(
                /[\s_-]+/g,
                ""
            );

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

    //--------------------------------------------------
    // Doors
    //--------------------------------------------------

    if (
        category === "doors"
    ) {

        return {

            scale:
                1,

            rotationOffsetY:
                Math.PI / 2

        };
    }

    //--------------------------------------------------
    // Slim Intersection window
    //--------------------------------------------------

    const normalizedPath =
        modelPath
            .trim()
            .toLowerCase();

    if (
        normalizedPath.includes(
            "slim_intersection_i"
        )
    ) {

        return {

            scale:
                0.6,

            rotationOffsetY:
                Math.PI / 2

        };
    }

    //--------------------------------------------------
    // Glass window
    //--------------------------------------------------

    if (
        normalizedPath.includes(
            "glass_window"
        )
    ) {

        return {

            scale:
                0.6,

            rotationOffsetY:
                0

        };
    }

    //--------------------------------------------------
    // Generic window fallback
    //--------------------------------------------------

    return {

        scale:
            0.6,

        rotationOffsetY:
            0

    };
}


//==================================================
// BUILD ASSET
//==================================================

async function buildAsset(
    documentId: string,
    data: FirebaseBuildAssetDocument
): Promise<Asset | null> {

    //--------------------------------------------------
    // Your Firestore stores doors/windows as furniture.
    //--------------------------------------------------

    if (
        typeof data.asset_type === "string" &&
        data.asset_type
            .trim()
            .toLowerCase() !==
            "furniture"
    ) {

        return null;
    }

    //--------------------------------------------------
    // Only available assets
    //--------------------------------------------------

    if (
        typeof data.asset_status === "string" &&
        data.asset_status
            .trim() !== "" &&
        data.asset_status
            .trim()
            .toLowerCase() !==
            "available"
    ) {

        return null;
    }

    //--------------------------------------------------
    // Door/window category
    //--------------------------------------------------

    const category =
        normalizeCategory(
            data.category
        );

    if (
        !category
    ) {

        return null;
    }

    //--------------------------------------------------
    // Model URL / path
    //--------------------------------------------------

    const modelPath =
        typeof data.model_path === "string"
            ? data.model_path.trim()
            : "";

    const modelUrl =
        await resolvePreferredUrl(
            data.model_url,
            modelPath
        );

    if (
        !modelUrl
    ) {

        console.warn(
            "Skipping Firebase door/window without a usable model_url/model_path:",
            documentId,
            data.model_url ?? data.model_path
        );

        return null;
    }

    //--------------------------------------------------
    // Thumbnail
    //--------------------------------------------------

    const thumbnailUrl =
        await resolvePreferredUrl(
            data.thumbnail_url,
            data.thumbnail_path
        );

    //--------------------------------------------------
    // Asset ID
    //--------------------------------------------------

    const assetId =
        typeof data.id === "string" &&
        data.id.trim() !== ""
            ? data.id.trim()
            : documentId;

    //--------------------------------------------------
    // Name
    //--------------------------------------------------

    const name =
        typeof data.name === "string" &&
        data.name.trim() !== ""
            ? data.name.trim()
            : assetId;

    //--------------------------------------------------
    // Price
    //--------------------------------------------------

    const priceNumber =
        Number(
            data.price ?? 0
        );

    //--------------------------------------------------
    // Existing model defaults
    //--------------------------------------------------

    const defaults =
        getDefaultModelSettings(
            category,
            modelPath
        );

    //--------------------------------------------------
    // Firebase scale override
    //--------------------------------------------------

    const firebaseScale =
        Number(
            data.scale
        );

    const scale =
        Number.isFinite(
            firebaseScale
        ) &&
        firebaseScale > 0
            ? firebaseScale
            : defaults.scale;

    //--------------------------------------------------
    // Firebase rotation override
    //--------------------------------------------------

    const firebaseRotation =
        Number(
            data.rotation_offset_y
        );

    const rotationOffsetY =
        Number.isFinite(
            firebaseRotation
        )
            ? firebaseRotation
            : defaults.rotationOffsetY;

    //--------------------------------------------------
    // View-only asset type
    //--------------------------------------------------

    const type =
        category === "doors"
            ? "door"
            : "window";

    //--------------------------------------------------
    // Convert Firebase → Admin Asset
    //--------------------------------------------------

    return {

        id:
            assetId,

        name,

        thumbnail:
            thumbnailUrl ?? "",

        model:
            modelUrl,

        type,

        price:
            Number.isFinite(
                priceNumber
            )
                ? priceNumber
                : 0,

        rotationOffsetY,

        scale,

        //--------------------------------------------------
        // Doors and windows are wall elements.
        //--------------------------------------------------

        placementSurfaces: [
            "wall"
        ]

    } satisfies Asset;
}


//==================================================
// LOAD CATALOG
//==================================================

async function loadCatalog(): Promise<Asset[]> {

    //--------------------------------------------------
    // Firebase structure:
    //
    // assets
    //   asset_type = "furniture"
    //   category   = "doors" / "windows"
    //--------------------------------------------------

    const assetsQuery =
        query(
            collection(
                db,
                "assets"
            ),
            where(
                "asset_type",
                "==",
                "furniture"
            )
        );

    const snapshot =
        await getDocs(
            assetsQuery
        );

    //--------------------------------------------------
    // Build all assets without allowing one failed
    // asset to stop the entire catalog.
    //--------------------------------------------------

    const results =
        await Promise.allSettled(

            snapshot.docs.map(
                document =>
                    buildAsset(
                        document.id,
                        document.data() as
                            FirebaseBuildAssetDocument
                    )
            )

        );

    const assets: Asset[] = [];

    for (
        const result
        of results
    ) {

        if (
            result.status ===
            "fulfilled"
        ) {

            if (
                result.value
            ) {

                assets.push(
                    result.value
                );

            }

        } else {

            console.error(
                "Failed to build Firebase door/window asset:",
                result.reason
            );

        }
    }

    //--------------------------------------------------
    // Stable alphabetical ordering
    //--------------------------------------------------

    assets.sort(
        (
            first,
            second
        ) =>
            first.name.localeCompare(
                second.name
            )
    );

    //--------------------------------------------------
    // Cache
    //--------------------------------------------------

    cachedAssets =
        assets;

    catalogLoaded =
        true;

    return cachedAssets;
}


//==================================================
// GET ALL DOORS + WINDOWS
//==================================================

export async function getDoorWindowAssets():
    Promise<Asset[]> {

    if (
        catalogLoaded
    ) {

        return cachedAssets;
    }

    if (
        catalogPromise
    ) {

        return catalogPromise;
    }

    catalogPromise =
        loadCatalog()
            .finally(
                () => {

                    catalogPromise =
                        null;

                }
            );

    return catalogPromise;
}


//==================================================
// GET DOORS
//==================================================

export async function getDoorAssets():
    Promise<Asset[]> {

    const assets =
        await getDoorWindowAssets();

    return assets.filter(
        asset =>
            asset.type ===
            "door"
    );
}


//==================================================
// GET WINDOWS
//==================================================

export async function getWindowAssets():
    Promise<Asset[]> {

    const assets =
        await getDoorWindowAssets();

    return assets.filter(
        asset =>
            asset.type ===
            "window"
    );
}


//==================================================
// CACHED LOOKUP
//==================================================

export function getCachedDoorWindowAsset(
    assetId: string
): Asset | undefined {

    return cachedAssets.find(
        asset =>
            asset.id ===
            assetId
    );
}


//==================================================
// CACHED DOOR
//==================================================

export function getCachedDoorAsset(
    assetId: string
): Asset | undefined {

    const asset =
        getCachedDoorWindowAsset(
            assetId
        );

    return asset?.type ===
        "door"
        ? asset
        : undefined;
}


//==================================================
// CACHED WINDOW
//==================================================

export function getCachedWindowAsset(
    assetId: string
): Asset | undefined {

    const asset =
        getCachedDoorWindowAsset(
            assetId
        );

    return asset?.type ===
        "window"
        ? asset
        : undefined;
}


//==================================================
// REFRESH
//==================================================

export async function refreshDoorWindowAssets():
    Promise<Asset[]> {

    cachedAssets = [];

    catalogLoaded =
        false;

    catalogPromise =
        null;

    return getDoorWindowAssets();
}