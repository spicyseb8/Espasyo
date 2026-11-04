import type { EditorState } from "../../context/editor/types";
import type { CostEstimate, CostFloorEstimate, CostItem } from "./CostTypes";
import { Vector3 } from "three";
import type { Asset } from "../../assets/Asset";
import type { Material } from "../materials/MaterialTypes";
import type { FloorMaterial } from "../materials/floors";
import { findAsset } from "../../assets/AssetLibrary";
import {
    getCachedFurnitureAsset
} from "../furniture/FirebaseFurnitureLibrary";
import {
    getCachedDoorAsset,
    getCachedWindowAsset
} from "../build/FirebaseDoorWindowLibrary";
import {
    findCachedFloorMaterial
} from "../materials/floors";
import {
    findCachedWallMaterial
} from "../materials/walls";
import {
    MaterialLibrary
} from "../materials/MaterialLibrary";
import {
    calculateFurnitureCosts
} from "./FurnitureCostCalculator";
import {
    calculateFlooringCosts
} from "./FlooringCostCalculator";
import {
    calculateWallFinishCosts
} from "./WallFinishCostCalculator";
import {
    calculateDoorCosts
} from "./DoorCostCalculator";
import {
    calculateWindowCosts
} from "./WindowCostCalculator";
import type {
    FloorPaintSeparatorMap,
    WallPaintSeparatorMap
} from "../../../../shared/wallPaintSeparators";

export interface CostPoint {
    x: number;
    y: number;
    z: number;
}

export interface CostFloorInput {
    floorId: string;
    name: string;
    corners: Array<{ id: string; position: CostPoint }>;
    walls: Array<{
        id: string;
        start: { id: string; position: CostPoint };
        end: { id: string; position: CostPoint };
    }>;
    furniture: Array<{ assetId: string }>;
    doors: Array<{
        id: string;
        assetId: string;
        wallId: string;
        position: CostPoint;
        rotationY: number;
        width: number;
        height: number;
        depth: number;
    }>;
    windows: Array<{
        id: string;
        assetId: string;
        wallId: string;
        position: CostPoint;
        rotationY: number;
        width: number;
        height: number;
        wallWidth?: number;
        depth: number;
    }>;
    openings: Array<{
        id: string;
        wallId: string;
        shape: "rectangle" | "arch";
        position: CostPoint;
        width: number;
        height: number;
        depth: number;
        archRise?: number;
    }>;
    floorFinishes: Record<string, string>;
    floorPaintSeparators?: FloorPaintSeparatorMap;
    wallFinishes: Record<string, Record<string, string>>;
    wallPaintSeparators?: WallPaintSeparatorMap;
    wallHeight: number;
}

export interface CostAssetLookups {
    findFurnitureAsset?: (assetId: string) => Pick<Asset, "id" | "name" | "price" | "furnitureCategory"> | undefined;
    findDoorAsset?: (assetId: string) => Pick<Asset, "id" | "name" | "price"> | undefined;
    findWindowAsset?: (assetId: string) => Pick<Asset, "id" | "name" | "price"> | undefined;
    findFloorMaterial?: (materialId: string) => FloorMaterial | undefined;
    findWallMaterial?: (materialId: string) => Material | undefined;
}

function hasValidPrice(value: unknown): value is number {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0;
}

function hasValidFloorPrice(material: FloorMaterial | undefined): boolean {
    if (!material || material.priceConfigured === false) {
        return false;
    }
    if (material.pricePerPiece !== undefined) {
        return hasValidPrice(material.pricePerPiece) &&
            typeof material.length === "number" &&
            Number.isFinite(material.length) &&
            material.length > 0 &&
            typeof material.width === "number" &&
            Number.isFinite(material.width) &&
            material.width > 0;
    }
    return hasValidPrice(material.pricePerSquareMeter);
}

function getIncompletePriceCategories(
    floors: CostFloorInput[],
    lookups: CostAssetLookups
): string[] {
    const incomplete = new Set<string>();

    for (const floor of floors) {
        for (const item of floor.furniture) {
            const asset =
                lookups.findFurnitureAsset?.(item.assetId) ??
                getCachedFurnitureAsset(item.assetId) ??
                findAsset(item.assetId);
            const priceNotExpected =
                asset != null &&
                asset.price == null &&
                (asset.furnitureCategory === "appliances" ||
                    asset.furnitureCategory === "decorations");
            if (!asset || (!priceNotExpected && !hasValidPrice(asset.price))) {
                incomplete.add("furniture");
            }
        }

        for (const item of floor.doors) {
            const asset =
                lookups.findDoorAsset?.(item.assetId) ??
                getCachedDoorAsset(item.assetId) ??
                findAsset(item.assetId);
            if (!asset || !hasValidPrice(asset.price)) {
                incomplete.add("doors");
            }
        }

        for (const item of floor.windows) {
            const asset =
                lookups.findWindowAsset?.(item.assetId) ??
                getCachedWindowAsset(item.assetId) ??
                findAsset(item.assetId);
            if (!asset || !hasValidPrice(asset.price)) {
                incomplete.add("windows");
            }
        }

        for (const materialId of new Set(Object.values(floor.floorFinishes))) {
            const material =
                lookups.findFloorMaterial?.(materialId) ??
                findCachedFloorMaterial(materialId) ??
                MaterialLibrary.find(item => item.id === materialId);
            if (!hasValidFloorPrice(material)) {
                incomplete.add("flooring");
            }
            for (const materialId of new Set(
                Object.values(floor.floorPaintSeparators ?? {})
                    .flatMap(face => Object.values(face.sectionMaterials))
            )) {
                const material =
                    lookups.findFloorMaterial?.(materialId) ??
                    findCachedFloorMaterial(materialId) ??
                    MaterialLibrary.find(item => item.id === materialId);
                if (!hasValidFloorPrice(material)) {
                    incomplete.add("flooring");
                }
            }
        }

        const wallMaterialIds = [
            ...Object.values(floor.wallFinishes)
                .flatMap(assignments => Object.values(assignments)),
            ...Object.values(floor.wallPaintSeparators ?? {})
                .flatMap(face => Object.values(face.sectionMaterials))
        ];
        for (const materialId of new Set(wallMaterialIds)) {
            const material =
                lookups.findWallMaterial?.(materialId) ??
                findCachedWallMaterial(materialId) ??
                MaterialLibrary.find(item => item.id === materialId);
            if (
                !material ||
                material.priceConfigured === false ||
                !hasValidPrice(material.pricePerLiter ?? material.pricePerSquareMeter)
            ) {
                incomplete.add("wall finishes");
            }
        }
    }

    return Array.from(incomplete);
}

function ordinalFloorName(index: number): string {
    const number = index + 1;
    const lastTwoDigits = number % 100;
    const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
        ? "th"
        : number % 10 === 1
            ? "st"
            : number % 10 === 2
                ? "nd"
                : number % 10 === 3
                    ? "rd"
                    : "th";
    return `${number}${suffix} Floor`;
}

function calculateFloorItems(
    floor: CostFloorInput,
    lookups: CostAssetLookups
): CostItem[] {
    const corners = floor.corners.map(corner => ({
        id: corner.id,
        position: new Vector3(
            corner.position.x,
            corner.position.y,
            corner.position.z
        )
    }));
    const cornersById = new Map(corners.map(corner => [corner.id, corner]));
    const walls = floor.walls.map(wall => ({
        id: wall.id,
        start: cornersById.get(wall.start.id) ?? {
            id: wall.start.id,
            position: new Vector3(
                wall.start.position.x,
                wall.start.position.y,
                wall.start.position.z
            )
        },
        end: cornersById.get(wall.end.id) ?? {
            id: wall.end.id,
            position: new Vector3(
                wall.end.position.x,
                wall.end.position.y,
                wall.end.position.z
            )
        }
    }));
    const doors = floor.doors.map(door => ({
        ...door,
        position: new Vector3(
            door.position.x,
            door.position.y,
            door.position.z
        )
    }));
    const windows = floor.windows.map(window => ({
        ...window,
        position: new Vector3(
            window.position.x,
            window.position.y,
            window.position.z
        )
    }));
    const openings = floor.openings.map(opening => ({
        ...opening,
        position: new Vector3(
            opening.position.x,
            opening.position.y,
            opening.position.z
        )
    }));

    const items: CostItem[] = [
        ...calculateFurnitureCosts(floor.furniture, lookups.findFurnitureAsset),
        ...calculateFlooringCosts({
            corners,
            walls,
            floorFinishes: floor.floorFinishes,
            floorPaintSeparators: floor.floorPaintSeparators,
            findFloorMaterial: lookups.findFloorMaterial
        }),
        ...calculateWallFinishCosts({
            corners,
            walls,
            wallHeight: floor.wallHeight,
            doors,
            windows,
            openings,
            wallFinishes: floor.wallFinishes,
            wallPaintSeparators: floor.wallPaintSeparators,
            findWallMaterial: lookups.findWallMaterial
        }),
        ...calculateDoorCosts(doors, lookups.findDoorAsset),
        ...calculateWindowCosts(windows, lookups.findWindowAsset)
    ];

    return items.map(item => ({
        ...item,
        floorId: floor.floorId
    }));
}

export function calculateCostEstimateForFloors(
    floors: CostFloorInput[],
    lookups: CostAssetLookups = {}
): CostEstimate {
    const floorEstimates: CostFloorEstimate[] = floors.map((floor, index) => {
        const items = calculateFloorItems(floor, lookups);
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

        return {
            floorId: floor.floorId,
            name: floor.name || ordinalFloorName(index),
            items,
            subtotal
        };
    });
    const items = floorEstimates.flatMap(floor => floor.items);
    const total = floorEstimates.reduce((sum, floor) => sum + floor.subtotal, 0);

    return {
        items,
        floors: floorEstimates,
        subtotal: total,
        total,
        incompleteItems: getIncompletePriceCategories(floors, lookups)
    };
}

export function calculateCostEstimate(
    state: EditorState,
    lookups: CostAssetLookups = {}
): CostEstimate {
    const floors: CostFloorInput[] = state.floors.length > 0
        ? state.floors.map(floor => ({
            ...floor,
            corners: floor.corners,
            walls: floor.walls,
            furniture: floor.furniture,
            doors: floor.doors,
            windows: floor.windows,
            openings: floor.openings
        }))
        : [{
            floorId: state.activeFloorId || "first-floor",
            name: "1st Floor",
            corners: state.corners,
            walls: state.walls,
            furniture: state.furniture,
            doors: state.doors,
            windows: state.windows,
            openings: state.openings,
            floorFinishes: state.floorFinishes,
            floorPaintSeparators: state.floorPaintSeparators,
            wallFinishes: state.wallFinishes,
            wallPaintSeparators: state.wallPaintSeparators,
            wallHeight: state.wallHeight
        }];

    return calculateCostEstimateForFloors(floors, lookups);
}
