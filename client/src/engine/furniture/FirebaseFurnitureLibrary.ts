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

import type {
    FurnitureCategory
} from "./FurnitureCategory";


//==================================================
// FIREBASE FURNITURE DOCUMENT
//==================================================
//
// This matches the fields currently used by your
// Firebase assets collection.
//
// Example TV document:
//
// asset_status:       "available"
// asset_type:         "furniture"
// category:           "livingroom"
// id:                 "A-4BERBM"
// model_path:         "assets/furniture/livingroom/TV.glb"
// name:               "TV"
// placement_surface:  "wall"
// price:              500
// thumbnail_path:     ""
//
// created_at / updated_at are also present in the
// document, but they are not needed by the Asset type.
//==================================================

interface FirebaseFurnitureAsset {

    id?: unknown;

    name?: unknown;

    asset_type?: unknown;

    asset_status?: unknown;

    category?: unknown;

    price?: unknown;

    model_path?: unknown;

    thumbnail_path?: unknown;

    //--------------------------------------------------
    // Current Firebase field is singular:
    // placement_surface: "wall"
    //--------------------------------------------------

    placement_surface?: unknown;

    //--------------------------------------------------
    // Keep support for the old plural format too.
    //--------------------------------------------------

    placement_surfaces?: unknown;

    //--------------------------------------------------
    // Optional fields for future/admin versions.
    //--------------------------------------------------

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

let cachedFurnitureAssets: Asset[] = [];

let furnitureCatalogLoaded =
    false;

let furnitureCatalogPromise:
    Promise<Asset[]> | null =
    null;


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
            "Failed to resolve Firebase furniture storage file:",
            path,
            error
        );

        return undefined;

    }

}


//==================================================
// CATEGORY NORMALIZER
//==================================================

function normalizeFurnitureCategory(
    value: unknown
): FurnitureCategory | undefined {

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

        //--------------------------------------------------
        // These are not furniture categories.
        //--------------------------------------------------

        case "door":
        case "doors":
        case "window":
        case "windows":
        case "opening":
        case "openings":
            return undefined;

        default:
            return undefined;

    }

}


//==================================================
// READ PLACEMENT SURFACE
//==================================================
//
// Supports the CURRENT Firebase format:
//
//     placement_surface: "wall"
//
// and also the previous/plural format:
//
//     placement_surfaces: ["wall"]
//
// The Firebase value is converted into the Asset
// format used by the editor:
//
//     placementSurfaces: ["wall"]
//==================================================

function readPlacementSurfaces(
    data: FirebaseFurnitureAsset
): Asset["placementSurfaces"] {

    //--------------------------------------------------
    // Current singular field
    //--------------------------------------------------

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


    //--------------------------------------------------
    // Backward-compatible plural field
    //--------------------------------------------------

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


    //--------------------------------------------------
    // Missing placement surface
    //
    // Keep floor as a compatibility fallback for old
    // furniture documents that have no placement field.
    //--------------------------------------------------

    return [
        "floor"
    ];

}


//==================================================
// READ SNAP TARGETS
//==================================================

function readSnapTargets(
    data: FirebaseFurnitureAsset
): Asset["snapTargets"] {

    //--------------------------------------------------
    // Current singular field
    //--------------------------------------------------

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


    //--------------------------------------------------
    // Plural field
    //--------------------------------------------------

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


    //--------------------------------------------------
    // Default
    //--------------------------------------------------

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
    // Only furniture documents
    //--------------------------------------------------

    if (
        data.asset_type !==
        "furniture"
    ) {

        return null;

    }


    //--------------------------------------------------
    // Only available assets
    //--------------------------------------------------

    if (
        typeof data.asset_status ===
        "string" &&
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

        console.warn(
            "Skipping Firebase furniture asset with unsupported category:",
            documentId,
            data.category
        );

        return null;

    }


    //--------------------------------------------------
    // Model
    //--------------------------------------------------

    const modelUrl =
        await resolveStorageUrl(
            data.model_path
        );

    if (
        !modelUrl
    ) {

        console.warn(
            "Skipping Firebase furniture asset without a usable model_path:",
            documentId,
            data.model_path
        );

        return null;

    }


    //--------------------------------------------------
    // Thumbnail
    //--------------------------------------------------
    //
    // An empty thumbnail_path is allowed.
    // The asset can still load and place correctly.
    //--------------------------------------------------

    const thumbnailUrl =
        await resolveStorageUrl(
            data.thumbnail_path
        );


    //--------------------------------------------------
    // ID
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


    const price =
        Number.isFinite(
            parsedPrice
        )
            ? parsedPrice
            : 0;


    //--------------------------------------------------
    // Optional rotation
    //--------------------------------------------------

    const parsedRotationOffsetY =
        Number(
            data.rotation_offset_y ?? 0
        );


    const rotationOffsetY =
        Number.isFinite(
            parsedRotationOffsetY
        )
            ? parsedRotationOffsetY
            : 0;


    //--------------------------------------------------
    // Optional depth offset
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
    // Placement surface
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
    // Convert Firebase document → Asset
    //--------------------------------------------------

    return {

        id:
            assetId,

        name:
            name,

        thumbnail:
            thumbnailUrl ?? "",

        model:
            modelUrl,

        type:
            BuildTool.Furniture,

        price:
            price,

        furnitureCategory:
            furnitureCategory,

        rotationOffsetY:
            rotationOffsetY,

        depthOffset:
            depthOffset,

        placementSurfaces:
            placementSurfaces,

        snapTargets:
            snapTargets

    } satisfies Asset;

}


//==================================================
// LOAD FURNITURE CATALOG
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


    //--------------------------------------------------
    // Firestore returns the complete document.
    // buildFurnitureAsset() maps the fields the editor
    // actually needs.
    //--------------------------------------------------

    const results =
        await Promise.allSettled(

            snapshot.docs.map(

                async document =>

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

        }

        else {

            console.error(
                "Failed to build Firebase furniture asset:",
                result.reason
            );

        }

    }


    //--------------------------------------------------
    // Stable order
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

    //--------------------------------------------------
    // Already loaded
    //--------------------------------------------------

    if (
        furnitureCatalogLoaded
    ) {

        return cachedFurnitureAssets;

    }


    //--------------------------------------------------
    // Reuse active request
    //--------------------------------------------------

    if (
        furnitureCatalogPromise
    ) {

        return furnitureCatalogPromise;

    }


    //--------------------------------------------------
    // Start request
    //--------------------------------------------------

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
// GET CACHED FURNITURE ASSET
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
// GET CACHED FURNITURE ASSETS
//==================================================

export function getCachedFurnitureAssets():
    Asset[] {

    return cachedFurnitureAssets;

}


//==================================================
// REFRESH FURNITURE ASSETS
//==================================================

export async function refreshFurnitureAssets():
    Promise<Asset[]> {

    cachedFurnitureAssets =
        [];

    furnitureCatalogLoaded =
        false;

    furnitureCatalogPromise =
        null;

    return getFurnitureAssets();

}
