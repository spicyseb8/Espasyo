import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";
import {
    Texture,
    TextureLoader
} from "three";

import {
    db
} from "../../firebase/firebase";
import {
    isFloorPattern,
    isHerringboneTileRatio
} from "../../../../shared/flooring/patterns";
import {
    registerAssetDownloadURL,
    resolveStorageAssetURL
} from "@/lib/assetLibraryCache";

import type {
    Material
} from "../../components/project-loader/engine/materials/MaterialTypes";


//==================================================
// FIREBASE WALL ASSET
//==================================================

interface FirebaseWallAsset {

    name:
        string;

    asset_type:
        "wall" | "floor";

    shareWithWalls?:
        boolean;

    asset_status?:
        string;

    category:
        string;

    price:
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


    //--------------------------------------------------
    // OLD STORAGE PATHS
    //--------------------------------------------------

    thumbnail_path?:
        string;

    base_color_path?:
        string;

    diffuse_path?:
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

    diffuse_url?:
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

const wallTextureLoader =
    new TextureLoader();

const wallTextureCache =
    new Map<string, Texture>();

const wallTexturePromises =
    new Map<string, Promise<Texture>>();

let wallMaterialsLoaded =
    false;

let wallMaterialsPromise:
    Promise<Material[]> | null =
    null;


//==================================================
// STORAGE URL FALLBACK
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
    // Already a browser URL
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
    // Firebase Storage path
    //--------------------------------------------------

    try {

        return await resolveStorageAssetURL(path, cacheable);

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
    data: FirebaseWallAsset,
    cacheable: boolean,
): Promise<string | undefined> {

    //--------------------------------------------------
    // Direct URL
    //--------------------------------------------------

    if (
        data.asset_type === "wall" &&
        (data.category === "paint" || data.color?.trim())
    ) {
        return undefined;
    }

    return resolveStorageUrl(
        data.base_color_url?.trim() ||
        data.diffuse_url?.trim() ||
        data.base_color_path ||
        data.diffuse_path,
        cacheable,
    );
}


//==================================================
// GET WALL THUMBNAIL URL
//==================================================

async function getWallThumbnailUrl(
    data: FirebaseWallAsset,
    cacheable: boolean,
): Promise<string | undefined> {

    //--------------------------------------------------
    // Direct URL
    //--------------------------------------------------

    if (
        data.thumbnail_url?.trim()
    ) {

        return resolveStorageUrl(data.thumbnail_url.trim(), cacheable);
    }


    //--------------------------------------------------
    // Old Storage path
    //--------------------------------------------------

    return resolveStorageUrl(
        data.thumbnail_path,
        cacheable,
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

    const assets = collection(db, "assets");
    const [wallsSnapshot, sharedAssetsSnapshot] = await Promise.all([
        getDocs(query(assets, where("asset_type", "==", "wall"))),
        getDocs(query(assets, where("shareWithWalls", "==", true)))
    ]);
    const sharedFloorDocs = sharedAssetsSnapshot.docs.filter(document => {
        const data = document.data() as FirebaseWallAsset;
        return data.asset_type === "floor" && data.shareWithWalls === true;
    });
    const documents = [...wallsSnapshot.docs, ...sharedFloorDocs];

    console.log("Admin wall material documents found:", documents.length);


    //--------------------------------------------------
    // Convert Firebase documents
    //--------------------------------------------------

    const results =
        await Promise.allSettled(

            documents.map(

                async doc => {

                    const data =
                        doc.data() as
                        FirebaseWallAsset;

                    if (
                        data.asset_type === "floor" &&
                        (data.shareWithWalls !== true ||
                            data.asset_status?.trim().toLowerCase() !== "available")
                    ) {
                        return null;
                    }

                    if (
                        typeof data.asset_status === "string" &&
                        data.asset_status.trim().toLowerCase() === "not_available"
                    ) {
                        return null;
                    }

                    const cacheable =
                        typeof data.asset_status === "string" &&
                        data.asset_status.trim().toLowerCase() === "available";


                    //--------------------------------------------------
                    // Resolve thumbnail
                    //--------------------------------------------------

                    const [resolvedThumbnail, texture] = await Promise.all([
                        getWallThumbnailUrl(data, cacheable),
                        getWallTextureUrl(data, cacheable)
                    ]);
                    const thumbnail = resolvedThumbnail ?? texture;


                    //--------------------------------------------------
                    // Resolve texture
                    //
                    // This may be undefined for paint materials.
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
                    const floorPattern = isFloorPattern(data.floorPattern)
                        ? data.floorPattern
                        : undefined;
                    const floorMaterialMode =
                        data.floorMaterialMode === "single-tile" &&
                        floorPattern &&
                        length &&
                        width &&
                        (floorPattern !== "herringbone" ||
                            isHerringboneTileRatio(length, width))
                            ? "single-tile"
                            : undefined;
                    const floorPricePerPiece =
                        data.asset_type === "floor" &&
                        typeof data.pricePerPiece === "number" &&
                        Number.isFinite(data.pricePerPiece) &&
                        data.pricePerPiece >= 0
                            ? data.pricePerPiece
                            : undefined;


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
                            floorPricePerPiece !== undefined && length && width
                                ? floorPricePerPiece / (length * width)
                                : Number(data.price ?? 0),

                        length,

                        width,

                        floorPattern,

                        floorMaterialMode,

                        thumbnail,

                        texture,

                        color:
                            data.color,

                        roughness:
                            data.roughness,

                        metalness:
                            data.metalness

                    };


                    console.debug("Loaded admin wall material.", {
                        id: material.id,
                        hasTexture: Boolean(material.texture),
                        hasColor: Boolean(material.color),
                    });


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

            const material =
                result.value;

            if (!material) {
                continue;
            }


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
            ) {

                materials.push(
                    material
                );

            } else {

                console.warn(

                    "Skipping wall material with no texture or color:",

                    material.id,

                    material.name

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


    console.info("Admin wall materials loaded.", {
        count: cachedWallMaterials.length,
    });


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
// WALL TEXTURE CACHE
//==================================================

export function preloadWallTexture(
    url: string
): Promise<Texture> {
    const normalizedUrl = url.trim();
    const cachedTexture = wallTextureCache.get(normalizedUrl);

    if (cachedTexture) {
        return Promise.resolve(cachedTexture);
    }

    const existingPromise = wallTexturePromises.get(normalizedUrl);

    if (existingPromise) {
        return existingPromise;
    }

    const promise = wallTextureLoader
        .loadAsync(normalizedUrl)
        .then(texture => {
            wallTextureCache.set(normalizedUrl, texture);
            return texture;
        })
        .finally(() => {
            wallTexturePromises.delete(normalizedUrl);
        });

    wallTexturePromises.set(normalizedUrl, promise);
    return promise;
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

export function getCachedWallTexture(url: string): Texture | undefined {
    return wallTextureCache.get(url.trim());
}