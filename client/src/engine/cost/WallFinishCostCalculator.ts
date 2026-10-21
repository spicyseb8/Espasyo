
import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";
import type { Door } from "../doors/DoorTypes";
import type { Window } from "../windows/WindowTypes";
import type { Opening } from "../openings/OpeningTypes";
import { solveRegions } from "../regions/RegionSolver";
import { findCachedWallMaterial } from "../materials/walls";
import type { Material } from "../materials/MaterialTypes";
import { getWallFinishSides } from "../walls/WallFinishUtils";
import type { CostItem } from "./CostTypes";

export interface WallFinishCostOptions {
    corners: Corner[];
    walls: Wall[];
    wallHeight: number;
    doors: Door[];
    windows: Window[];
    openings: Opening[];
    wallFinishes: Record<string, Record<string, string>>;
}

interface CutoutRect {
    startX: number;
    endX: number;
    bottomY: number;
    topY: number;
}

interface WallCutout {
    startX: number;
    endX: number;
    bottomY: number;
    topY: number;
    shape: "rectangle" | "arch";
}

const STANDARD_COVERAGE_AREA_M2 = 10;
const STANDARD_LITERS_PER_COAT = 1.25;
const PRIMER_COATS = 1;
const PRIMER_PRICE_PER_LITER = 160;
const TOPCOAT_COATS = 2;

function roundLitersUp(liters: number): number {
    if (!Number.isFinite(liters) || liters <= 0) {
        return 0;
    }

    return Math.ceil(liters);
}

function getWallDirection(wall: Wall) {
    const dx = wall.end.position.x - wall.start.position.x;
    const dz = wall.end.position.z - wall.start.position.z;
    const length = Math.sqrt(dx * dx + dz * dz);

    if (length <= 0.000001) {
        return { x: 1, z: 0, length: 0 };
    }

    return {
        x: dx / length,
        z: dz / length,
        length
    };
}

function distanceAlongWall(
    x: number,
    z: number,
    wall: Wall
): number {
    const direction = getWallDirection(wall);

    return (
        (x - wall.start.position.x) * direction.x +
        (z - wall.start.position.z) * direction.z
    );
}

function calculateRectangleUnionArea(
    rectangles: CutoutRect[]
): number {
    if (rectangles.length === 0) {
        return 0;
    }

    const xCoordinates = Array.from(
        new Set(
            rectangles.flatMap(
                rect => [rect.startX, rect.endX]
            )
        )
    ).sort((a, b) => a - b);

    let area = 0;

    for (let i = 0; i < xCoordinates.length - 1; i++) {
        const x0 = xCoordinates[i];
        const x1 = xCoordinates[i + 1];
        const width = x1 - x0;

        if (width <= 0) {
            continue;
        }

        const active = rectangles
            .filter(
                rect => rect.startX < x1 && rect.endX > x0
            )
            .map(rect => ({
                bottomY: rect.bottomY,
                topY: rect.topY
            }))
            .sort((a, b) => a.bottomY - b.bottomY);

        if (active.length === 0) {
            continue;
        }

        let coveredHeight = 0;
        let currentStart = active[0].bottomY;
        let currentEnd = active[0].topY;

        for (let j = 1; j < active.length; j++) {
            const next = active[j];

            if (next.bottomY <= currentEnd) {
                currentEnd = Math.max(
                    currentEnd,
                    next.topY
                );
            } else {
                coveredHeight += currentEnd - currentStart;
                currentStart = next.bottomY;
                currentEnd = next.topY;
            }
        }

        coveredHeight += currentEnd - currentStart;
        area += width * coveredHeight;
    }

    return area;
}

function calculateArchArea(
    width: number,
    height: number,
    bottomY: number,
    wallHeight: number
): number {
    const availableHeight = Math.min(
        height,
        wallHeight - bottomY
    );

    if (availableHeight <= 0 || width <= 0) {
        return 0;
    }

    const radius = width * 0.5;
    const springHeight = Math.max(
        0,
        availableHeight - radius
    );
    const rectangleArea = width * springHeight;
    const archArea = Math.PI * radius * radius * 0.5;

    return rectangleArea + archArea;
}

export function calculateWallFinishCosts(
    options: WallFinishCostOptions,
    findMaterial: (materialId: string) => Material | undefined =
        findCachedWallMaterial
): CostItem[] {
    const {
        corners,
        walls,
        wallHeight,
        doors,
        windows,
        openings,
        wallFinishes
    } = options;

    const regions = solveRegions(corners, walls);
    const groupedPaints = new Map<string, CostItem>();
    let totalPaintArea = 0;

    for (const wall of walls) {
        const finishes = getWallFinishSides(
            wall,
            regions,
            wallFinishes
        );

        if (finishes.length === 0) {
            continue;
        }

        const direction = getWallDirection(wall);
        const wallLength = direction.length;

        if (wallLength <= 0.001) {
            continue;
        }

        const totalWallArea = wallLength * wallHeight;
        const rectangularCutouts: CutoutRect[] = [];

        for (const door of doors) {
            if (door.wallId !== wall.id) {
                continue;
            }

            const distance = distanceAlongWall(
                door.position.x,
                door.position.z,
                wall
            );
            const halfWidth = door.width * 0.5;
            const startX = distance - halfWidth;
            const endX = distance + halfWidth;
            const topY = Math.min(
                door.height,
                wallHeight
            );
            const bottomY = 0;

            if (endX > 0 && startX < wallLength) {
                rectangularCutouts.push({
                    startX: Math.max(0, startX),
                    endX: Math.min(wallLength, endX),
                    bottomY,
                    topY
                });
            }
        }

        for (const window of windows) {
            if (window.wallId !== wall.id) {
                continue;
            }

            const distance = distanceAlongWall(
                window.position.x,
                window.position.z,
                wall
            );
            const relativeRotation =
                window.rotationY -
                Math.atan2(direction.z, direction.x);
            const cos = Math.abs(
                Math.cos(relativeRotation)
            );
            const sin = Math.abs(
                Math.sin(relativeRotation)
            );
            const widthAlongWall =
                window.width * cos +
                window.depth * sin;
            const halfWidth = widthAlongWall * 0.5;
            const startX = distance - halfWidth;
            const endX = distance + halfWidth;
            const bottomY = Math.max(
                0,
                window.position.y -
                window.height * 0.5
            );
            const topY = Math.min(
                wallHeight,
                window.position.y +
                window.height * 0.5
            );

            if (
                endX > 0 &&
                startX < wallLength &&
                topY > bottomY
            ) {
                rectangularCutouts.push({
                    startX: Math.max(0, startX),
                    endX: Math.min(wallLength, endX),
                    bottomY,
                    topY
                });
            }
        }

        const archCutouts: WallCutout[] = [];

        for (const opening of openings) {
            if (opening.wallId !== wall.id) {
                continue;
            }

            const distance = distanceAlongWall(
                opening.position.x,
                opening.position.z,
                wall
            );
            const halfWidth = opening.width * 0.5;
            const startX = distance - halfWidth;
            const endX = distance + halfWidth;
            const bottomY = 0;
            const topY = Math.min(
                opening.height,
                wallHeight
            );

            if (opening.shape === "arch") {
                archCutouts.push({
                    startX: Math.max(0, startX),
                    endX: Math.min(wallLength, endX),
                    bottomY,
                    topY,
                    shape: "arch"
                });
            } else if (
                endX > 0 &&
                startX < wallLength &&
                topY > bottomY
            ) {
                rectangularCutouts.push({
                    startX: Math.max(0, startX),
                    endX: Math.min(wallLength, endX),
                    bottomY,
                    topY
                });
            }
        }

        const rectangularCutoutArea =
            calculateRectangleUnionArea(
                rectangularCutouts
            );
        let archCutoutArea = 0;

        for (const arch of archCutouts) {
            const width = arch.endX - arch.startX;

            if (width <= 0) {
                continue;
            }

            archCutoutArea += calculateArchArea(
                width,
                arch.topY - arch.bottomY,
                arch.bottomY,
                wallHeight
            );
        }

        const cutoutArea =
            rectangularCutoutArea + archCutoutArea;
        const finishArea = Math.max(
            0,
            totalWallArea - cutoutArea
        );

        if (finishArea <= 0.0001) {
            continue;
        }

        for (const finish of finishes) {
            const material = findMaterial(
                finish.materialId
            );

            if (!material) {
                console.warn(
                    "Wall material was not found in the Firebase material cache:",
                    finish.materialId
                );
                continue;
            }

            const paintPricePerLiter = Number(
                material.pricePerLiter ??
                material.pricePerSquareMeter
            );

            if (
                !Number.isFinite(paintPricePerLiter) ||
                paintPricePerLiter < 0
            ) {
                console.warn(
                    "Wall material has an invalid price per liter:",
                    finish.materialId,
                    material.pricePerLiter ??
                    material.pricePerSquareMeter
                );
                continue;
            }

            totalPaintArea += finishArea;
            const requiredPaintLiters =
                finishArea /
                STANDARD_COVERAGE_AREA_M2 *
                STANDARD_LITERS_PER_COAT *
                TOPCOAT_COATS;

            const existingPaint = groupedPaints.get(
                material.id
            );

            if (existingPaint) {
                existingPaint.quantity += requiredPaintLiters;
                existingPaint.subtotal =
                    existingPaint.quantity * existingPaint.rate;
            } else {
                groupedPaints.set(material.id, {
                    category: "wallFinish",
                    name: material.name,
                    quantity: requiredPaintLiters,
                    unit: "L",
                    rate: paintPricePerLiter,
                    subtotal: requiredPaintLiters * paintPricePerLiter,
                    coats: TOPCOAT_COATS
                });
            }
        }
}

    const costs: CostItem[] = [];

    if (totalPaintArea > 0) {
        const requiredPrimerLiters =
            totalPaintArea /
            STANDARD_COVERAGE_AREA_M2 *
            PRIMER_COATS;
        const primerLiters = roundLitersUp(
            requiredPrimerLiters
        );

        costs.push({
            category: "wallFinish",
            name: "Primer",
            quantity: primerLiters,
            unit: "L",
            rate: PRIMER_PRICE_PER_LITER,
            subtotal: primerLiters * PRIMER_PRICE_PER_LITER,
            coats: PRIMER_COATS
        });
    }

    return [
        ...costs,
        ...groupedPaints.values()
    ];
}
