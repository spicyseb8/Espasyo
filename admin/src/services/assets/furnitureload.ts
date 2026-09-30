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
// FIREBASE FURNITURE DOCUMENT
//==================================================

interface FirebaseFurnitureAsset {

    id?: unknown;

    name?: unknown;

    asset_type?: unknown;

    asset_status?: unknown;

    category?: unknown;

    price?: unknown;

    model_path?: unknown;

    model_url?: unknown;

    thumbnail_path?: unknown;

    thumbnail_url?: unknown;

    placement_surface?: unknown;

    placement_surfaces?: unknown;

    rotation_offset_y?: unknown;

    depth_offset?: unknown;

    snap_target?: unknown;

    snap_targets?: unknown;

    created_at?: unknown;

    updated_at?: unknown;

}


//==================================================
// CACHE
//==================================================

let cachedFurnitureAssets:
    Asset[] = [];

let furnitureCatalogLoaded =
    false;

let furnitureCatalogPromise:
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

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
    ) {

        return path;

    }

    try {

        return await getDownloadURL(
            ref(
                storage,
                path
            )
        );

    } catch (error) {

        console.error(
            "Failed to resolve Firebase furniture storage file:",
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

    return resolveStorageUrl(
        storagePath
    );

}


//==================================================
// CATEGORY
//==================================================

function normalizeFurnitureCategory(
    value: unknown
): string | undefined {

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

    switch (
        category
    ) {

        case "livingroom":
        case "living":
            return "livingRoom";

        case "bedroom":
        case "bedroomfurniture":
            return "bedroom";

        case "diningroom":
        case "dining":
            return "diningRoom";

        case "kitchen":
            return "kitchen";

        case "bathroom":
            return "bathroom";

        case "office":
        case "study":
            return "office";

        default:
            return undefined;

    }

}


//==================================================
// PLACEMENT SURFACES
//==================================================

function readPlacementSurfaces(
    data: FirebaseFurnitureAsset
): Asset["placementSurfaces"] {

    if (
        typeof data.placement_surface ===
        "string"
    ) {

        const value =
            data.placement_surface
                .trim()
                .toLowerCase();

        if (
            value === "floor" ||
            value === "wall" ||
            value === "furniture"
        ) {

            return [
                value
            ];

        }

    }

    if (
        Array.isArray(
            data.placement_surfaces
        )
    ) {

        const values =
            data.placement_surfaces
                .filter(
                    item =>
                        typeof item ===
                        "string"
                )
                .map(
                    item =>
                        item
                            .trim()
                            .toLowerCase()
                )
                .filter(
                    item =>
                        item === "floor" ||
                        item === "wall" ||
                        item === "furniture"
                );

        if (
            values.length > 0
        ) {

            return values as Asset[
                "placementSurfaces"
            ];

        }

    }

    return [
        "floor"
    ];

}


//==================================================
// SNAP TARGETS
//==================================================

function readSnapTargets(
    data: FirebaseFurnitureAsset
): Asset["snapTargets"] {

    if (
        typeof data.snap_target ===
        "string"
    ) {

        const value =
            data.snap_target
                .trim()
                .toLowerCase();

        if (
            value === "wall" ||
            value === "furniture"
        ) {

            return [
                value
            ];

        }

    }

    if (
        Array.isArray(
            data.snap_targets
        )
    ) {

        const values =
            data.snap_targets
                .filter(
                    item =>
                        typeof item ===
                        "string"
                )
                .map(
                    item =>
                        item
                            .trim()
                            .toLowerCase()
                )
                .filter(
                    item =>
                        item === "wall" ||
                        item === "furniture"
                );

        if (
            values.length > 0
        ) {

            return values as Asset[
                "snapTargets"
            ];

        }

    }

    return [
        "wall",
        "furniture"
    ];

}


//==================================================
// BUILD ASSET
//==================================================

async function buildFurnitureAsset(
    documentId: string,
    data: FirebaseFurnitureAsset
): Promise<Asset | null> {

    //--------------------------------------------------
    // Only furniture documents.
    //
    // Doors/windows are also stored as "furniture"
    // in Firebase, so category normalization below
    // prevents those from being loaded here.
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
        data.asset_status.trim() !== "" &&
        data.asset_status
            .trim()
            .toLowerCase() !==
            "available"
    ) {

        return null;

    }

    //--------------------------------------------------
    // Furniture category
    //--------------------------------------------------

    const furnitureCategory =
        normalizeFurnitureCategory(
            data.category
        );

    if (
        !furnitureCategory
    ) {

        return null;

    }

    //--------------------------------------------------
    // Model URL
    //--------------------------------------------------

    const modelUrl =
        await resolvePreferredUrl(
            data.model_url,
            data.model_path
        );

    if (
        !modelUrl
    ) {

        console.warn(
            "Skipping Firebase furniture asset without a usable model URL:",
            documentId,
            data.model_url ??
                data.model_path
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

    const parsedPrice =
        Number(
            data.price ?? 0
        );

    //--------------------------------------------------
    // Rotation
    //--------------------------------------------------

    const parsedRotation =
        Number(
            data.rotation_offset_y ?? 0
        );

    const rotationOffsetY =
        Number.isFinite(
            parsedRotation
        )
            ? parsedRotation
            : 0;

    //--------------------------------------------------
    // Depth offset
    //--------------------------------------------------

    const parsedDepthOffset =
        Number(
            data.depth_offset ?? 0
        );

    const depthOffset =
        Number.isFinite(
            parsedDepthOffset
        )
            ? parsedDepthOffset
            : 0;

    //--------------------------------------------------
    // Placement
    //--------------------------------------------------

    const placementSurfaces =
        readPlacementSurfaces(
            data
        );

    //--------------------------------------------------
    // Snap targets
    //--------------------------------------------------

    const snapTargets =
        readSnapTargets(
            data
        );

    //--------------------------------------------------
    // Admin Asset
    //--------------------------------------------------

    return {

        id:
            assetId,

        name,

        thumbnail:
            thumbnailUrl ?? "",

        model:
            modelUrl,

        type:
            "furniture",

        price:
            Number.isFinite(
                parsedPrice
            )
                ? parsedPrice
                : 0,

        furnitureCategory,

        rotationOffsetY,

        depthOffset,

        placementSurfaces,

        snapTargets

    } satisfies Asset;

}


//==================================================
// LOAD CATALOG
//==================================================

async function loadFurnitureAssets():
    Promise<Asset[]> {

    const furnitureQuery =
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
            furnitureQuery
        );

    const results =
        await Promise.allSettled(

            snapshot.docs.map(
                document =>
                    buildFurnitureAsset(
                        document.id,
                        document.data() as
                            FirebaseFurnitureAsset
                    )
            )

        );

    const assets:
        Asset[] = [];

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
                "Failed to build Firebase furniture asset:",
                result.reason
            );

        }

    }

    assets.sort(
        (
            first,
            second
        ) =>
            first.name.localeCompare(
                second.name
            )
    );

    cachedFurnitureAssets =
        assets;

    furnitureCatalogLoaded =
        true;

    return cachedFurnitureAssets;

}


//==================================================
// GET FURNITURE ASSETS
//==================================================

export async function getFurnitureAssets():
    Promise<Asset[]> {

    if (
        furnitureCatalogLoaded
    ) {

        return cachedFurnitureAssets;

    }

    if (
        furnitureCatalogPromise
    ) {

        return furnitureCatalogPromise;

    }

    furnitureCatalogPromise =
        loadFurnitureAssets()
            .finally(
                () => {

                    furnitureCatalogPromise =
                        null;

                }
            );

    return furnitureCatalogPromise;

}


//==================================================
// CACHED LOOKUP
//==================================================

export function getCachedFurnitureAsset(
    assetId: string
): Asset | undefined {

    return cachedFurnitureAssets.find(
        asset =>
            asset.id ===
            assetId
    );

}


//==================================================
// CACHED ASSETS
//==================================================

export function getCachedFurnitureAssets():
    Asset[] {

    return cachedFurnitureAssets;

}


//==================================================
// REFRESH
//==================================================

export async function refreshFurnitureAssets():
    Promise<Asset[]> {

    cachedFurnitureAssets = [];

    furnitureCatalogLoaded =
        false;

    furnitureCatalogPromise =
        null;

    return getFurnitureAssets();

}