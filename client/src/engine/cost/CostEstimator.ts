import type {
    EditorState
} from "../../context/editor/types";

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

import {
    calculateWallFinishCosts
} from "./WallFinishCostCalculator";

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
    // Wall finish
    //--------------------------------------------------

    const wallFinishItems =
        calculateWallFinishCosts({

            corners:
                state.corners,

            walls:
                state.walls,

            wallHeight:
                state.wallHeight,

            wallFinishes:
                state.wallFinishes

        });

    //--------------------------------------------------
    // Future categories
    //--------------------------------------------------

    const doorItems:
        CostItem[] = [];

    const windowItems:
        CostItem[] = [];

    //--------------------------------------------------
    // Combine
    //--------------------------------------------------

    const items = [

        ...furnitureItems,

        ...flooringItems,

        ...wallFinishItems,

        ...doorItems,

        ...windowItems

    ];

    //--------------------------------------------------
    // Total
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