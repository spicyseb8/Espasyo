import type { EditorState } from "../../context/editor/types";

import type {
    CostEstimate,
    CostItem
} from "./CostTypes";

import {
    calculateFurnitureCosts
} from "./FurnitureCostCalculator";

import {
    calculateFlooringCosts
} from "./FlooringCostCalculator";

export function calculateCostEstimate(
    state: EditorState
): CostEstimate {

    //--------------------------------------------------
    // Furniture
    //--------------------------------------------------

    const furnitureItems =
        calculateFurnitureCosts(
            state.furniture
        );

    //--------------------------------------------------
    // Flooring
    //--------------------------------------------------

    const flooringItems =
        calculateFlooringCosts({
            corners:
                state.corners,

            walls:
                state.walls,

            floorFinishes:
                state.floorFinishes
        });

    //--------------------------------------------------
    // Future categories
    //
    // Keep these empty for now.
    //--------------------------------------------------

    const wallFinishItems:
        CostItem[] = [];

    const doorItems:
        CostItem[] = [];

    const windowItems:
        CostItem[] = [];

    //--------------------------------------------------
    // Combine everything
    //--------------------------------------------------

    const items = [
        ...furnitureItems,
        ...flooringItems,
        ...wallFinishItems,
        ...doorItems,
        ...windowItems
    ];

    //--------------------------------------------------
    // Calculate total
    //--------------------------------------------------

    const subtotal =
        items.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.subtotal,

            0
        );

    return {

        items,

        subtotal,

        total:
            subtotal
    };
}