export interface MaterialWasteItem {
    category: string;
    subtotal: number;
}

export interface MaterialWasteFloor {
    items: readonly MaterialWasteItem[];
    subtotal: number;
}

export interface MaterialWasteCategoryTotals {
    originalSubtotal: number;
    allowance: number;
    adjustedSubtotal: number;
}

export interface MaterialWasteFloorTotals {
    wallMaterials: MaterialWasteCategoryTotals;
    flooringMaterials: MaterialWasteCategoryTotals;
    subtotal: number;
}

export interface MaterialWasteReportTotals {
    floors: MaterialWasteFloorTotals[];
    total: number;
}

const MATERIAL_WASTE_RATE = 0.1;

function getCategoryTotals(
    items: readonly MaterialWasteItem[],
    category: "wallFinish" | "flooring"
): MaterialWasteCategoryTotals {
    const originalSubtotal = items.reduce(
        (sum, item) =>
            item.category === category && Number.isFinite(item.subtotal)
                ? sum + item.subtotal
                : sum,
        0
    );
    const allowance = originalSubtotal * MATERIAL_WASTE_RATE;

    return {
        originalSubtotal,
        allowance,
        adjustedSubtotal: originalSubtotal + allowance
    };
}

export function calculateMaterialWasteReportTotals(
    floors: readonly MaterialWasteFloor[]
): MaterialWasteReportTotals {
    const floorTotals = floors.map(floor => {
        const wallMaterials = getCategoryTotals(floor.items, "wallFinish");
        const flooringMaterials = getCategoryTotals(floor.items, "flooring");

        return {
            wallMaterials,
            flooringMaterials,
            subtotal:
                floor.subtotal +
                wallMaterials.allowance +
                flooringMaterials.allowance
        };
    });

    return {
        floors: floorTotals,
        total: floorTotals.reduce((sum, floor) => sum + floor.subtotal, 0)
    };
}
