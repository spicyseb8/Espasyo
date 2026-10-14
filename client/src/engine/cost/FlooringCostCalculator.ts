
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

export interface FlooringCostOptions {
    corners: Corner[];
    walls: Wall[];
    floorFinishes: Record<string, string>;
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
        floorFinishes
    } = options;

    const regions =
        solveRegions(
            corners,
            walls
        );

    const items: CostItem[] = [];

    for (const region of regions) {
        const materialId =
            floorFinishes[region.id];

        // No flooring assigned to this room yet.
        if (!materialId) {
            continue;
        }

        //--------------------------------------------------
        // Firebase floor material
        //--------------------------------------------------

        const firebaseMaterial =
            findCachedFloorMaterial(
                materialId
            );

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

        const area =
            calculateRegionFloorArea(region);

        if (
            !Number.isFinite(area) ||
            area <= 0
        ) {
            console.warn(
                "Skipping flooring cost because the room area is invalid:",
                region.id,
                area
            );

            continue;
        }

        const rate =
            Number(material.pricePerSquareMeter);

        if (!Number.isFinite(rate) || rate < 0) {
            console.warn(
                "Skipping flooring cost because the material price is invalid:",
                materialId,
                material.pricePerSquareMeter
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

        //--------------------------------------------------
        // DIMENSION-BASED PIECE CALCULATION
        //--------------------------------------------------

        if (hasDimensions) {
            // Area covered by one flooring piece.
            const pieceArea =
                length * width;

            // Round up to purchase whole pieces.
            const piecesNeeded =
                Math.ceil(area / pieceArea);

            // The asset price remains per square meter.
            const pricePerPiece =
                pieceArea * rate;

            const subtotal =
                piecesNeeded * pricePerPiece;

            items.push({
                category: "flooring",
                name: material.name,
                quantity: piecesNeeded,
                unit: "pieces",
                rate: pricePerPiece,
                subtotal,
                length,
                width
            });

            continue;
        }

        //--------------------------------------------------
        // LEGACY SQUARE-METER CALCULATION
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
