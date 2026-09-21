import {
    useEffect,
    useMemo,
    useState
} from "react";

import useEditor
    from "../../../context/editor/useEditor";

import type {
    Material
} from "../../../engine/materials/MaterialTypes";

import {
    getWallMaterials
} from "../../../engine/materials/walls";

import {
    getFloorMaterials
} from "../../../engine/materials/floors";

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

    //==================================================
    // CURRENT REGIONS
    //==================================================

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

    //==================================================
    // FIREBASE FLOOR MATERIALS
    //==================================================

    const [
        flooringMaterials,
        setFlooringMaterials
    ] = useState<Material[]>(
        []
    );

    const [
        floorMaterialsLoading,
        setFloorMaterialsLoading
    ] = useState<boolean>(
        true
    );

    const [
        floorMaterialsError,
        setFloorMaterialsError
    ] = useState<boolean>(
        false
    );

    useEffect(() => {

        let cancelled = false;

        async function loadFloorMaterials() {

            try {

                setFloorMaterialsLoading(
                    true
                );

                setFloorMaterialsError(
                    false
                );

                const materials =
                    await getFloorMaterials();

                if (
                    cancelled
                ) {

                    return;
                }

                setFlooringMaterials(
                    materials
                );

            } catch (error) {

                console.error(
                    "Failed to load floor materials:",
                    error
                );

                if (
                    cancelled
                ) {

                    return;
                }

                setFlooringMaterials(
                    []
                );

                setFloorMaterialsError(
                    true
                );

            } finally {

                if (
                    !cancelled
                ) {

                    setFloorMaterialsLoading(
                        false
                    );

                }

            }
        }

        loadFloorMaterials();

        return () => {

            cancelled = true;

        };

    }, []);

    //==================================================
    // FIREBASE WALL MATERIALS
    //==================================================

    const [
        wallMaterials,
        setWallMaterials
    ] = useState<Material[]>(
        []
    );

    const [
        wallMaterialsLoading,
        setWallMaterialsLoading
    ] = useState<boolean>(
        true
    );

    const [
        wallMaterialsError,
        setWallMaterialsError
    ] = useState<boolean>(
        false
    );

    useEffect(() => {

        let cancelled = false;

        async function loadWallMaterials() {

            try {

                setWallMaterialsLoading(
                    true
                );

                setWallMaterialsError(
                    false
                );

                const materials =
                    await getWallMaterials();

                if (
                    cancelled
                ) {

                    return;
                }

                setWallMaterials(
                    materials
                );

            } catch (error) {

                console.error(
                    "Failed to load wall materials:",
                    error
                );

                if (
                    cancelled
                ) {

                    return;
                }

                setWallMaterials(
                    []
                );

                setWallMaterialsError(
                    true
                );

            } finally {

                if (
                    !cancelled
                ) {

                    setWallMaterialsLoading(
                        false
                    );

                }

            }
        }

        loadWallMaterials();

        return () => {

            cancelled = true;

        };

    }, []);

    //==================================================
    // UI-SELECTED FLOOR MATERIAL
    //==================================================

    const [
        selectedFloorMaterialId,
        setSelectedFloorMaterialId
    ] = useState<string | null>(
        null
    );

    //==================================================
    // UI-SELECTED WALL MATERIAL
    //==================================================

    const [
        selectedWallMaterialId,
        setSelectedWallMaterialId
    ] = useState<string | null>(
        null
    );

    //==================================================
    // SELECTED REGION
    //==================================================

    const selectedRegion =
        regions.find(
            region =>
                region.id ===
                state.selectedRegionId
        ) ?? null;

    //==================================================
    // CURRENT FLOOR MATERIAL
    //==================================================

    const currentFloorMaterialId =
        state.selectedRegionId

            ? (
                state.floorFinishes[
                    state.selectedRegionId
                ] ?? null
            )

            : null;

    //==================================================
    // SELECTED WALL BELONGS TO ROOM
    //==================================================

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

    //==================================================
    // CURRENT WALL MATERIAL
    //==================================================

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

    //==================================================
    // KEEP FLOOR UI SELECTION SYNCHRONIZED
    //==================================================

    useEffect(() => {

        setSelectedFloorMaterialId(
            currentFloorMaterialId
        );

    }, [
        state.selectedRegionId,
        currentFloorMaterialId
    ]);

    //==================================================
    // KEEP WALL UI SELECTION SYNCHRONIZED
    //==================================================

    useEffect(() => {

        setSelectedWallMaterialId(
            currentWallMaterialId
        );

    }, [
        state.selectedRegionId,
        state.selectedWallId,
        currentWallMaterialId
    ]);

    //==================================================
    // FLOOR
    //==================================================

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

    //==================================================
    // FLOOR → ALL ROOMS
    //==================================================

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

    //==================================================
    // WALL → ONE WALL
    //==================================================

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

    //==================================================
    // WALL → ENTIRE ROOM
    //==================================================

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

    //==================================================
    // WALL → ENTIRE HOUSE
    //==================================================

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

    //==================================================
    // RENDER
    //==================================================

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

            {/* =========================================
                FLOOR LOADING / ERROR MESSAGE
                ========================================= */}

            {floorMaterialsLoading && (

                <div
                    className="material-empty"
                >
                    Loading floor materials...
                </div>

            )}

            {!floorMaterialsLoading &&
                floorMaterialsError && (

                <div
                    className="material-empty"
                >
                    Failed to load floor materials.
                </div>

            )}

            {/* =========================================
                WALL LOADING / ERROR MESSAGE
                ========================================= */}

            {wallMaterialsLoading && (

                <div
                    className="material-empty"
                >
                    Loading wall paints...
                </div>

            )}

            {!wallMaterialsLoading &&
                wallMaterialsError && (

                <div
                    className="material-empty"
                >
                    Failed to load wall paints.
                </div>

            )}

        </div>
    );
}