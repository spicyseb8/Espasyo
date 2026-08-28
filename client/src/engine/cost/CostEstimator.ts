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

import {
    calculateDoorCosts
} from "./DoorCostCalculator";

import {
    calculateWindowCosts
} from "./WindowCostCalculator";

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

        doors:
            state.doors,

        windows:
            state.windows,

        openings:
            state.openings,

        wallFinishes:
            state.wallFinishes

    });

    //--------------------------------------------------
    // Doors
    //--------------------------------------------------

    const doorItems =
        calculateDoorCosts(
            state.doors
        );

    //--------------------------------------------------
    // Windows
    //--------------------------------------------------

    const windowItems =
        calculateWindowCosts(
            state.windows
        );

    //--------------------------------------------------
    // Combine everything
    //--------------------------------------------------

    const items: CostItem[] = [

        ...furnitureItems,

        ...flooringItems,

        ...wallFinishItems,

        ...doorItems,

        ...windowItems

    ];

    //--------------------------------------------------
    // Calculate subtotal
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

    //--------------------------------------------------
    // Total
    //--------------------------------------------------

    return {

        items,

        subtotal,

        total:
            subtotal

    };
}