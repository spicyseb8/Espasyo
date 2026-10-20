import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

import {
    RepeatWrapping,
    SRGBColorSpace,
    Texture,
    TextureLoader
} from "three";

import {
    db
} from "../../firebase/firebase";
import {
    registerAssetDownloadURL,
    resolveStorageAssetURL
} from "../../lib/assetLibraryCache";
import {
    collectAssetSources
} from "../../lib/assetLibraryCache";

import type {
    Material
} from "./MaterialTypes";

import localDefaultFloorTexture from "../../../uploads/default_floor/assets_floors_Tiles_terrazo_tiles_Diffuse.png";

//==================================================
// EXTENDED FLOOR MATERIAL TYPE
//==================================================

export type FloorMaterial =
    Material & {
        sourceCategory?: string;
        length?: number;
        width?: number;
    };

//==================================================
// DEFAULT FLOOR
//==================================================

export const DEFAULT_FLOOR_MATERIAL_ID = "FL-00426";

//==================================================
// LOCAL DEFAULT FLOOR TEXTURE
//==================================================

export const LOCAL_DEFAULT_FLOOR_TEXTURE =
    localDefaultFloorTexture;

//==================================================
// FIREBASE FLOOR ASSET
//==================================================

interface FirebaseFloorAsset {
    id?: string;
    asset_status?: string;
    asset_type: "floor";
    category?: string;
    price?: number;
    pricePerPiece?: number;
    name: string;
    length?: number;
    width?: number;

    diffuse_path?: string;
    storage_path?: string;
    thumbnail_path?: string;
    diffuse_url?: string;
    thumbnail_url?: string;
    color?: string;
    roughness?: number;
    metalness?: number;
}

//==================================================
// DEFAULT FLOOR CACHE
//==================================================

let cachedDefaultFloorMaterial: Material | null = null;

//==================================================
// COMPLETE FLOOR CACHE
//==================================================

let cachedFloorMaterials: FloorMaterial[] = [];
let cachedFloorStorageSources: string[] = [];
let floorCatalogLoaded = false;
let floorMaterialsPromise: Promise<FloorMaterial[]> | null = null;

//==================================================
// TEXTURE LOADER
//==================================================

const floorTextureLoader = new TextureLoader();

//==================================================
// TEXTURE CACHE
//==================================================

const floorTextureCache = new Map<string, Texture>();

//==================================================
// TEXTURE PROMISE CACHE
//==================================================

const floorTexturePromises = new Map<
    string,
    Promise<Texture | null>
>();

//==================================================
// LOCAL DEFAULT MATERIAL
//==================================================

function createLocalDefaultFloorMaterial(
    firebaseMaterial?: Material
): Material {
    return {
        id: DEFAULT_FLOOR_MATERIAL_ID,
        name: firebaseMaterial?.name ?? "Terrazo Tiles",
        category: firebaseMaterial?.category ?? "flooring",
        pricePerSquareMeter:
            firebaseMaterial?.pricePerSquareMeter ?? 0,
        pricePerPiece:
            firebaseMaterial?.pricePerPiece,
        thumbnail:
            firebaseMaterial?.thumbnail ??
            LOCAL_DEFAULT_FLOOR_TEXTURE,
        texture: LOCAL_DEFAULT_FLOOR_TEXTURE,
        color: firebaseMaterial?.color ?? "#ffffff",
        roughness: firebaseMaterial?.roughness ?? 0.8,
        metalness: firebaseMaterial?.metalness ?? 0
    };
}

//==================================================
// RESOLVE STORAGE URL
//==================================================

async function resolveStorageUrl(
    value?: string
): Promise<string | undefined> {
    if (!value || value.trim() === "") {
        return undefined;
    }

    const path = value.trim();

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
    ) {
        await registerAssetDownloadURL(path);
        return path;
    }

    try {
        return await resolveStorageAssetURL(path);
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
): Promise<FloorMaterial | null> {
    // Only explicitly available floor materials are loaded.
    if (
        typeof data.asset_status !== "string" ||
        data.asset_status.trim().toLowerCase() !== "available"
    ) {
        console.warn(
            "Skipping unavailable floor material:",
            documentId,
            data.asset_status
        );

        return null;
    }

    const materialId = data.id?.trim() || documentId;

    const texture =
        await resolveStorageUrl(
            data.diffuse_url?.trim() ||
            data.diffuse_path
        );

    if (!texture) {
        console.warn(
            "Skipping floor without a usable diffuse_url or diffuse_path:",
            materialId,
            data.diffuse_url ?? data.diffuse_path
        );

        return null;
    }

    let thumbnail: string | undefined;

    if (includeThumbnail) {
        if (data.thumbnail_url?.trim()) {
            thumbnail =
                await resolveStorageUrl(data.thumbnail_url.trim());
        } else if (data.thumbnail_path) {
            thumbnail =
                await resolveStorageUrl(
                    data.thumbnail_path
                ) ?? texture;
        } else {
            thumbnail = texture;
        }
    }
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

    const hasPiecePrice =
        data.pricePerPiece !== undefined;
    const pricePerPiece =
        typeof data.pricePerPiece === "number" &&
        Number.isFinite(data.pricePerPiece) &&
        data.pricePerPiece >= 0
            ? data.pricePerPiece
            : undefined;

    if (hasPiecePrice && pricePerPiece === undefined) {
        console.warn(
            "Skipping floor with an invalid per-tile price:",
            materialId,
            data.pricePerPiece
        );

        return null;
    }

    return {
    id: materialId,
    name: data.name,
    category: "flooring",

    sourceCategory:
        typeof data.category === "string"
            ? data.category
            : undefined,

    pricePerSquareMeter:
        hasPiecePrice
            ? 0
            : Number(data.price ?? 0),
    pricePerPiece,

    // Use the validated variables declared above.
    length,
    width,

    thumbnail,
    texture,
    color: data.color,
    roughness: data.roughness,
    metalness: data.metalness
} satisfies FloorMaterial;
}

//==================================================
// GET DEFAULT FLOOR MATERIAL
//==================================================

export async function getDefaultFloorMaterial():
    Promise<Material | null> {
    if (cachedDefaultFloorMaterial) {
        return cachedDefaultFloorMaterial;
    }

    cachedDefaultFloorMaterial =
        createLocalDefaultFloorMaterial();

    preloadFloorTexture(LOCAL_DEFAULT_FLOOR_TEXTURE);

    return cachedDefaultFloorMaterial;
}

//==================================================
// LOAD COMPLETE FLOOR CATALOG
//==================================================

async function loadFloorMaterials():
    Promise<FloorMaterial[]> {
    const floorQuery = query(
        collection(db, "assets"),
        where("asset_type", "==", "floor")
    );

    const snapshot = await getDocs(floorQuery);
    cachedFloorStorageSources = snapshot.docs
        .filter(document => {
            const data = document.data() as FirebaseFloorAsset;
            return (
                typeof data.asset_status === "string" &&
                data.asset_status.trim().toLowerCase() === "available"
            );
        })
        .flatMap(document => collectAssetSources(document.data()));

    const results = await Promise.allSettled(
        snapshot.docs.map(
            async document => {
                const data =
                    document.data() as FirebaseFloorAsset;

                return buildFloorMaterial(
                    document.id,
                    data,
                    true
                );
            }
        )
    );

    const materials: FloorMaterial[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            if (result.value) {
                materials.push(result.value);
            }
        } else {
            console.error(
                "Failed to load a Firebase floor material:",
                result.reason
            );
        }
    }

    materials.sort(
        (first, second) => {
            if (first.id === DEFAULT_FLOOR_MATERIAL_ID) {
                return -1;
            }

            if (second.id === DEFAULT_FLOOR_MATERIAL_ID) {
                return 1;
            }

            return 0;
        }
    );

    cachedFloorMaterials = materials;
    floorCatalogLoaded = true;

    const firebaseDefaultMaterial = materials.find(
        material => material.id === DEFAULT_FLOOR_MATERIAL_ID
    );

    if (firebaseDefaultMaterial) {
        cachedDefaultFloorMaterial =
            createLocalDefaultFloorMaterial(
                firebaseDefaultMaterial
            );
    }

    preloadFloorTexture(LOCAL_DEFAULT_FLOOR_TEXTURE);

    return cachedFloorMaterials;
}

//==================================================
// GET ALL FLOOR MATERIALS
//==================================================

export async function getFloorMaterials():
    Promise<FloorMaterial[]> {
    if (floorCatalogLoaded) {
        return cachedFloorMaterials;
    }

    if (floorMaterialsPromise) {
        return floorMaterialsPromise;
    }

    floorMaterialsPromise = loadFloorMaterials()
        .finally(() => {
            floorMaterialsPromise = null;
        });

    return floorMaterialsPromise;
}

//==================================================
// FIND CACHED FLOOR MATERIAL
//==================================================

export function findCachedFloorMaterial(
    materialId: string
): FloorMaterial | undefined {
    const catalogMaterial = cachedFloorMaterials.find(
        material => material.id === materialId
    );

    if (catalogMaterial) {
        return catalogMaterial;
    }

    if (cachedDefaultFloorMaterial?.id === materialId) {
        return {
            ...cachedDefaultFloorMaterial
        };
    }

    return undefined;
}

export function getFloorStorageSources(): string[] {
    return cachedFloorStorageSources;
}

//==================================================
// GET CACHED TEXTURE
//==================================================

export function getCachedFloorTexture(
    url?: string
): Texture | undefined {
    if (!url) {
        return undefined;
    }

    return floorTextureCache.get(url.trim());
}

//==================================================
// PRELOAD FLOOR TEXTURE
//==================================================

export function preloadFloorTexture(
    url?: string
): Promise<Texture | null> {
    if (!url || url.trim() === "") {
        return Promise.resolve(null);
    }

    const normalizedUrl = url.trim();

    const cachedTexture =
        floorTextureCache.get(normalizedUrl);

    if (cachedTexture) {
        return Promise.resolve(cachedTexture);
    }

    const existingPromise =
        floorTexturePromises.get(normalizedUrl);

    if (existingPromise) {
        return existingPromise;
    }

    const promise = new Promise<Texture | null>(
        resolve => {
            floorTextureLoader.load(
                normalizedUrl,
                texture => {
                    texture.colorSpace = SRGBColorSpace;
                    texture.wrapS = RepeatWrapping;
                    texture.wrapT = RepeatWrapping;

                    // Keep the shared cached texture at its default scale.
                    // Each floor can clone it for its own dimensions.
                    texture.repeat.set(1, 1);
                    texture.needsUpdate = true;

                    floorTextureCache.set(
                        normalizedUrl,
                        texture
                    );

                    resolve(texture);
                },
                undefined,
                error => {
                    console.error(
                        "Failed to load floor texture:",
                        normalizedUrl,
                        error
                    );

                    resolve(null);
                }
            );
        }
    ).finally(() => {
        floorTexturePromises.delete(normalizedUrl);
    });

    floorTexturePromises.set(normalizedUrl, promise);

    return promise;
}

//==================================================
// REFRESH
//==================================================

export async function refreshFloorMaterials():
    Promise<FloorMaterial[]> {
    cachedDefaultFloorMaterial = null;
    cachedFloorMaterials = [];
    cachedFloorStorageSources = [];
    floorCatalogLoaded = false;
    floorMaterialsPromise = null;

    cachedDefaultFloorMaterial =
        createLocalDefaultFloorMaterial();

    preloadFloorTexture(LOCAL_DEFAULT_FLOOR_TEXTURE);

    return getFloorMaterials();
}