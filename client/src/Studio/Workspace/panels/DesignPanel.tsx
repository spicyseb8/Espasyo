import {
    useEffect,
    useMemo,
    useState
} from "react";

import useEditor
    from "../../../context/editor/useEditor";

import {
    MaterialLibrary
} from "../../../engine/materials/MaterialLibrary";

import {
    solveRegions
} from "../../../engine/regions/RegionSolver";

import MaterialSection
    from "./MaterialSection";

export default function DesignPanel() {

    const {
        state,
        dispatch
    } = useEditor();

    //--------------------------------------------------
    // Current regions
    //--------------------------------------------------

    const regions =
        useMemo(
            () =>
                solveRegions(
                    state.corners,
                    state.walls
                ),
            [
                state.corners,
                state.walls
            ]
        );

    //--------------------------------------------------
    // Materials
    //--------------------------------------------------

    const flooringMaterials =
        useMemo(
            () =>
                MaterialLibrary.filter(
                    material =>
                        material.category ===
                        "flooring"
                ),
            []
        );

    const wallMaterials =
        useMemo(
            () =>
                MaterialLibrary.filter(
                    material =>
                        material.category ===
                        "wallFinish"
                ),
            []
        );

    //--------------------------------------------------
    // UI-selected floor material
    //--------------------------------------------------

    const [
        selectedFloorMaterialId,
        setSelectedFloorMaterialId
    ] = useState<string | null>(
        null
    );

    //--------------------------------------------------
    // UI-selected wall material
    //--------------------------------------------------

    const [
        selectedWallMaterialId,
        setSelectedWallMaterialId
    ] = useState<string | null>(
        null
    );

    //--------------------------------------------------
    // Selected region
    //--------------------------------------------------

    const selectedRegion =
        regions.find(
            region =>
                region.id ===
                state.selectedRegionId
        ) ?? null;

    //--------------------------------------------------
    // Current floor material
    //--------------------------------------------------

    const currentFloorMaterialId =
        state.selectedRegionId

            ? state.floorFinishes[
                state.selectedRegionId
            ] ?? null

            : null;

    //--------------------------------------------------
    // Current wall material
    //
    // Only available when a specific wall is selected
    // inside the selected room.
    //--------------------------------------------------

    const selectedWallBelongsToRoom =
        Boolean(
            selectedRegion &&
            state.selectedWallId &&
            selectedRegion.walls.some(
                wall =>
                    wall.id ===
                    state.selectedWallId
            )
        );

    const currentWallMaterialId =
        selectedWallBelongsToRoom
            ? (
                state.wallFinishes[
                    state.selectedRegionId!
                ]?.[
                    state.selectedWallId!
                ] ?? null
            )
            : null;

    //--------------------------------------------------
    // Keep UI selection synchronized when switching
    // rooms/walls.
    //--------------------------------------------------

    useEffect(() => {

        setSelectedFloorMaterialId(
            currentFloorMaterialId
        );

    }, [
        state.selectedRegionId,
        currentFloorMaterialId
    ]);

    useEffect(() => {

        setSelectedWallMaterialId(
            currentWallMaterialId
        );

    }, [
        state.selectedRegionId,
        state.selectedWallId,
        currentWallMaterialId
    ]);

    //--------------------------------------------------
    // FLOOR
    //--------------------------------------------------

    const handleApplyFloor =
        () => {

            if (
                !state.selectedRegionId ||
                !selectedFloorMaterialId
            ) {
                return;
            }

            dispatch({

                type:
                    "SET_FLOOR_FINISH",

                payload: {

                    regionId:
                        state.selectedRegionId,

                    materialId:
                        selectedFloorMaterialId

                }

            });

        };

    //--------------------------------------------------
    // FLOOR → ALL ROOMS
    //--------------------------------------------------

    const handleApplyFloorToAll =
        () => {

            if (
                !selectedFloorMaterialId
            ) {

                return;

            }

            for (
                const region
                of regions
            ) {

                dispatch({

                    type:
                        "SET_FLOOR_FINISH",

                    payload: {

                        regionId:
                            region.id,

                        materialId:
                            selectedFloorMaterialId

                    }

                });

            }

        };

    //--------------------------------------------------
    // WALL → ONE WALL
    //--------------------------------------------------

    const handleApplyWall =
        () => {

            if (
                !state.selectedRegionId ||
                !state.selectedWallId ||
                !selectedWallMaterialId
            ) {

                return;

            }

            if (
                !selectedWallBelongsToRoom
            ) {

                return;

            }

            dispatch({

                type:
                    "SET_WALL_FINISH",

                payload: {

                    regionId:
                        state.selectedRegionId,

                    wallId:
                        state.selectedWallId,

                    materialId:
                        selectedWallMaterialId

                }

            });

        };

    //--------------------------------------------------
    // WALL → ENTIRE ROOM
    //--------------------------------------------------

    const handleApplyWallToRoom =
        () => {

            if (
                !state.selectedRegionId ||
                !selectedWallMaterialId
            ) {

                return;

            }

            const region =
                selectedRegion;

            if (
                !region
            ) {

                return;

            }

            //--------------------------------------------------
            // Prevent duplicate wall IDs.
            //--------------------------------------------------

            const wallIds =
                new Set(
                    region.walls.map(
                        wall =>
                            wall.id
                    )
                );

            for (
                const wallId
                of wallIds
            ) {

                dispatch({

                    type:
                        "SET_WALL_FINISH",

                    payload: {

                        regionId:
                            region.id,

                        wallId,

                        materialId:
                            selectedWallMaterialId

                    }

                });

            }

        };

    //--------------------------------------------------
    // WALL → ENTIRE HOUSE
    //
    // Note that shared walls receive a separate
    // assignment for each room side.
    //--------------------------------------------------

    const handleApplyWallToAll =
        () => {

            if (
                !selectedWallMaterialId
            ) {

                return;

            }

            for (
                const region
                of regions
            ) {

                const wallIds =
                    new Set(
                        region.walls.map(
                            wall =>
                                wall.id
                        )
                    );

                for (
                    const wallId
                    of wallIds
                ) {

                    dispatch({

                        type:
                            "SET_WALL_FINISH",

                        payload: {

                            regionId:
                                region.id,

                            wallId,

                            materialId:
                                selectedWallMaterialId

                        }

                    });

                }

            }

        };

    return (

        <div
            className="design-panel"
        >

            {/* =========================================
                FLOOR
                ========================================= */}

            <MaterialSection

                title="Floor"

                materials={
                    flooringMaterials
                }

                selectedMaterialId={
                    selectedFloorMaterialId
                }

                defaultOpen={
                    true
                }

                onSelect={
                    setSelectedFloorMaterialId
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
                        selectedFloorMaterialId
                    )
                }

                canApplyToAll={
                    Boolean(
                        selectedFloorMaterialId &&
                        regions.length > 0
                    )
                }

            />


            {/* =========================================
                WALLS
                ========================================= */}

            <MaterialSection

                title="Walls"

                materials={
                    wallMaterials
                }

                selectedMaterialId={
                    selectedWallMaterialId
                }

                defaultOpen={
                    false
                }

                onSelect={
                    setSelectedWallMaterialId
                }

                onApply={
                    handleApplyWall
                }

                onApplyToRoom={
                    handleApplyWallToRoom
                }

                onApplyToAll={
                    handleApplyWallToAll
                }

                canApply={
                    Boolean(
                        selectedWallBelongsToRoom &&
                        selectedWallMaterialId
                    )
                }

                canApplyToRoom={
                    Boolean(
                        state.selectedRegionId &&
                        selectedWallMaterialId &&
                        selectedRegion
                    )
                }

                canApplyToAll={
                    Boolean(
                        selectedWallMaterialId &&
                        regions.length > 0
                    )
                }

            />

        </div>
    );
}