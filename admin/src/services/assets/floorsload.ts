import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

import {
    CanvasTexture,
    RepeatWrapping,
    SRGBColorSpace,
    Texture,
    TextureLoader
} from "three";
import {
    createFloorPatternLayout,
    isFloorPattern
} from "../../../../shared/flooring/patterns";
import type {
    FloorPatternLayout
} from "../../../../shared/flooring/patterns";
import {
    createFloorPatternCanvas
} from "../../../../shared/flooring/patternCanvas";
import {
    getFloorCanvasImageSource
} from "../../../../shared/flooring/patternCanvas";

import {
    db
} from "../../firebase/firebase";
import {
    registerAssetDownloadURL,
    resolveStorageAssetURL
} from "@/lib/assetLibraryCache";

import type {
    Material
} from "../../components/project-loader/engine/materials/MaterialTypes";

import localDefaultFloorTexture from "../../assets/assets_floors_Tiles_terrazo_tiles_Diffuse.png";


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
//
// The actual default floor texture is LOCAL.
//
// This means a newly created room does NOT need to wait
// for Firebase Storage before showing its floor.
//==================================================

export const DEFAULT_FLOOR_MATERIAL_ID =
    "FL-00426";


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

    pricePerPiece?:
        number;

    length?:
        number;

    width?:
        number;

    floorMaterialMode?:
        "single-tile";

    floorPattern?:
        string;

    name:
        string;

    //--------------------------------------------------
    // OLD STORAGE PATH
    //--------------------------------------------------

    diffuse_path?:
        string;

    storage_path?:
        string;

    thumbnail_path?:
        string;

    //--------------------------------------------------
    // NEW DIRECT URL FIELDS
    //
    // These should contain the actual HTTPS Firebase
    // Storage download URLs.
    //--------------------------------------------------

    diffuse_url?:
        string;

    thumbnail_url?:
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

const floorPatternTextureCache =
    new Map<string, Texture>();

const floorPatternTexturePromises =
    new Map<string, Promise<Texture | null>>();

const floorPatternTextureURLs =
    new Map<string, string>();


//==================================================
// LOCAL DEFAULT MATERIAL
//==================================================
//
// This material exists without Firebase.
//
// Price is temporarily 0 until the Firebase catalog
// provides the real metadata for A-26015.
//
// The actual default floor texture is ALWAYS the
// local PNG.
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

        pricePerPiece:
            firebaseMaterial?.pricePerPiece,

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
//
// This remains only as a FALLBACK for older Firestore
// records that still contain diffuse_path or
// thumbnail_path.
//
// New records should use diffuse_url and thumbnail_url.
//==================================================

async function resolveStorageUrl(
    value?: string,
    cacheable = false,
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

        if (cacheable) {
            await registerAssetDownloadURL(path);
        }
        return path;
    }


    //--------------------------------------------------
    // Firebase Storage path.
    //--------------------------------------------------

    try {

        return await resolveStorageAssetURL(path, cacheable);

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

    if (
        typeof data.asset_status === "string" &&
        data.asset_status.trim().toLowerCase() === "not_available"
    ) {
        return null;
    }

    const materialId =
        data.id?.trim() ||
        documentId;
    const cacheable =
        typeof data.asset_status === "string" &&
        data.asset_status.trim().toLowerCase() === "available";


    //--------------------------------------------------
    // LOAD DIFFUSE TEXTURE URL
    //
    // NEW:
    // Prefer diffuse_url directly from Firestore.
    //
    // FALLBACK:
    // If diffuse_url does not exist, resolve
    // diffuse_path through Firebase Storage.
    //--------------------------------------------------

    const texture =
        await resolveStorageUrl(
            data.diffuse_url?.trim() ||
            data.diffuse_path,
            cacheable,
        );


    //--------------------------------------------------
    // No diffuse image.
    //--------------------------------------------------

    if (
        !texture
    ) {

        console.warn(
            "Skipping floor without a usable diffuse_url or diffuse_path:",
            materialId,
            data.diffuse_url ??
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

        //------------------------------------------------
        // NEW:
        // Prefer thumbnail_url directly from Firestore.
        //------------------------------------------------

        if (
            data.thumbnail_url?.trim()
        ) {

            thumbnail =
                await resolveStorageUrl(
                    data.thumbnail_url.trim(),
                    cacheable,
                );

        }

        //------------------------------------------------
        // FALLBACK:
        // Use old thumbnail_path.
        //------------------------------------------------

        else if (
            data.thumbnail_path
        ) {

            thumbnail =
                await resolveStorageUrl(
                    data.thumbnail_path,
                    cacheable,
                ) ??
                texture;

        }

        //------------------------------------------------
        // No thumbnail:
        // Use diffuse texture.
        //------------------------------------------------

        else {

            thumbnail =
                texture;

        }
    }


    //--------------------------------------------------
    // Firebase material.
    //--------------------------------------------------

    const length =
        typeof data.length === "number" &&
        Number.isFinite(data.length) &&
        data.length > 0
            ? data.length
            : undefined;
    const width =
        typeof data.width === "number" &&
        Number.isFinite(data.width) &&
        data.width > 0
            ? data.width
            : undefined;
    const floorPattern =
        isFloorPattern(data.floorPattern)
            ? data.floorPattern
            : undefined;

    return {

        id:
            materialId,

        name:
            data.name,

        category:
            "flooring",

        pricePerSquareMeter:
            data.pricePerPiece === undefined
                ? Number(data.price ?? 0)
                : 0,

        pricePerPiece:
            typeof data.pricePerPiece === "number" &&
            Number.isFinite(data.pricePerPiece) &&
            data.pricePerPiece >= 0
                ? data.pricePerPiece
                : undefined,

        length,

        width,

        floorMaterialMode:
            data.floorMaterialMode === "single-tile" &&
            floorPattern &&
            length &&
            width
                ? "single-tile"
                : undefined,

        floorPattern,

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


export function removeCachedFloorMaterial(materialId: string): void {
    const material = cachedFloorMaterials.find(
        entry => entry.id === materialId
    );
    if (material?.texture) {
        disposeFloorPatternTexturesForURL(material.texture);
    }

    cachedFloorMaterials = cachedFloorMaterials.filter(
        material => material.id !== materialId
    );

    if (cachedDefaultFloorMaterial?.id === materialId) {
        cachedDefaultFloorMaterial = null;
    }
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

function getFloorPatternSettings(
    url: string,
    material: Material
): { key: string; layout: FloorPatternLayout } | null {
    if (material.floorMaterialMode !== "single-tile") return null;

    if (
        !isFloorPattern(material.floorPattern) ||
        typeof material.length !== "number" ||
        !Number.isFinite(material.length) ||
        material.length <= 0 ||
        typeof material.width !== "number" ||
        !Number.isFinite(material.width) ||
        material.width <= 0
    ) {
        throw new RangeError(
            `Single-tile floor material "${material.id}" has invalid pattern settings.`
        );
    }

    return {
        key: JSON.stringify([
            url.trim(),
            material.floorPattern,
            material.length,
            material.width
        ]),
        layout: createFloorPatternLayout(
            material.floorPattern,
            material.length,
            material.width
        )
    };
}

export function getCachedFloorPatternTexture(
    url: string | undefined,
    material: Material
): Texture | undefined {
    if (!url) return undefined;
    const settings = getFloorPatternSettings(url, material);
    return settings
        ? floorPatternTextureCache.get(settings.key)
        : undefined;
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

export function preloadFloorPatternTexture(
    url: string | undefined,
    material: Material
): Promise<Texture | null> {
    if (!url || url.trim() === "") return Promise.resolve(null);

    const settings = getFloorPatternSettings(url, material);
    if (!settings) return preloadFloorTexture(url);

    const cached = floorPatternTextureCache.get(settings.key);
    if (cached) return Promise.resolve(cached);

    const pending = floorPatternTexturePromises.get(settings.key);
    if (pending) return pending;

    const promise = preloadFloorTexture(url)
        .then(sourceTexture => {
            if (!sourceTexture) return null;

            const sourceImage = getFloorCanvasImageSource(sourceTexture.image);
            const canvas = createFloorPatternCanvas(
                sourceImage.image,
                sourceImage.width,
                sourceImage.height,
                settings.layout
            );
            const texture = new CanvasTexture(canvas);
            texture.colorSpace = SRGBColorSpace;
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.needsUpdate = true;
            floorPatternTextureCache.set(settings.key, texture);
            floorPatternTextureURLs.set(settings.key, url.trim());
            return texture;
        })
        .catch(error => {
            console.error(
                "Failed to generate the floor pattern texture:",
                material.id,
                error
            );
            return null;
        })
        .finally(() => {
            floorPatternTexturePromises.delete(settings.key);
        });

    floorPatternTexturePromises.set(settings.key, promise);
    return promise;
}

function disposeFloorPatternTexturesForURL(url: string): void {
    const normalizedURL = url.trim();
    for (const [key, sourceURL] of floorPatternTextureURLs) {
        if (sourceURL !== normalizedURL) continue;
        floorPatternTextureCache.get(key)?.dispose();
        floorPatternTextureCache.delete(key);
        floorPatternTextureURLs.delete(key);
        floorPatternTexturePromises.delete(key);
    }
}

function disposeAllFloorPatternTextures(): void {
    floorPatternTextureCache.forEach(texture => texture.dispose());
    floorPatternTextureCache.clear();
    floorPatternTextureURLs.clear();
    floorPatternTexturePromises.clear();
}


//==================================================
// REFRESH
//==================================================

export async function refreshFloorMaterials():
    Promise<Material[]> {
    disposeAllFloorPatternTextures();

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

export function getCachedFloorMaterials(): Material[] {
    return cachedFloorMaterials;
}