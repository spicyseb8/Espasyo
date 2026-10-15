import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

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

interface FirebaseWallAsset {
    name: string;
    asset_type: "wall";
    asset_status?: string;
    category: string;
    price: number;
    thumbnail_path?: string;
    base_color_path?: string;
    normal_path?: string;
    roughness_path?: string;
    thumbnail_url?: string;
    base_color_url?: string;
    color?: string;
    roughness?: number;
    metalness?: number;
}

let cachedWallMaterials: Material[] = [];
let cachedWallStorageSources: string[] = [];
let wallMaterialsLoaded = false;
let wallMaterialsPromise: Promise<Material[]> | null = null;

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
    if (data.category === "paint" || data.color?.trim()) {
        return undefined;
    }

    if (data.base_color_url?.trim()) {
        return resolveStorageUrl(data.base_color_url);
    }

    return resolveStorageUrl(data.base_color_path);
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
    const q = query(
        collection(db, "assets"),
        where("asset_type", "==", "wall")
    );

    const snapshot = await getDocs(q);
    cachedWallStorageSources = snapshot.docs
        .filter(document => {
            const data = document.data() as FirebaseWallAsset;
            return (
                typeof data.asset_status === "string" &&
                data.asset_status.trim().toLowerCase() === "available"
            );
        })
        .flatMap(document => collectAssetSources(document.data()));

    console.log(
        "Firebase wall asset documents found:",
        snapshot.size
    );

    // Only explicitly available wall materials and paints are loaded.
    const availableDocuments = snapshot.docs.filter(doc => {
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

            const thumbnail = await getWallThumbnailUrl(data);
            const texture = await getWallTextureUrl(data);

            const material: Material = {
                id: doc.id,
                name: data.name,
                category: "wallFinish",
                pricePerSquareMeter: Number(data.price ?? 0),
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

export function getWallStorageSources(): string[] {
    return cachedWallStorageSources;
}

export async function refreshWallMaterials(): Promise<Material[]> {
    cachedWallMaterials = [];
    cachedWallStorageSources = [];
    wallMaterialsLoaded = false;
    wallMaterialsPromise = null;

    return getWallMaterials();
}