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

    thumbnail_path?: unknown;

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
//
// Your old local AssetLibrary had rotation/scale values
// that are not currently stored in Firebase.
//
// These defaults preserve the existing behavior for the
// models you are already using. If the admin later adds
// `scale` and `rotation_offset_y`, those Firebase values
// override these defaults.
//==================================================

function getDefaultModelSettings(
    category: "doors" | "windows",
    modelPath: string
): {
    scale: number;
    rotationOffsetY: number;
} {

    //--------------------------------------------------
    // Door
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
    // Existing Slim Intersection window
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
    // Existing Glass Window
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
    // Your Firestore currently uses asset_type="furniture"
    // even for doors/windows.
    //--------------------------------------------------

    if (
        typeof data.asset_type === "string" &&
        data.asset_type.trim().toLowerCase() !==
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
        data.asset_status.trim().toLowerCase() !==
            "available"
    ) {

        return null;
    }

    //--------------------------------------------------
    // Door or window category
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
    // Model path
    //--------------------------------------------------

    if (
        typeof data.model_path !== "string" ||
        data.model_path.trim() === ""
    ) {

        console.warn(
            "Skipping Firebase door/window without model_path:",
            documentId
        );

        return null;
    }

    const modelPath =
        data.model_path.trim();

    const modelUrl =
        await resolveStorageUrl(
            modelPath
        );

    if (
        !modelUrl
    ) {

        return null;
    }

    //--------------------------------------------------
    // Thumbnail is optional because your current
    // documents have thumbnail_path="".
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

    const priceNumber =
        Number(
            data.price ?? 0
        );

    //--------------------------------------------------
    // Defaults preserving the old local behavior
    //--------------------------------------------------

    const defaults =
        getDefaultModelSettings(
            category,
            modelPath
        );

    //--------------------------------------------------
    // Optional Firebase override
    //--------------------------------------------------

    const firebaseScale =
        Number(
            data.scale
        );

    const firebaseRotation =
        Number(
            data.rotation_offset_y
        );

    const scale =
        Number.isFinite(
            firebaseScale
        ) &&
        firebaseScale > 0
            ? firebaseScale
            : defaults.scale;

    const rotationOffsetY =
        Number.isFinite(
            firebaseRotation
        )
            ? firebaseRotation
            : defaults.rotationOffsetY;

    //--------------------------------------------------
    // BuildTool type
    //--------------------------------------------------

    const type =
        category === "doors"
            ? BuildTool.Door
            : BuildTool.Window;

    //--------------------------------------------------
    // Convert Firebase → existing Asset shape
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
        // Doors/windows are wall elements.
        // This field is mainly metadata for the existing
        // asset structure; the BuildPlacement logic remains
        // unchanged.
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
    // Firebase currently stores doors/windows under:
    // asset_type = "furniture"
    // category = "doors" / "windows"
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

    assets.sort(
        (
            first,
            second
        ) =>
            first.name.localeCompare(
                second.name
            )
    );

    cachedAssets =
        assets;

    catalogLoaded =
        true;

    return cachedAssets;
}


//==================================================
// GET ALL DOORS + WINDOWS
//==================================================

export async function getDoorWindowAssets(): Promise<Asset[]> {

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

export async function getDoorAssets(): Promise<Asset[]> {

    const assets =
        await getDoorWindowAssets();

    return assets.filter(
        asset =>
            asset.type ===
            BuildTool.Door
    );
}


//==================================================
// GET WINDOWS
//==================================================

export async function getWindowAssets(): Promise<Asset[]> {

    const assets =
        await getDoorWindowAssets();

    return assets.filter(
        asset =>
            asset.type ===
            BuildTool.Window
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


export function getCachedDoorAsset(
    assetId: string
): Asset | undefined {

    const asset =
        getCachedDoorWindowAsset(
            assetId
        );

    return asset?.type ===
        BuildTool.Door
        ? asset
        : undefined;
}


export function getCachedWindowAsset(
    assetId: string
): Asset | undefined {

    const asset =
        getCachedDoorWindowAsset(
            assetId
        );

    return asset?.type ===
        BuildTool.Window
        ? asset
        : undefined;
}


//==================================================
// REFRESH
//==================================================

export async function refreshDoorWindowAssets(): Promise<Asset[]> {

    cachedAssets = [];

    catalogLoaded =
        false;

    catalogPromise =
        null;

    return getDoorWindowAssets();
}
