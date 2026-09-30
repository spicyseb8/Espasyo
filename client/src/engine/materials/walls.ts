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
    // Already a browser URL
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

async function getWallTextureUrl(
    data: FirebaseWallAsset
): Promise<string | undefined> {

    //--------------------------------------------------
    // Direct URL
    //--------------------------------------------------

    if (
        data.base_color_url?.trim()
    ) {

        return data.base_color_url.trim();
    }


    //--------------------------------------------------
    // Old Storage path
    //--------------------------------------------------

    return resolveStorageUrl(
        data.base_color_path
    );
}


//==================================================
// GET WALL THUMBNAIL URL
//==================================================

async function getWallThumbnailUrl(
    data: FirebaseWallAsset
): Promise<string | undefined> {

    //--------------------------------------------------
    // Direct URL
    //--------------------------------------------------

    if (
        data.thumbnail_url?.trim()
    ) {

        return data.thumbnail_url.trim();
    }


    //--------------------------------------------------
    // Old Storage path
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

    //--------------------------------------------------
    // IMPORTANT
    //
    // asset_type must actually be "wall" in Firestore.
    //--------------------------------------------------

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


    console.log(
        "Firebase wall asset documents found:",
        snapshot.size
    );


    //--------------------------------------------------
    // Convert Firebase documents
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
                    // Resolve texture
                    //
                    // This may be undefined for paint materials.
                    //--------------------------------------------------

                    const texture =
                        await getWallTextureUrl(
                            data
                        );


                    //--------------------------------------------------
                    // Create Material
                    //
                    // IMPORTANT:
                    //
                    // We DO NOT require texture anymore.
                    // A paint material can use "color".
                    //--------------------------------------------------

                    const material: Material = {

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

                    };


                    console.log(
                        "Loaded wall material:",
                        material
                    );


                    return material;
                }

            )

        );


    //--------------------------------------------------
    // Keep successful materials
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

<<<<<<< HEAD
            //------------------------------------------------
            // FIX:
            // Keep materials that have EITHER a texture URL
            // OR a solid color.
            //
            // Your Firebase wall documents only store
            // `color` (no base_color_path / base_color_url),
            // so the old "texture only" filter was dropping
            // every wall. This accepts color-only walls too.
            //------------------------------------------------

            if (
                result.value.texture ||
                result.value.color
=======
            const material =
                result.value;


            //--------------------------------------------------
            // Accept either:
            //
            // 1. texture
            // 2. color
            //
            // This allows paint-only materials.
            //--------------------------------------------------

            const usable =
                Boolean(
                    material.texture
                ) ||
                Boolean(
                    material.color
                );


            if (
                usable
>>>>>>> cc139a8070444f5086be798897f4fdfdc66a750f
            ) {

                materials.push(
                    material
                );

            } else {

                console.warn(
<<<<<<< HEAD
                    "Skipping wall material without a texture or color:",
                    result.value.id,
                    result.value.name
=======

                    "Skipping wall material with no texture or color:",

                    material.id,

                    material.name

>>>>>>> cc139a8070444f5086be798897f4fdfdc66a750f
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


    console.log(
        "Final wall materials:",
        cachedWallMaterials
    );


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
    // Start Firebase request
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