import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";
import {
    RepeatWrapping,
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
} from "../../lib/assetLibraryCache";
import {
    collectAssetSources
} from "../../lib/assetLibraryCache";

import type {
    Material
} from "./MaterialTypes";

interface FirebaseWallAsset {
    name: string;
    asset_type: "wall" | "floor";
    asset_status?: string;
    shareWithWalls?: boolean;
    category: string;
    price?: number;
    pricePerPiece?: number;
    length?: number;
    width?: number;
    floorMaterialMode?: "single-tile";
    floorPattern?: string;
    thumbnail_path?: string;
    base_color_path?: string;
    diffuse_path?: string;
    normal_path?: string;
    roughness_path?: string;
    thumbnail_url?: string;
    base_color_url?: string;
    diffuse_url?: string;
    color?: string;
    roughness?: number;
    metalness?: number;
}

let cachedWallMaterials: Material[] = [];
let cachedWallStorageSources: string[] = [];
let wallMaterialsLoaded = false;
let wallMaterialsPromise: Promise<Material[]> | null = null;
const wallTextureLoader = new TextureLoader();
const wallTextureCache = new Map<string, Texture>();
const wallTexturePromises = new Map<string, Promise<Texture>>();

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
        path.startsWith("data:") ||
        path.startsWith("blob:")
    ) {
        await registerAssetDownloadURL(path);
        return path;
    }

    const normalizedPath = path.replace(/^\/+/, "");

    try {
        return await resolveStorageAssetURL(normalizedPath);
    } catch (error) {
        console.error(
            "Failed to resolve Firebase Storage file:",
            normalizedPath,
            error
        );

        return undefined;
    }
}

async function getWallTextureUrl(
    data: FirebaseWallAsset
): Promise<string | undefined> {
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
        data.diffuse_path
    );
}

async function getWallThumbnailUrl(
    data: FirebaseWallAsset
): Promise<string | undefined> {
    if (data.thumbnail_url?.trim()) {
        return resolveStorageUrl(data.thumbnail_url);
    }

    return resolveStorageUrl(data.thumbnail_path);
}

async function loadWallMaterials(): Promise<Material[]> {
    const assets = collection(db, "assets");
    const [wallsSnapshot, sharedAssetsSnapshot] = await Promise.all([
        getDocs(query(assets, where("asset_type", "==", "wall"))),
        getDocs(query(assets, where("shareWithWalls", "==", true)))
    ]);
    const sharedFloorDocs = sharedAssetsSnapshot.docs.filter(document => {
        const data = document.data() as FirebaseWallAsset;
        return data.asset_type === "floor" && data.shareWithWalls === true;
    });
    const documents = [
        ...wallsSnapshot.docs,
        ...sharedFloorDocs
    ];

    cachedWallStorageSources = documents
        .filter(document => {
            const data = document.data() as FirebaseWallAsset;
            return (
                typeof data.asset_status === "string" &&
                data.asset_status.trim().toLowerCase() === "available"
            );
        })
        .flatMap(document => collectAssetSources(document.data()));

    console.log("Firebase wall material documents found:", documents.length);

    // Shared floors require both explicit sharing and availability.
    const availableDocuments = documents.filter(doc => {
        const data = doc.data() as FirebaseWallAsset;

        const available =
            typeof data.asset_status === "string" &&
            data.asset_status.trim().toLowerCase() === "available";

        if (!available) {
            console.warn(
                "Skipping unavailable wall material:",
                doc.id,
                data.asset_status
            );
        }

        return available;
    });

    const results = await Promise.allSettled(
        availableDocuments.map(async doc => {
            const data = doc.data() as FirebaseWallAsset;

            const [resolvedThumbnail, texture] = await Promise.all([
                getWallThumbnailUrl(data),
                getWallTextureUrl(data)
            ]);
            const thumbnail = resolvedThumbnail ?? texture;
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
            const pricePerSquareMeter =
                floorPricePerPiece !== undefined && length && width
                    ? floorPricePerPiece / (length * width)
                    : Number(data.price ?? 0);

            const material: Material = {
                id: doc.id,
                name: data.name,
                category: "wallFinish",
                sourceCategory: data.category,
                pricePerSquareMeter,
                ...(data.asset_type === "wall" &&
                data.category.toLowerCase() === "paint"
                    ? { pricePerLiter: Number(data.price ?? 0) }
                    : {}),
                priceConfigured:
                    floorPricePerPiece !== undefined ||
                    (typeof data.price === "number" &&
                        Number.isFinite(data.price) &&
                        data.price >= 0),
                length,
                width,
                floorPattern,
                floorMaterialMode,
                thumbnail,
                texture,
                color: data.color,
                roughness: data.roughness,
                metalness: data.metalness
            };

            console.log("Loaded wall material:", material);

            return material;
        })
    );

    const materials: Material[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            const material = result.value;

            const usable =
                Boolean(material.texture) ||
                Boolean(material.color);

            if (usable) {
                materials.push(material);
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

    cachedWallMaterials = materials;
    wallMaterialsLoaded = true;

    console.log(
        "Final wall materials:",
        cachedWallMaterials
    );

    return cachedWallMaterials;
}

export async function getWallMaterials(): Promise<Material[]> {
    if (wallMaterialsLoaded) {
        return cachedWallMaterials;
    }

    if (wallMaterialsPromise) {
        return wallMaterialsPromise;
    }

    wallMaterialsPromise = loadWallMaterials()
        .finally(() => {
            wallMaterialsPromise = null;
        });

    return wallMaterialsPromise;
}

export function findCachedWallMaterial(
    materialId: string
): Material | undefined {
    return cachedWallMaterials.find(
        material => material.id === materialId
    );
}

export function getCachedWallTexture(url: string): Texture | undefined {
    return wallTextureCache.get(url.trim());
}

export function preloadWallTexture(url: string): Promise<Texture> {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
        return Promise.reject(new Error("Wall texture URL is empty."));
    }

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
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.needsUpdate = true;
            if (wallTexturePromises.get(normalizedUrl) === promise) {
                wallTextureCache.set(normalizedUrl, texture);
            }
            return texture;
        })
        .finally(() => {
            if (wallTexturePromises.get(normalizedUrl) === promise) {
                wallTexturePromises.delete(normalizedUrl);
            }
        });

    wallTexturePromises.set(normalizedUrl, promise);
    return promise;
}

export function getWallStorageSources(): string[] {
    return cachedWallStorageSources;
}

export async function refreshWallMaterials(): Promise<Material[]> {
    cachedWallMaterials = [];
    cachedWallStorageSources = [];
    wallMaterialsLoaded = false;
    wallMaterialsPromise = null;

    for (const texture of wallTextureCache.values()) {
        texture.dispose();
    }
    wallTextureCache.clear();
    wallTexturePromises.clear();

    return getWallMaterials();
}