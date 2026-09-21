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

    name: string;

    asset_type: "wall";

    category: string;

    price: number;

    thumbnail_path?: string;

    color?: string;

    roughness?: number;

    metalness?: number;

    base_color_path?: string;

    normal_path?: string;

    roughness_path?: string;
}

//==================================================
// CACHE
//==================================================

let cachedWallMaterials: Material[] = [];

let wallMaterialsPromise:
    Promise<Material[]> | null = null;

//==================================================
// STORAGE URL
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
    // Examples:
    // wall-paints/white.png
    // gs://your-bucket/wall-paints/white.png
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
// LOAD WALL MATERIALS
//==================================================

async function loadWallMaterials(): Promise<Material[]> {

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
        await getDocs(q);

    const materials =
        await Promise.all(

            snapshot.docs.map(
                async doc => {

                    const data =
                        doc.data() as FirebaseWallAsset;

                    //--------------------------------------------------
                    // Resolve thumbnail
                    //--------------------------------------------------

                    const thumbnail =
                        await resolveStorageUrl(
                            data.thumbnail_path
                        );

                    //--------------------------------------------------
                    // Resolve actual wall texture
                    //--------------------------------------------------

                    const texture =
                        await resolveStorageUrl(
                            data.base_color_path
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

    cachedWallMaterials =
        materials;

    return materials;
}

//==================================================
// PUBLIC LOADER
//==================================================

export async function getWallMaterials(): Promise<Material[]> {

    //--------------------------------------------------
    // Already loaded
    //--------------------------------------------------

    if (
        cachedWallMaterials.length > 0
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
            .finally(() => {

                wallMaterialsPromise =
                    null;

            });

    return wallMaterialsPromise;
}

//==================================================
// CACHED MATERIAL FINDER
//==================================================

export function findCachedWallMaterial(
    materialId: string
): Material | undefined {

    return cachedWallMaterials.find(
        material =>
            material.id === materialId
    );
}

//==================================================
// FORCE REFRESH
//==================================================

export async function refreshWallMaterials(): Promise<Material[]> {

    cachedWallMaterials =
        [];

    wallMaterialsPromise =
        null;

    return getWallMaterials();
}