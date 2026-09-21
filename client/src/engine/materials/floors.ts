import {
    collection,
    doc,
    getDoc,
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


//==================================================
// DEFAULT FLOOR
//==================================================
//
// Firebase asset:
//
// id: A-26015
// name: Terrazo Tiles
// category: tiles
//
// This material is loaded first.
//==================================================

export const DEFAULT_FLOOR_MATERIAL_ID =
    "A-26015";


//==================================================
// FIREBASE FLOOR ASSET
//==================================================
//
// Every floor in Firestore is now a PNG-based floor.
//
// Example document (assets / A-26016):
//
// asset_status:  "available"
// asset_type:    "floor"
// category:      "wood"
// diffuse_path:  "assets/floors/Wood/plank_flooring/Diffuse.png"
// id:            "A-26016"
// name:          "Plank Flooring"
// price:         500
// storage_path:  "assets/floors/Wood/plank_flooring"
//
// diffuse_path is the only file the 3D scene needs.
//
// It is typed as optional here because Firestore data
// can never be trusted at compile time. It is checked
// at runtime, and floors without a usable diffuse
// image are skipped.
//
// thumbnail_path / color / roughness / metalness are
// NOT in the current data. They are kept as optional
// overrides so they can be added later per material
// without touching this file again.
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

    // Optional overrides (not in the current data).

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
    //
    // NOTE: Firebase Storage paths are CASE-SENSITIVE.
    // "assets/floors/Wood/plank_flooring/Diffuse.png"
    // must match the file in Storage exactly
    // (capital W, capital D).
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
//
// Returns null when the floor has no usable diffuse
// PNG. Every floor is texture-based now, so a floor
// without a texture would only show up as a blank
// gray entry in the catalog and in the 3D scene.
//==================================================

async function buildFloorMaterial(
    documentId: string,
    data: FirebaseFloorAsset,
    includeThumbnail: boolean
): Promise<Material | null> {

    //--------------------------------------------------
    // Use Firebase's "id" field when available.
    //
    // Example:
    //
    // id: "A-26015"
    //--------------------------------------------------

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
    // No diffuse image: skip this floor.
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
    //
    // The current data has no separate thumbnail, so the
    // diffuse image URL is reused instead of making
    // another Firebase Storage request.
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
    // Convert Firebase asset to Material.
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
// FETCH DEFAULT FLOOR DOCUMENT
//==================================================
//
// Fast path:
// assets / A-26015
//
// Fallback:
// search the Firebase "id" field.
//
// This makes the loader work whether A-26015 is the
// Firestore document ID or only the asset's id field.
//==================================================

async function fetchDefaultFloorDocument():
    Promise<{
        documentId: string;
        data: FirebaseFloorAsset;
    } | null> {

    //--------------------------------------------------
    // FAST PATH
    //--------------------------------------------------

    try {

        const directDocument =
            await getDoc(
                doc(
                    db,
                    "assets",
                    DEFAULT_FLOOR_MATERIAL_ID
                )
            );


        if (
            directDocument.exists()
        ) {

            const data =
                directDocument.data() as
                FirebaseFloorAsset;


            if (
                data.asset_type ===
                "floor"
            ) {

                return {

                    documentId:
                        directDocument.id,

                    data

                };
            }
        }

    } catch (error) {

        console.warn(
            "Direct default floor lookup failed:",
            error
        );
    }


    //--------------------------------------------------
    // FALLBACK BY FIREBASE "id" FIELD
    //--------------------------------------------------

    try {

        const defaultQuery =
            query(

                collection(
                    db,
                    "assets"
                ),

                where(
                    "id",
                    "==",
                    DEFAULT_FLOOR_MATERIAL_ID
                )

            );


        const snapshot =
            await getDocs(
                defaultQuery
            );


        const matchingDocument =
            snapshot.docs.find(
                document => {

                    const data =
                        document.data() as
                        FirebaseFloorAsset;


                    return (
                        data.asset_type ===
                        "floor"
                    );

                }
            );


        if (
            matchingDocument
        ) {

            return {

                documentId:
                    matchingDocument.id,

                data:
                    matchingDocument.data() as
                    FirebaseFloorAsset

            };
        }

    } catch (error) {

        console.error(
            "Fallback default floor lookup failed:",
            error
        );
    }


    console.warn(
        "Default floor asset not found:",
        DEFAULT_FLOOR_MATERIAL_ID
    );


    return null;
}


//==================================================
// GET DEFAULT FLOOR MATERIAL
//==================================================
//
// ONLY the default material is loaded here.
//
// The complete catalog remains unloaded until
// getFloorMaterials() is called afterwards.
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


    try {

        const result =
            await fetchDefaultFloorDocument();


        if (
            !result
        ) {

            return null;
        }


        //--------------------------------------------------
        // No thumbnail is needed for the 3D scene.
        //
        // Returns null if the default floor has no usable
        // diffuse PNG. Floor.tsx then falls back to the
        // first material of the loaded catalog.
        //--------------------------------------------------

        const material =
            await buildFloorMaterial(

                result.documentId,

                result.data,

                false

            );


        if (
            !material
        ) {

            return null;
        }


        cachedDefaultFloorMaterial =
            material;


        return material;

    } catch (error) {

        console.error(
            "Failed to load default floor material:",
            error
        );

        return null;
    }
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
    //
    // One failed texture must not stop the rest.
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
    //
    // "fulfilled" with a null value means the floor was
    // skipped because it has no usable diffuse PNG.
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
    // Save complete catalog.
    //--------------------------------------------------

    cachedFloorMaterials =
        materials;

    floorCatalogLoaded =
        true;


    //--------------------------------------------------
    // Update default cache with complete version.
    //--------------------------------------------------

    const completeDefaultMaterial =
        materials.find(
            material =>
                material.id ===
                DEFAULT_FLOOR_MATERIAL_ID
        );


    if (
        completeDefaultMaterial
    ) {

        cachedDefaultFloorMaterial =
            completeDefaultMaterial;
    }


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
//
// The texture is manually loaded instead of using
// Drei's useTexture(), so loading does not suspend
// the whole React Three Fiber Canvas.
//
// Floor.tsx reads these textures through
// getCachedFloorTexture() / preloadFloorTexture(),
// so Floors.tsx's preload of the default floor is
// really shared with the 3D scene.
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
                        // Diffuse images are color textures.
                        //--------------------------------------------------

                        texture.colorSpace =
                            SRGBColorSpace;


                        //--------------------------------------------------
                        // Repeat.
                        //
                        // ShapeGeometry UVs are in world units
                        // (meters), so repeat 1,1 means one copy of
                        // the image per 1 m x 1 m.
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
//
// Textures are intentionally kept cached because
// already downloaded images can be reused.
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


    return getFloorMaterials();
}