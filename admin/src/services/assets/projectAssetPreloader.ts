import { useGLTF } from "@react-three/drei";

import type { SavedProjectData } from "@/components/project-loader/ProjectTypes";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import { getDoorWindowAssets } from "./FirebaseDoorWindowLibrary";
import {
    getDefaultFloorMaterial,
    getFloorMaterials,
    LOCAL_DEFAULT_FLOOR_TEXTURE,
    preloadFloorTexture
} from "./floorsload";
import { getFurnitureAssets } from "./furnitureload";
import { getWallMaterials, preloadWallTexture } from "./wallsload";

const TEXTURE_BATCH_SIZE = 4;

function uniqueUrls(values: (string | undefined)[]): string[] {
    return [
        ...new Set(
            values.filter(
                (value): value is string =>
                    typeof value === "string" && value.trim() !== ""
            ).map(value => value.trim())
        )
    ];
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let index = 0; index < items.length; index += batchSize) {
        batches.push(items.slice(index, index + batchSize));
    }

    return batches;
}

function preloadModels(urls: string[]): void {
    for (const url of urls) {
        try {
            // The viewer's scene-wide Suspense boundary tracks model completion.
            useGLTF.preload(url, true, true);
        } catch (error) {
            console.error("Failed to preload admin project model:", url, error);
        }
    }
}

async function preloadWallTextures(urls: string[]): Promise<Set<string>> {
    const failedUrls = new Set<string>();
    for (const batch of splitIntoBatches(urls, TEXTURE_BATCH_SIZE)) {
        const results = await Promise.allSettled(
            batch.map(url => preloadWallTexture(url))
        );

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                failedUrls.add(batch[index]);
                console.error(
                    "Failed to preload admin project wall texture:",
                    batch[index],
                    result.reason
                );
            }
        });
    }
    return failedUrls;
}

function logCatalogFailure<T>(
    result: PromiseSettledResult<T>,
    label: string
): T | undefined {
    if (result.status === "fulfilled") {
        return result.value;
    }

    console.error(`Failed to load ${label} for project preloading:`, result.reason);
    return undefined;
}

export async function preloadAdminProjectAssets(
    projectData: SavedProjectData
): Promise<string[]> {
    const [
        furnitureResult,
        doorWindowResult,
        floorResult,
        defaultFloorResult,
        wallResult
    ] = await Promise.allSettled([
        getFurnitureAssets(),
        getDoorWindowAssets(),
        getFloorMaterials(),
        getDefaultFloorMaterial(),
        getWallMaterials()
    ]);

    const furnitureAssets =
        logCatalogFailure(furnitureResult, "furniture catalog") ?? [];
    const doorWindowAssets =
        logCatalogFailure(doorWindowResult, "door/window catalog") ?? [];
    const floorMaterials =
        logCatalogFailure(floorResult, "floor catalog") ?? [];
    const defaultFloor =
        logCatalogFailure(defaultFloorResult, "default floor material");
    const wallMaterials =
        logCatalogFailure(wallResult, "wall catalog") ?? [];

    const assetsById = new Map<string, Asset>();
    for (const asset of [...furnitureAssets, ...doorWindowAssets]) {
        assetsById.set(asset.id, asset);
    }

    const projectAssetIds = new Set([
        ...projectData.furniture.map(item => item.assetId),
        ...projectData.doors.map(item => item.assetId),
        ...projectData.windows.map(item => item.assetId)
    ]);

    const unavailableAssetIds = new Set<string>();
    const modelUrls = uniqueUrls(
        [...projectAssetIds].flatMap(assetId => {
            const asset = assetsById.get(assetId);
            if (!asset || typeof asset.model !== "string" || asset.model.trim() === "") {
                unavailableAssetIds.add(assetId);
                console.warn("Project asset not found for preloading:", assetId);
                return [];
            }

            return [asset.model];
        })
    );

    const floorMaterialIds = new Set(
        Object.values(projectData.floorFinishes)
    );
    const wallMaterialIds = new Set(
        Object.values(projectData.wallFinishes).flatMap(finishes =>
            Object.values(finishes)
        )
    );
    const availableFloorIds = new Set(floorMaterials.map(material => material.id));
    const availableWallIds = new Set(wallMaterials.map(material => material.id));
    for (const materialId of floorMaterialIds) {
        if (!availableFloorIds.has(materialId)) unavailableAssetIds.add(materialId);
    }
    for (const materialId of wallMaterialIds) {
        if (!availableWallIds.has(materialId)) unavailableAssetIds.add(materialId);
    }

    const selectedFloorMaterials = floorMaterials.filter(material =>
        floorMaterialIds.has(material.id)
    );
    const selectedWallMaterials = wallMaterials.filter(material =>
        wallMaterialIds.has(material.id)
    );
    const floorTextureUrls = uniqueUrls([
        LOCAL_DEFAULT_FLOOR_TEXTURE,
        defaultFloor?.texture,
        ...selectedFloorMaterials
            .map(material => material.texture)
    ]);
    const wallTextureUrls = uniqueUrls(selectedWallMaterials.map(material => material.texture));

    const [failedWallUrls, floorTextureResults] = await Promise.all([
        preloadWallTextures(wallTextureUrls),
        Promise.all(floorTextureUrls.map(url => preloadFloorTexture(url)))
    ]);
    await preloadModels(modelUrls);

    const loadedFloorTextureUrls = new Set(
        floorTextureUrls.filter((_, index) => floorTextureResults[index] !== null)
    );
    for (const material of selectedFloorMaterials) {
        if (
            !material.texture ||
            !loadedFloorTextureUrls.has(material.texture.trim())
        ) {
            unavailableAssetIds.add(material.id);
        }
    }
    for (const material of selectedWallMaterials) {
        if (!material.texture || failedWallUrls.has(material.texture.trim())) {
            unavailableAssetIds.add(material.id);
        }
    }

    return [...unavailableAssetIds];
}
