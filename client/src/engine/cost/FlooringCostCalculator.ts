
import type { Corner } from "../walls/Corner";
import type { Wall } from "../walls/WallTypes";

import {
    solveRegions
} from "../regions/RegionSolver";

import {
    polygonArea
} from "../regions/Polygon";

import type {
    Region
} from "../regions/Polygon";

import {
    findCachedFloorMaterial
} from "../materials/floors";

import {
    MaterialLibrary
} from "../materials/MaterialLibrary";

import type {
    CostItem
} from "./CostTypes";

import {
    calculateFlooringPieceCost
} from "./FlooringPieceCalculation";
import {
    calculateFloorSectionArea,
    getWallPaintSections,
    type FloorPaintSeparatorMap
} from "../../../../shared/wallPaintSeparators";
import { Path, Shape, ShapeGeometry } from "three";

export interface FlooringCostOptions {
    corners: Corner[];
    walls: Wall[];
    floorFinishes: Record<string, string>;
    floorPaintSeparators?: FloorPaintSeparatorMap;
    findFloorMaterial?: (
        materialId: string
    ) => ReturnType<typeof findCachedFloorMaterial>;
}

//==================================================
// CALCULATE ROOM FLOOR AREA
//==================================================

function calculateRegionFloorArea(
    region: Region
): number {
    const loops =
        region.boundaryLoops ?? [];

    // Use the same boundaries as the rendered floor.
    if (loops.length > 0) {
        const outerCorners =
            loops[0].corners.filter(Boolean);

        if (outerCorners.length < 3) {
            return 0;
        }

        let area =
            Math.abs(
                polygonArea(outerCorners)
            );

        // Subtract holes, such as openings in the floor.
        for (const loop of loops.slice(1)) {
            const holeCorners =
                loop.corners.filter(Boolean);

            if (holeCorners.length >= 3) {
                area -= Math.abs(
                    polygonArea(holeCorners)
                );
            }
        }

        return Math.max(0, area);
    }

    // Compatibility fallback for regions without boundary loops.
    return Math.abs(
        polygonArea(region.corners)
    );
}

//==================================================
// CALCULATE FLOORING COSTS
//==================================================

export function calculateFlooringCosts(
    options: FlooringCostOptions
): CostItem[] {
    const {
        corners,
        walls,
        floorFinishes,
        floorPaintSeparators = {}
    } = options;

    const regions =
        solveRegions(
            corners,
            walls
        );

    const materialAreas = new Map<string, number>();

    for (const region of regions) {
        const face = floorPaintSeparators[region.id];
        const assignedSections = face
            ? getWallPaintSections(face)
            : [];
        if (assignedSections.length > 1) {
            const loops = region.boundaryLoops ?? [];
            const outer = loops[0]?.corners.filter(Boolean) ?? [];
            if (outer.length < 3) {
                const materialId = floorFinishes[region.id];
                if (materialId) {
                    materialAreas.set(
                        materialId,
                        (materialAreas.get(materialId) ?? 0) +
                            calculateRegionFloorArea(region)
                    );
                }
                continue;
            }
            const bounds = {
                minX: Math.min(...outer.map(point => point.x)),
                maxX: Math.max(...outer.map(point => point.x)),
                minY: Math.min(...outer.map(point => -point.z)),
                maxY: Math.max(...outer.map(point => -point.z))
            };
            const shape = new Shape();
            shape.moveTo(outer[0].x, -outer[0].z);
            for (const point of outer.slice(1)) {
                shape.lineTo(point.x, -point.z);
            }
            shape.closePath();
            shape.holes = loops.slice(1).map(loop => {
                const points = loop.corners.filter(Boolean);
                if (points.length < 3) return null;
                const hole = new Path();
                hole.moveTo(points[0].x, -points[0].z);
                for (const point of points.slice(1)) {
                    hole.lineTo(point.x, -point.z);
                }
                hole.closePath();
                return hole;
            }).filter((hole): hole is Path => hole !== null);
            const geometry = new ShapeGeometry(shape);
            const positions = geometry.getAttribute("position").array;
            for (const section of assignedSections) {
                const xStart = bounds.minX +
                    (bounds.maxX - bounds.minX) * section.xStart;
                const xEnd = bounds.minX +
                    (bounds.maxX - bounds.minX) * section.xEnd;
                const yStart = bounds.minY +
                    (bounds.maxY - bounds.minY) * section.yStart;
                const yEnd = bounds.minY +
                    (bounds.maxY - bounds.minY) * section.yEnd;
                const area = calculateFloorSectionArea(positions, {
                    ...section,
                    xStart,
                    xEnd,
                    yStart,
                    yEnd
                });
                const materialId = face.sectionMaterials[section.id] ??
                    floorFinishes[region.id];
                if (materialId && area > 0) {
                    materialAreas.set(
                        materialId,
                        (materialAreas.get(materialId) ?? 0) + area
                    );
                }
            }
            geometry.dispose();
            continue;
        }

        const materialId = floorFinishes[region.id];
        if (!materialId) continue;
        const area = calculateRegionFloorArea(region);
        materialAreas.set(
            materialId,
            (materialAreas.get(materialId) ?? 0) + area
        );
    }

    const items: CostItem[] = [];
    for (const [materialId, area] of materialAreas) {

        //--------------------------------------------------
        // Firebase floor material
        //--------------------------------------------------

        const firebaseMaterial =
            options.findFloorMaterial?.(materialId) ??
            findCachedFloorMaterial(materialId);
        if (firebaseMaterial?.priceConfigured === false) {
            continue;
        }

        //--------------------------------------------------
        // Legacy material-library fallback
        //--------------------------------------------------

        const material =
            firebaseMaterial ??
            MaterialLibrary.find(
                item =>
                    item.id === materialId &&
                    item.category === "flooring"
            );

        if (!material) {
            continue;
        }

        //--------------------------------------------------
        // ROOM AREA
        //--------------------------------------------------

        if (
            !Number.isFinite(area) ||
            area <= 0
        ) {
            console.warn(
                "Skipping flooring cost because the floor area is invalid:",
                materialId,
                area
            );

            continue;
        }

        //--------------------------------------------------
        // FLOORING DIMENSIONS
        //--------------------------------------------------

        const length =
            firebaseMaterial?.length;

        const width =
            firebaseMaterial?.width;

        const hasDimensions =
            typeof length === "number" &&
            Number.isFinite(length) &&
            length > 0 &&
            typeof width === "number" &&
            Number.isFinite(width) &&
            width > 0;

        const pricePerPiece =
            firebaseMaterial?.pricePerPiece ??
            material.pricePerPiece;

        if (pricePerPiece !== undefined) {
            if (
                !Number.isFinite(pricePerPiece) ||
                pricePerPiece < 0
            ) {
                console.warn(
                    "Skipping flooring cost because the per-tile price is invalid:",
                    materialId,
                    pricePerPiece
                );

                continue;
            }

            if (!hasDimensions) {
                console.warn(
                    "Skipping flooring cost because the tile dimensions are missing or invalid:",
                    materialId,
                    length,
                    width
                );

                continue;
            }

            const pieceCost = calculateFlooringPieceCost(
                area,
                length,
                width,
                pricePerPiece
            );

            if (!pieceCost) {
                console.warn(
                    "Skipping flooring cost because the per-tile inputs are invalid:",
                    materialId
                );

                continue;
            }

            items.push({
                category: "flooring",
                name: material.name,
                quantity: pieceCost.piecesNeeded,
                unit: "pieces",
                rate: pieceCost.rate,
                subtotal: pieceCost.subtotal,
                length,
                width
            });

            continue;
        }

        const rate =
            Number(material.pricePerSquareMeter);

        if (!Number.isFinite(rate) || rate < 0) {
            console.warn(
                "Skipping flooring cost because the legacy price per square meter is invalid:",
                materialId,
                material.pricePerSquareMeter
            );

            continue;
        }

        //--------------------------------------------------
        // LEGACY DIMENSION-BASED PIECE CALCULATION
        //--------------------------------------------------

        if (hasDimensions) {
            // Area covered by one flooring piece.
            const pieceArea =
                length * width;

            // Round up to purchase whole pieces.
            const piecesNeeded =
                Math.ceil(area / pieceArea);

            // Legacy Firebase assets store price per square meter.
            const legacyPricePerPiece =
                pieceArea * rate;

            const subtotal =
                piecesNeeded * legacyPricePerPiece;

            items.push({
                category: "flooring",
                name: material.name,
                quantity: piecesNeeded,
                unit: "pieces",
                rate: legacyPricePerPiece,
                subtotal,
                length,
                width
            });

            continue;
        }

        //--------------------------------------------------
        // LEGACY SQUARE-METER CALCULATION FOR ASSETS WITHOUT DIMENSIONS
        //--------------------------------------------------

        const subtotal =
            area * rate;

        items.push({
            category: "flooring",
            name: material.name,
            quantity: area,
            unit: "m²",
            rate,
            subtotal
        });
    }

    return items;
}
