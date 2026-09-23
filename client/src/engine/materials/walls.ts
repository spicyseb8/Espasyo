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

import type {
    Material
} from "./MaterialTypes";


//==================================================
// FIREBASE WALL ASSET
//==================================================

interface FirebaseWallAsset {

    name:
        string;

    asset_type:
        "wall";

    category:
        string;

    price:
        number;

    //--------------------------------------------------
    // OLD STORAGE PATHS
    //--------------------------------------------------

    thumbnail_path?:
        string;

    base_color_path?:
        string;

    normal_path?:
        string;

    roughness_path?:
        string;

    //--------------------------------------------------
    // NEW DIRECT URLS
    //
    // These should contain the actual HTTPS Firebase
    // Storage download URLs.
    //--------------------------------------------------

    thumbnail_url?:
        string;

    base_color_url?:
        string;

    //--------------------------------------------------
    // MATERIAL SETTINGS
    //--------------------------------------------------

    color?:
        string;

    roughness?:
        number;

    metalness?:
        number;
}


//==================================================
// CACHE
//==================================================

let cachedWallMaterials:
    Material[] = [];

let wallMaterialsLoaded =
    false;

let wallMaterialsPromise:
    Promise<Material[]> | null =
    null;


//==================================================
// STORAGE URL FALLBACK
//==================================================
//
// This function is kept for backwards compatibility.
//
// NEW documents:
//     base_color_url
//     thumbnail_url
//
// OLD documents:
//     base_color_path
//     thumbnail_path
//
// New URL fields are used directly and do NOT require
// getDownloadURL().
//
//==================================================

async function resolveStorageUrl(
    value?: string
): Promise<string | undefined> {

    if (
        !value ||
        value.trim() === ""
    ) {

        return undefined;
    }

    const path =
        value.trim();


    //--------------------------------------------------
    // Already a normal browser URL
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
    //
    // This is only used for older Firestore documents
    // that do not have the new *_url fields.
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
            "Failed to resolve Firebase Storage file:",
            path,
            error
        );

        return undefined;
    }
}


//==================================================
// GET WALL TEXTURE URL
//==================================================
//
// Prefer the direct URL stored in Firestore.
//
// Fall back to base_color_path for older assets.
//==================================================

async function getWallTextureUrl(
    data: FirebaseWallAsset
): Promise<string | undefined> {

    //--------------------------------------------------
    // NEW DIRECT URL
    //--------------------------------------------------

    if (
        data.base_color_url?.trim()
    ) {

        return data.base_color_url.trim();
    }


    //--------------------------------------------------
    // OLD STORAGE PATH
    //--------------------------------------------------

    return resolveStorageUrl(
        data.base_color_path
    );
}


//==================================================
// GET WALL THUMBNAIL URL
//==================================================
//
// Prefer the direct URL stored in Firestore.
//
// Fall back to thumbnail_path for older assets.
//==================================================

async function getWallThumbnailUrl(
    data: FirebaseWallAsset
): Promise<string | undefined> {

    //--------------------------------------------------
    // NEW DIRECT URL
    //--------------------------------------------------

    if (
        data.thumbnail_url?.trim()
    ) {

        return data.thumbnail_url.trim();
    }


    //--------------------------------------------------
    // OLD STORAGE PATH
    //--------------------------------------------------

    return resolveStorageUrl(
        data.thumbnail_path
    );
}


//==================================================
// LOAD WALL MATERIALS
//==================================================

async function loadWallMaterials():
    Promise<Material[]> {

    const q =
        query(

            collection(
                db,
                "assets"
            ),

            where(
                "asset_type",
                "==",
                "wall"
            )

        );


    const snapshot =
        await getDocs(
            q
        );


    //--------------------------------------------------
    // Build materials
    //================================================--
    //
    // Direct *_url fields are used immediately.
    //
    // Only old records without those fields need
    // getDownloadURL().
    //
    //--------------------------------------------------

    const results =
        await Promise.allSettled(

            snapshot.docs.map(
                async doc => {

                    const data =
                        doc.data() as
                        FirebaseWallAsset;


                    //--------------------------------------------------
                    // Resolve thumbnail
                    //--------------------------------------------------

                    const thumbnail =
                        await getWallThumbnailUrl(
                            data
                        );


                    //--------------------------------------------------
                    // Resolve actual wall texture
                    //--------------------------------------------------

                    const texture =
                        await getWallTextureUrl(
                            data
                        );


                    //--------------------------------------------------
                    // Convert Firebase asset into
                    // client Material format.
                    //--------------------------------------------------

                    return {

                        id:
                            doc.id,

                        name:
                            data.name,

                        category:
                            "wallFinish",

                        pricePerSquareMeter:
                            Number(
                                data.price ?? 0
                            ),

                        thumbnail,

                        texture,

                        color:
                            data.color,

                        roughness:
                            data.roughness,

                        metalness:
                            data.metalness

                    } satisfies Material;

                }
            )

        );


    //--------------------------------------------------
    // Keep successful materials only
    //--------------------------------------------------

    const materials:
        Material[] = [];


    for (
        const result
        of results
    ) {

        if (
            result.status ===
            "fulfilled"
        ) {

            //------------------------------------------------
            // Ignore materials without a usable texture.
            //------------------------------------------------

            if (
                result.value.texture
            ) {

                materials.push(
                    result.value
                );

            } else {

                console.warn(
                    "Skipping wall material without a usable base color texture:",
                    result.value.id,
                    result.value.name
                );

            }

        } else {

            console.error(
                "Failed to load a Firebase wall material:",
                result.reason
            );

        }

    }


    //--------------------------------------------------
    // Save cache
    //--------------------------------------------------

    cachedWallMaterials =
        materials;

    wallMaterialsLoaded =
        true;


    return cachedWallMaterials;
}


//==================================================
// PUBLIC LOADER
//==================================================

export async function getWallMaterials():
    Promise<Material[]> {

    //--------------------------------------------------
    // Already loaded
    //--------------------------------------------------

    if (
        wallMaterialsLoaded
    ) {

        return cachedWallMaterials;
    }


    //--------------------------------------------------
    // Already loading
    //--------------------------------------------------

    if (
        wallMaterialsPromise
    ) {

        return wallMaterialsPromise;
    }


    //--------------------------------------------------
    // Start one Firebase request
    //--------------------------------------------------

    wallMaterialsPromise =
        loadWallMaterials()
            .finally(
                () => {

                    wallMaterialsPromise =
                        null;

                }
            );


    return wallMaterialsPromise;
}


//==================================================
// CACHED MATERIAL FINDER
//==================================================

export function findCachedWallMaterial(
    materialId: string
):
    Material | undefined {

    return cachedWallMaterials.find(
        material =>
            material.id ===
            materialId
    );
}


//==================================================
// FORCE REFRESH
//==================================================

export async function refreshWallMaterials():
    Promise<Material[]> {

    cachedWallMaterials =
        [];

    wallMaterialsLoaded =
        false;

    wallMaterialsPromise =
        null;


    return getWallMaterials();
}