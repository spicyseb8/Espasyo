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
    RepeatWrapping,
    SRGBColorSpace,
    Texture,
    TextureLoader
} from "three";

import {
    db,
    storage
} from "../../firebase/firebase";

import type {
    Material
} from "./MaterialTypes";

import localDefaultFloorTexture from "../../../uploads/default_floor/assets_floors_Tiles_terrazo_tiles_Diffuse.png";


//==================================================
// DEFAULT FLOOR
//==================================================
//
// This ID still matches the Firebase Terrazo Tiles
// material:
//
// id: A-26015
// name: Terrazo Tiles
//
// IMPORTANT:
// The actual default floor texture is now LOCAL.
//
// This means a newly created room does NOT need to wait
// for Firebase Storage before showing its floor.
//==================================================

export const DEFAULT_FLOOR_MATERIAL_ID =
    "A-26015";


//==================================================
// LOCAL DEFAULT FLOOR TEXTURE
//==================================================
//
// Vite converts this imported file into a browser URL.
//
// Actual file:
//
// client/uploads/default_floor/
// assets_floors_Tiles_terrazo_tiles_Diffuse.png
//
//==================================================

export const LOCAL_DEFAULT_FLOOR_TEXTURE =
    localDefaultFloorTexture;


//==================================================
// FIREBASE FLOOR ASSET
//==================================================

interface FirebaseFloorAsset {

    id?:
        string;

    asset_status?:
        string;

    asset_type:
        "floor";

    category?:
        string;

    price?:
        number;

    name:
        string;

    diffuse_path?:
        string;

    storage_path?:
        string;

    thumbnail_path?:
        string;

    color?:
        string;

    roughness?:
        number;

    metalness?:
        number;
}


//==================================================
// DEFAULT FLOOR CACHE
//==================================================
//
// This is created immediately from the local PNG.
//
// Firebase metadata can replace/enrich it later when
// the complete catalog is loaded.
//==================================================

let cachedDefaultFloorMaterial:
    Material | null =
    null;


//==================================================
// COMPLETE FLOOR CACHE
//==================================================

let cachedFloorMaterials:
    Material[] = [];

let floorCatalogLoaded =
    false;

let floorMaterialsPromise:
    Promise<Material[]> | null =
    null;


//==================================================
// TEXTURE LOADER
//==================================================

const floorTextureLoader =
    new TextureLoader();


//==================================================
// TEXTURE CACHE
//==================================================

const floorTextureCache =
    new Map<
        string,
        Texture
    >();


//==================================================
// TEXTURE PROMISE CACHE
//==================================================

const floorTexturePromises =
    new Map<
        string,
        Promise<Texture | null>
    >();


//==================================================
// LOCAL DEFAULT MATERIAL
//==================================================
//
// This material exists without Firebase.
//
// Price is temporarily 0 until the Firebase catalog
// provides the real metadata for A-26015.
//
// The actual texture is ALWAYS the local PNG.
//==================================================

function createLocalDefaultFloorMaterial(
    firebaseMaterial?: Material
): Material {

    return {

        id:
            DEFAULT_FLOOR_MATERIAL_ID,

        name:
            firebaseMaterial?.name ??
            "Terrazo Tiles",

        category:
            firebaseMaterial?.category ??
            "flooring",

        pricePerSquareMeter:
            firebaseMaterial?.pricePerSquareMeter ??
            0,

        thumbnail:
            firebaseMaterial?.thumbnail ??
            LOCAL_DEFAULT_FLOOR_TEXTURE,

        texture:
            LOCAL_DEFAULT_FLOOR_TEXTURE,

        color:
            firebaseMaterial?.color ??
            "#ffffff",

        roughness:
            firebaseMaterial?.roughness ??
            0.8,

        metalness:
            firebaseMaterial?.metalness ??
            0

    };
}


//==================================================
// RESOLVE STORAGE URL
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
    // Already a browser URL.
    //--------------------------------------------------

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
    ) {

        return path;
    }


    //--------------------------------------------------
    // Firebase Storage path.
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
            "Failed to resolve Firebase Storage floor file:",
            path,
            error
        );

        return undefined;
    }
}


//==================================================
// BUILD MATERIAL
//==================================================

async function buildFloorMaterial(
    documentId: string,
    data: FirebaseFloorAsset,
    includeThumbnail: boolean
): Promise<Material | null> {

    const materialId =
        data.id?.trim() ||
        documentId;


    //--------------------------------------------------
    // Load diffuse texture URL.
    //--------------------------------------------------

    const texture =
        await resolveStorageUrl(
            data.diffuse_path
        );


    //--------------------------------------------------
    // No diffuse image.
    //--------------------------------------------------

    if (
        !texture
    ) {

        console.warn(
            "Skipping floor without a usable diffuse_path:",
            materialId,
            data.diffuse_path
        );

        return null;
    }


    //--------------------------------------------------
    // Thumbnail.
    //--------------------------------------------------

    let thumbnail:
        string | undefined;


    if (
        includeThumbnail
    ) {

        if (
            data.thumbnail_path
        ) {

            thumbnail =
                await resolveStorageUrl(
                    data.thumbnail_path
                ) ??
                texture;

        } else {

            thumbnail =
                texture;

        }
    }


    //--------------------------------------------------
    // Firebase material.
    //--------------------------------------------------

    return {

        id:
            materialId,

        name:
            data.name,

        category:
            "flooring",

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


//==================================================
// GET DEFAULT FLOOR MATERIAL
//==================================================
//
// IMPORTANT:
//
// This no longer waits for Firebase.
//
// It immediately returns a material using the local
// Terrazo PNG.
//
// The Firebase catalog can still load afterwards and
// provide the real price/name/etc.
//==================================================

export async function getDefaultFloorMaterial():
    Promise<Material | null> {

    //--------------------------------------------------
    // Already cached.
    //--------------------------------------------------

    if (
        cachedDefaultFloorMaterial
    ) {

        return cachedDefaultFloorMaterial;
    }


    //--------------------------------------------------
    // Create immediately from LOCAL texture.
    //--------------------------------------------------

    cachedDefaultFloorMaterial =
        createLocalDefaultFloorMaterial();


    //--------------------------------------------------
    // Begin preloading the local texture.
    //
    // This does not block room creation.
    //--------------------------------------------------

    preloadFloorTexture(
        LOCAL_DEFAULT_FLOOR_TEXTURE
    );


    return cachedDefaultFloorMaterial;
}


//==================================================
// LOAD COMPLETE FLOOR CATALOG
//==================================================

async function loadFloorMaterials():
    Promise<Material[]> {

    const floorQuery =
        query(

            collection(
                db,
                "assets"
            ),

            where(
                "asset_type",
                "==",
                "floor"
            )

        );


    const snapshot =
        await getDocs(
            floorQuery
        );


    //--------------------------------------------------
    // Load all floor materials.
    //--------------------------------------------------

    const results =
        await Promise.allSettled(

            snapshot.docs.map(
                async document => {

                    const data =
                        document.data() as
                        FirebaseFloorAsset;


                    return buildFloorMaterial(

                        document.id,

                        data,

                        true

                    );

                }
            )

        );


    const materials:
        Material[] = [];


    //--------------------------------------------------
    // Keep successful materials only.
    //--------------------------------------------------

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

                materials.push(
                    result.value
                );

            }

        } else {

            console.error(
                "Failed to load a Firebase floor material:",
                result.reason
            );

        }
    }


    //--------------------------------------------------
    // Put Terrazo Tiles first.
    //--------------------------------------------------

    materials.sort(
        (
            first,
            second
        ) => {

            if (
                first.id ===
                DEFAULT_FLOOR_MATERIAL_ID
            ) {

                return -1;
            }


            if (
                second.id ===
                DEFAULT_FLOOR_MATERIAL_ID
            ) {

                return 1;
            }


            return 0;
        }
    );


    //--------------------------------------------------
    // Save catalog.
    //--------------------------------------------------

    cachedFloorMaterials =
        materials;

    floorCatalogLoaded =
        true;


    //--------------------------------------------------
    // If Firebase contains A-26015, use its metadata
    // but KEEP the LOCAL texture as the default texture.
    //--------------------------------------------------

    const firebaseDefaultMaterial =
        materials.find(
            material =>
                material.id ===
                DEFAULT_FLOOR_MATERIAL_ID
        );


    if (
        firebaseDefaultMaterial
    ) {

        cachedDefaultFloorMaterial =
            createLocalDefaultFloorMaterial(
                firebaseDefaultMaterial
            );

    }


    //--------------------------------------------------
    // Preload local default texture again.
    //
    // It is already cached when possible, so this is
    // effectively free after the first load.
    //--------------------------------------------------

    preloadFloorTexture(
        LOCAL_DEFAULT_FLOOR_TEXTURE
    );


    return cachedFloorMaterials;
}


//==================================================
// GET ALL FLOOR MATERIALS
//==================================================

export async function getFloorMaterials():
    Promise<Material[]> {

    //--------------------------------------------------
    // Complete catalog already loaded.
    //--------------------------------------------------

    if (
        floorCatalogLoaded
    ) {

        return cachedFloorMaterials;
    }


    //--------------------------------------------------
    // Existing request.
    //--------------------------------------------------

    if (
        floorMaterialsPromise
    ) {

        return floorMaterialsPromise;
    }


    //--------------------------------------------------
    // Start catalog request.
    //--------------------------------------------------

    floorMaterialsPromise =
        loadFloorMaterials()
            .finally(
                () => {

                    floorMaterialsPromise =
                        null;

                }
            );


    return floorMaterialsPromise;
}


//==================================================
// FIND CACHED FLOOR MATERIAL
//==================================================

export function findCachedFloorMaterial(
    materialId: string
): Material | undefined {

    //--------------------------------------------------
    // Search complete catalog.
    //--------------------------------------------------

    const catalogMaterial =
        cachedFloorMaterials.find(
            material =>
                material.id ===
                materialId
        );


    if (
        catalogMaterial
    ) {

        return catalogMaterial;
    }


    //--------------------------------------------------
    // Search default cache.
    //--------------------------------------------------

    if (
        cachedDefaultFloorMaterial?.id ===
        materialId
    ) {

        return cachedDefaultFloorMaterial;
    }


    return undefined;
}


//==================================================
// GET CACHED TEXTURE
//==================================================

export function getCachedFloorTexture(
    url?: string
): Texture | undefined {

    if (
        !url
    ) {

        return undefined;
    }


    return floorTextureCache.get(
        url.trim()
    );
}


//==================================================
// PRELOAD FLOOR TEXTURE
//==================================================

export function preloadFloorTexture(
    url?: string
): Promise<Texture | null> {

    if (
        !url ||
        url.trim() === ""
    ) {

        return Promise.resolve(
            null
        );
    }


    const normalizedUrl =
        url.trim();


    //--------------------------------------------------
    // Already cached.
    //--------------------------------------------------

    const cachedTexture =
        floorTextureCache.get(
            normalizedUrl
        );


    if (
        cachedTexture
    ) {

        return Promise.resolve(
            cachedTexture
        );
    }


    //--------------------------------------------------
    // Already loading.
    //--------------------------------------------------

    const existingPromise =
        floorTexturePromises.get(
            normalizedUrl
        );


    if (
        existingPromise
    ) {

        return existingPromise;
    }


    //--------------------------------------------------
    // Start texture load.
    //--------------------------------------------------

    const promise =
        new Promise<Texture | null>(
            resolve => {

                floorTextureLoader.load(

                    normalizedUrl,

                    texture => {

                        //--------------------------------------------------
                        // Diffuse texture.
                        //--------------------------------------------------

                        texture.colorSpace =
                            SRGBColorSpace;


                        //--------------------------------------------------
                        // Repeat.
                        //--------------------------------------------------

                        texture.wrapS =
                            RepeatWrapping;

                        texture.wrapT =
                            RepeatWrapping;


                        texture.repeat.set(
                            1,
                            1
                        );


                        texture.needsUpdate =
                            true;


                        //--------------------------------------------------
                        // Cache.
                        //--------------------------------------------------

                        floorTextureCache.set(
                            normalizedUrl,
                            texture
                        );


                        resolve(
                            texture
                        );

                    },

                    undefined,

                    error => {

                        console.error(
                            "Failed to load floor texture:",
                            normalizedUrl,
                            error
                        );

                        resolve(
                            null
                        );
                    }

                );
            }
        )
        .finally(
            () => {

                floorTexturePromises.delete(
                    normalizedUrl
                );

            }
        );


    floorTexturePromises.set(
        normalizedUrl,
        promise
    );


    return promise;
}


//==================================================
// REFRESH
//==================================================

export async function refreshFloorMaterials():
    Promise<Material[]> {

    cachedDefaultFloorMaterial =
        null;

    cachedFloorMaterials =
        [];

    floorCatalogLoaded =
        false;

    floorMaterialsPromise =
        null;


    //--------------------------------------------------
    // Recreate local default immediately.
    //--------------------------------------------------

    cachedDefaultFloorMaterial =
        createLocalDefaultFloorMaterial();


    preloadFloorTexture(
        LOCAL_DEFAULT_FLOOR_TEXTURE
    );


    return getFloorMaterials();
}