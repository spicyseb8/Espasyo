import { useState } from "react";

import useEditor
    from "../../../context/editor/useEditor";

import {
    MaterialLibrary
} from "../../../engine/materials/MaterialLibrary";

import MaterialSection
    from "./MaterialSection";

import {
    solveRegions
} from "../../../engine/regions/RegionSolver";

export default function DesignPanel() {

    const {
        state,
        dispatch
    } = useEditor();

    //--------------------------------------------------
    // Currently selected material in the UI
    //--------------------------------------------------

    const [
        selectedMaterialId,
        setSelectedMaterialId
    ] = useState<string | null>(null);

    //--------------------------------------------------
    // Flooring
    //--------------------------------------------------

    const flooringMaterials =
        MaterialLibrary.filter(
            material =>
                material.category ===
                "flooring"
        );

    //--------------------------------------------------
    // Wall finishes
    //--------------------------------------------------

    const wallMaterials =
        MaterialLibrary.filter(
            material =>
                material.category ===
                "wallFinish"
        );

    //--------------------------------------------------
    // Apply to selected room
    //--------------------------------------------------

    const handleApplyFloor = () => {

        if (
            !state.selectedRegionId ||
            !selectedMaterialId
        ) {
            return;
        }

        const material =
            flooringMaterials.find(
                item =>
                    item.id ===
                    selectedMaterialId
            );

        if (!material) {
            return;
        }

        dispatch({
            type: "SET_FLOOR_FINISH",

            payload: {
                regionId:
                    state.selectedRegionId,

                materialId:
                    material.id
            }
        });
    };

    //--------------------------------------------------
    // Apply same floor to every room
    //--------------------------------------------------

    const handleApplyFloorToAll = () => {

        if (!selectedMaterialId) {
            return;
        }

        const material =
            flooringMaterials.find(
                item =>
                    item.id ===
                    selectedMaterialId
            );

        if (!material) {
            return;
        }

        const regions =
            solveRegions(
                state.corners,
                state.walls
            );

        for (
            const region of regions
        ) {

            dispatch({
                type:
                    "SET_FLOOR_FINISH",

                payload: {
                    regionId:
                        region.id,

                    materialId:
                        material.id
                }
            });
        }
    };

    //--------------------------------------------------
    // Wall finish
    //
    // UI is ready, but functionality will be added
    // when we implement the wall-finish state.
    //--------------------------------------------------

    const handleApplyWall = () => {
        // Reserved for the wall-finish implementation.
    };

    return (

        <div className="design-panel">

            <MaterialSection

                title="Floor"

                materials={
                    flooringMaterials
                }

                selectedMaterialId={
                    selectedMaterialId
                }

                defaultOpen={
                    true
                }

                onSelect={
                    setSelectedMaterialId
                }

                onApply={
                    handleApplyFloor
                }

                onApplyToAll={
                    handleApplyFloorToAll
                }

                canApply={
                    Boolean(
                        state.selectedRegionId &&
                        selectedMaterialId
                    )
                }

                canApplyToAll={
                    Boolean(
                        selectedMaterialId &&
                        state.corners.length > 0
                    )
                }

            />

            <MaterialSection

                title="Walls"

                materials={
                    wallMaterials
                }

                selectedMaterialId={
                    selectedMaterialId
                }

                defaultOpen={
                    false
                }

                onSelect={
                    setSelectedMaterialId
                }

                onApply={
                    handleApplyWall
                }

                canApply={
                    false
                }

                canApplyToAll={
                    false
                }

                applyLabel="Apply"

                applyToAllLabel="Apply to All"

            />

        </div>
    );
}