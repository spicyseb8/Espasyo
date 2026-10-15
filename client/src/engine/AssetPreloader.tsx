
import { useEffect } from "react";

import {
    DefaultLoadingManager
} from "three";

import {
    useGLTF,
    useTexture
} from "@react-three/drei";

import {
    findAsset
} from "../assets/AssetLibrary";

import {
    getFurnitureAssets
} from "./furniture/FirebaseFurnitureLibrary";

import {
    getDoorWindowAssets
} from "./build/FirebaseDoorWindowLibrary";

import {
    getFloorMaterials,
    preloadFloorTexture,
    LOCAL_DEFAULT_FLOOR_TEXTURE
} from "./materials/floors";

import {
    getWallMaterials
} from "./materials/walls";

import type {
    Asset
} from "../assets/Asset";

import type {
    Material
} from "./materials/MaterialTypes";

//==================================================
// CONFIGURATION
//==================================================

const MODEL_BATCH_SIZE = 2;
const TEXTURE_BATCH_SIZE = 4;
const BATCH_TIMEOUT_MS = 45_000;
const BATCH_GAP_MS = 50;

//==================================================
// HELPERS
//==================================================

function uniqueUrls(
    values: unknown[]
): string[] {

    return [
        ...new Set(
            values.filter(
                (value): value is string =>
                    typeof value === "string" &&
                    value.trim() !== ""
            ).map(
                value => value.trim()
            )
        )
    ];
}

function getSettledValue<T>(
    result: PromiseSettledResult<T>,
    fallback: T,
    label: string
): T {

    if (result.status === "fulfilled") {
        return result.value;
    }

    console.error(
        `Failed to load ${label}:`,
        result.reason
    );

    return fallback;
}

function asRecord(
    value: unknown
): Record<string, unknown> | null {

    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        return null;
    }

    return value as Record<string, unknown>;
}

function splitIntoBatches<T>(
    items: T[],
    batchSize: number
): T[][] {

    const batches: T[][] = [];

    for (
        let i = 0;
        i < items.length;
        i += batchSize
    ) {

        batches.push(
            items.slice(
                i,
                i + batchSize
            )
        );
    }

    return batches;
}

// Give the browser time to process pending rendering
// and animation frames between batches.
function yieldToBrowser(): Promise<void> {

    return new Promise(resolve => {

        window.setTimeout(
            resolve,
            BATCH_GAP_MS
        );
    });
}

//==================================================
// PROJECT ASSET IDS
//==================================================

function getProjectAssetIds(
    projectData: unknown
): string[] {

    const project =
        asRecord(projectData);

    if (!project) {
        return [];
    }

    const ids =
        new Set<string>();

    function collectItems(
        value: unknown
    ) {

        if (!Array.isArray(value)) {
            return;
        }

        for (const item of value) {

            const record =
                asRecord(item);

            const assetId =
                record?.assetId;

            if (
                typeof assetId === "string" &&
                assetId.trim() !== ""
            ) {

                ids.add(
                    assetId.trim()
                );
            }
        }
    }

    collectItems(project.furniture);
    collectItems(project.doors);
    collectItems(project.windows);

    return [...ids];
}

//==================================================
// PROJECT MATERIAL IDS
//==================================================

function getProjectMaterialIds(
    projectData: unknown,
    field: "floorFinishes" | "wallFinishes"
): string[] {

    const project =
        asRecord(projectData);

    if (!project) {
        return [];
    }

    const result =
        new Set<string>();

    function collect(
        value: unknown
    ) {

        if (typeof value === "string") {

            const text =
                value.trim();

            if (text !== "") {
                result.add(text);
            }

            return;
        }

        if (Array.isArray(value)) {

            for (const item of value) {
                collect(item);
            }

            return;
        }

        const record =
            asRecord(value);

        if (record) {

            for (
                const item of Object.values(record)
            ) {
                collect(item);
            }
        }
    }

    collect(project[field]);

    return [...result];
}

//==================================================
// WAIT FOR A SMALL BATCH OF FILE REQUESTS
//==================================================
//
// useGLTF.preload() and useTexture.preload() do not
// return promises for their loaded resources.
//
// This tracks LoadingManager itemStart/itemEnd events
// for the requested URLs. It does not access
// itemsLoaded or itemsTotal.
//
// Note:
// itemEnd means the file request ended; GLTF parsing
// can continue briefly afterwards.
//==================================================

function loadTrackedBatch(
    urls: string[],
    startLoading: () => void,
    label: string
): Promise<void> {

    if (urls.length === 0) {
        return Promise.resolve();
    }

    return new Promise(resolve => {

        const manager =
            DefaultLoadingManager;

        const targetUrls =
            new Set(urls);

        const startedUrls =
            new Set<string>();

        const endedUrls =
            new Set<string>();

        const originalItemStart =
            manager.itemStart;

        const originalItemEnd =
            manager.itemEnd;

        let settled = false;

        let timeoutId:
            number | undefined;

        let installedItemStart:
            typeof manager.itemStart;

        let installedItemEnd:
            typeof manager.itemEnd;

        function restoreManager() {

            if (
                timeoutId !== undefined
            ) {

                window.clearTimeout(
                    timeoutId
                );

                timeoutId = undefined;
            }

            // Do not overwrite a handler installed by
            // another part of the app while this runs.
            if (
                manager.itemStart ===
                installedItemStart
            ) {

                manager.itemStart =
                    originalItemStart;
            }

            if (
                manager.itemEnd ===
                installedItemEnd
            ) {

                manager.itemEnd =
                    originalItemEnd;
            }
        }

        function finish(
            timedOut = false
        ) {

            if (settled) {
                return;
            }

            settled = true;

            restoreManager();

            if (timedOut) {

                console.warn(
                    `Timed out waiting for ${label} batch. Continuing.`
                );
            }

            resolve();
        }

        function checkFinished() {

            if (startedUrls.size === 0) {
                return;
            }

            const everyStartedRequestEnded =
                [...startedUrls].every(
                    url => endedUrls.has(url)
                );

            if (everyStartedRequestEnded) {
                finish();
            }
        }

        installedItemStart = function (
            url: string
        ) {

            if (
                targetUrls.has(url)
            ) {

                startedUrls.add(url);
            }

            originalItemStart.call(
                manager,
                url
            );
        };

        installedItemEnd = function (
            url: string
        ) {

            // Let Three.js update its own loading
            // state before checking our batch.
            originalItemEnd.call(
                manager,
                url
            );

            if (
                targetUrls.has(url) &&
                startedUrls.has(url)
            ) {

                endedUrls.add(url);

                checkFinished();
            }
        };

        manager.itemStart =
            installedItemStart;

        manager.itemEnd =
            installedItemEnd;

        timeoutId =
            window.setTimeout(
                () => finish(true),
                BATCH_TIMEOUT_MS
            );

        try {

            startLoading();

        } catch (error) {

            console.error(
                `Failed to start ${label} batch:`,
                error
            );

            finish();

            return;
        }

        // LoadingManager requests generally start
        // synchronously. If none started, these assets
        // may already be cached.
        if (startedUrls.size === 0) {

            finish();

            return;
        }

        checkFinished();
    });
}

//==================================================
// FIREBASE CATALOGS
//==================================================

let startupCatalogPromise:
    Promise<void> | null = null;

async function loadCatalogs(): Promise<void> {

    const [
        furnitureResult,
        doorWindowResult,
        floorResult,
        wallResult
    ] = await Promise.allSettled([

        getFurnitureAssets(),
        getDoorWindowAssets(),
        getFloorMaterials(),
        getWallMaterials()

    ]);

    getSettledValue(
        furnitureResult,
        [] as Asset[],
        "furniture catalog"
    );

    getSettledValue(
        doorWindowResult,
        [] as Asset[],
        "door/window catalog"
    );

    getSettledValue(
        floorResult,
        [] as Awaited<
            ReturnType<typeof getFloorMaterials>
        >,
        "floor catalog"
    );

    getSettledValue(
        wallResult,
        [] as Material[],
        "wall catalog"
    );
}

//==================================================
// APP STARTUP
//==================================================
//
// Load only Firebase catalog information here.
// Do not load every 3D model at app startup.
//==================================================

export function preloadFirebaseAssetsOnStartup():
    Promise<void> {

    if (startupCatalogPromise) {
        return startupCatalogPromise;
    }

    startupCatalogPromise =
        loadCatalogs().catch(
            error => {

                console.error(
                    "Failed to initialize Firebase asset catalogs:",
                    error
                );

                startupCatalogPromise = null;
            }
        );

    return startupCatalogPromise;
}

//==================================================
// PRELOAD PROJECT MODELS IN BATCHES
//==================================================

async function preloadProjectModels(
    modelUrls: string[]
): Promise<void> {

    const batches =
        splitIntoBatches(
            modelUrls,
            MODEL_BATCH_SIZE
        );

    for (
        let i = 0;
        i < batches.length;
        i++
    ) {

        const batch =
            batches[i];

        console.info(
            `Loading model batch ${i + 1}/${batches.length}`,
            batch
        );

        await loadTrackedBatch(
            batch,

            () => {

                for (const url of batch) {

                    useGLTF.preload(
                        url,
                        true,
                        true
                    );
                }
            },

            `model batch ${i + 1}`
        );

        // Yield before initiating another batch.
        if (i < batches.length - 1) {

            await yieldToBrowser();
        }
    }
}

//==================================================
// PRELOAD WALL TEXTURES IN BATCHES
//==================================================

async function preloadWallTextures(
    urls: string[]
): Promise<void> {

    const batches =
        splitIntoBatches(
            urls,
            TEXTURE_BATCH_SIZE
        );

    for (
        let i = 0;
        i < batches.length;
        i++
    ) {

        const batch =
            batches[i];

        await loadTrackedBatch(
            batch,

            () => {

                for (const url of batch) {
                    useTexture.preload(url);
                }
            },

            `wall texture batch ${i + 1}`
        );

        if (i < batches.length - 1) {
            await yieldToBrowser();
        }
    }
}

//==================================================
// PRELOAD FLOOR TEXTURES IN BATCHES
//==================================================

async function preloadFloorTextures(
    urls: string[]
): Promise<void> {

    const batches =
        splitIntoBatches(
            urls,
            TEXTURE_BATCH_SIZE
        );

    for (
        let i = 0;
        i < batches.length;
        i++
    ) {

        const batch =
            batches[i];

        await Promise.allSettled(
            batch.map(
                url => preloadFloorTexture(url)
            )
        );

        if (i < batches.length - 1) {
            await yieldToBrowser();
        }
    }
}

//==================================================
// PRELOAD ASSETS FOR ONE PROJECT
//==================================================

export async function preloadProjectAssets(
    projectData: unknown
): Promise<void> {

    // Load shared asset catalog data first.
    await preloadFirebaseAssetsOnStartup();

    const [
        furnitureResult,
        doorWindowResult,
        floorResult,
        wallResult
    ] = await Promise.allSettled([

        getFurnitureAssets(),
        getDoorWindowAssets(),
        getFloorMaterials(),
        getWallMaterials()

    ]);

    const furnitureAssets =
        getSettledValue(
            furnitureResult,
            [] as Asset[],
            "furniture catalog"
        );

    const doorWindowAssets =
        getSettledValue(
            doorWindowResult,
            [] as Asset[],
            "door/window catalog"
        );

    const floorMaterials =
        getSettledValue(
            floorResult,
            [] as Awaited<
                ReturnType<typeof getFloorMaterials>
            >,
            "floor catalog"
        );

    const wallMaterials =
        getSettledValue(
            wallResult,
            [] as Material[],
            "wall catalog"
        );

    //==================================================
    // IDENTIFY PROJECT MODELS
    //==================================================

    const assetById =
        new Map<string, Asset>();

    for (const asset of [
        ...furnitureAssets,
        ...doorWindowAssets
    ]) {

        assetById.set(
            asset.id,
            asset
        );
    }

    const projectAssetIds =
        getProjectAssetIds(projectData);

    const requiredAssets:
        Asset[] = [];

    for (const assetId of projectAssetIds) {

        const asset =
            assetById.get(assetId) ??
            findAsset(assetId);

        if (!asset) {

            console.warn(
                "Project asset not found:",
                assetId
            );

            continue;
        }

        if (
            typeof asset.model !== "string" ||
            asset.model.trim() === ""
        ) {

            console.warn(
                "Project asset has no valid model URL:",
                assetId
            );

            continue;
        }

        requiredAssets.push(asset);
    }

    const modelUrls =
        uniqueUrls(
            requiredAssets.map(
                asset => asset.model
            )
        );

    //==================================================
    // IDENTIFY PROJECT MATERIALS
    //==================================================

    const floorIds =
        new Set(
            getProjectMaterialIds(
                projectData,
                "floorFinishes"
            )
        );

    const wallIds =
        new Set(
            getProjectMaterialIds(
                projectData,
                "wallFinishes"
            )
        );

    const selectedFloorMaterials =
        floorMaterials.filter(
            material => floorIds.has(material.id)
        );

    const selectedWallMaterials =
        wallMaterials.filter(
            material => wallIds.has(material.id)
        );

    const floorTextureUrls =
        uniqueUrls([

            LOCAL_DEFAULT_FLOOR_TEXTURE,

            ...selectedFloorMaterials.map(
                material => material.texture
            )

        ]);

    const wallTextureUrls =
        uniqueUrls(
            selectedWallMaterials.map(
                material => material.texture
            )
        );

    //==================================================
    // LOAD ASSETS IN SMALL GROUPS
    //==================================================

    await Promise.all([

        preloadProjectModels(
            modelUrls
        ),

        preloadFloorTextures(
            floorTextureUrls
        ),

        preloadWallTextures(
            wallTextureUrls
        )

    ]);

    console.info(
        "Espasyo: project asset preloading finished.",
        {
            projectModels:
                modelUrls.length,

            modelBatchSize:
                MODEL_BATCH_SIZE,

            floorTextures:
                floorTextureUrls.length,

            wallTextures:
                wallTextureUrls.length,

            floorMaterialMatches:
                selectedFloorMaterials.length,

            wallMaterialMatches:
                selectedWallMaterials.length
        }
    );
}

//==================================================
// APP STARTUP COMPONENT
//==================================================

export default function AssetPreloader() {

    useEffect(() => {

        // Fetch catalog data without blocking app startup
        // on all models in the library.
        void preloadFirebaseAssetsOnStartup();

    }, []);

    return null;
}
