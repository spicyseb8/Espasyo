import { calculateCostEstimateForFloors } from "../../../../../../client/src/engine/cost/CostEstimator";
import type {
    CostAssetLookups,
    CostFloorInput
} from "../../../../../../client/src/engine/cost/CostEstimator";
import type { CostEstimate } from "../../../../../../client/src/engine/cost/CostTypes";
import type { SavedProjectData } from "../../ProjectTypes";
import {
    getCachedDoorAsset,
    getCachedWindowAsset
} from "@/services/assets/FirebaseDoorWindowLibrary";
import {
    getCachedFurnitureAsset,
    getFurnitureAssets
} from "@/services/assets/furnitureload";
import {
    findCachedFloorMaterial,
    getFloorMaterials
} from "@/services/assets/floorsload";
import {
    findCachedWallMaterial,
    getWallMaterials
} from "@/services/assets/wallsload";
import { getDoorWindowAssets } from "@/services/assets/FirebaseDoorWindowLibrary";

function toCostFloor(
    projectData: SavedProjectData,
    floorIndex: number
): CostFloorInput {
    const savedFloor = projectData.floors?.[floorIndex];
    const structure = savedFloor?.structure ?? projectData;
    const floorId = savedFloor?.floorId ??
        savedFloor?.id ??
        (floorIndex === 0 ? "first-floor" : `floor-${floorIndex + 1}`);
    const cornerById = new Map(
        (structure.corners ?? []).map(corner => [
            corner.id,
            {
                id: corner.id,
                position: corner.position
            }
        ])
    );
    const corners = [...cornerById.values()];
    const walls = (structure.walls ?? []).map(wall => ({
        id: wall.id,
        start: cornerById.get(wall.start.id) ?? {
            id: wall.start.id,
            position: wall.start.position
        },
        end: cornerById.get(wall.end.id) ?? {
            id: wall.end.id,
            position: wall.end.position
        }
    }));

    return {
        floorId,
        name: savedFloor?.name ?? "",
        corners,
        walls,
        doors: structure.doors ?? [],
        windows: (structure.windows ?? []).map(window => ({
            ...window,
            wallWidth: window.wallWidth ?? window.width
        })),
        openings: structure.openings ?? [],
        furniture: (
            savedFloor?.furniture ??
            (floorIndex === 0
                ? projectData.furniture ?? structure.furniture ?? []
                : structure.furniture ?? [])
        ),
        floorFinishes: savedFloor?.floorFinishes ??
            (floorIndex === 0
                ? projectData.floorFinishes ?? structure.floorFinishes ?? {}
                : structure.floorFinishes ?? {}),
        wallFinishes: savedFloor?.wallFinishes ??
            (floorIndex === 0
                ? projectData.wallFinishes ?? structure.wallFinishes ?? {}
                : structure.wallFinishes ?? {}),
        wallPaintSeparators: savedFloor?.wallPaintSeparators ??
            (floorIndex === 0
                ? projectData.wallPaintSeparators ?? structure.wallPaintSeparators ?? {}
                : structure.wallPaintSeparators ?? {}),
        floorPaintSeparators: savedFloor?.floorPaintSeparators ??
            (floorIndex === 0
                ? projectData.floorPaintSeparators ?? structure.floorPaintSeparators ?? {}
                : structure.floorPaintSeparators ?? {}),
        wallHeight: structure.wallHeight ?? projectData.wallHeight ?? 2.8
    };
}

export async function calculateAdminCostEstimate(
    projectData: SavedProjectData
): Promise<CostEstimate> {
    await Promise.all([
        getFurnitureAssets(),
        getDoorWindowAssets(),
        getFloorMaterials(),
        getWallMaterials()
    ]);

    const lookups: CostAssetLookups = {
        findFurnitureAsset: assetId => {
            const asset = getCachedFurnitureAsset(assetId);
            if (!asset) {
                return undefined;
            }
            return {
                id: asset.id,
                name: asset.name,
                price: asset.price,
                ...(asset.furnitureCategory === "appliances" ||
                    asset.furnitureCategory === "decorations"
                    ? { furnitureCategory: asset.furnitureCategory }
                    : {})
            };
        },
        findDoorAsset: getCachedDoorAsset,
        findWindowAsset: getCachedWindowAsset,
        findFloorMaterial: findCachedFloorMaterial,
        findWallMaterial: findCachedWallMaterial
    };

    return createAdminCostEstimate(projectData, lookups);
}

export function createAdminCostEstimate(
    projectData: SavedProjectData,
    lookups: CostAssetLookups
): CostEstimate {
    const floors = projectData.floors?.length
        ? projectData.floors.map((_, index) => toCostFloor(projectData, index))
        : [toCostFloor(projectData, 0)];

    return calculateCostEstimateForFloors(floors, lookups);
}
