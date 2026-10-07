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

    const [
        flooringMaterials,
        setFlooringMaterials
    ] =
        useState<Material[]>(
            []
        );

    const [
        floorMaterialsLoading,
        setFloorMaterialsLoading
    ] =
        useState(true);

    const [
        floorMaterialsError,
        setFloorMaterialsError
    ] =
        useState(false);

    const [
        wallMaterials,
        setWallMaterials
    ] =
        useState<Material[]>(
            []
        );

    const [
        wallMaterialsLoading,
        setWallMaterialsLoading
    ] =
        useState(true);

    const [
        wallMaterialsError,
        setWallMaterialsError
    ] =
        useState(false);

    useEffect(() => {
        let cancelled =
            false;

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
            cancelled =
                true;
        };
    }, []);

    useEffect(() => {
        let cancelled =
            false;

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
            cancelled =
                true;
        };
    }, []);

    const selectedRegion =
        regions.find(
            region =>
                region.id ===
                state.selectedRegionId
        ) ?? null;

    const selectedWallRegion =
        regions.find(
            region =>
                region.id ===
                state.selectedWallRegionId
        ) ?? null;

    const selectedWallRegionForEdit =
        selectedWallRegion ??
        (
            selectedRegion &&
            state.selectedWallId &&
            selectedRegion.walls.some(
                wall =>
                    wall.id ===
                    state.selectedWallId
            )
                ? selectedRegion
                : null
        );

    const currentFloorMaterialId =
        state.selectedRegionId
            ? state.floorFinishes[
                state.selectedRegionId
            ] ?? null
            : null;

    const selectedWallBelongsToRoom =
        Boolean(
            state.selectedWallId &&
            selectedWallRegionForEdit &&
            selectedWallRegionForEdit.walls.some(
                wall =>
                    wall.id ===
                    state.selectedWallId
            )
        );

    const currentWallMaterialId =
        selectedWallBelongsToRoom &&
        selectedWallRegionForEdit
            ? state.wallFinishes[
                selectedWallRegionForEdit.id
            ]?.[
                state.selectedWallId!
            ] ?? null
            : null;

    const selectedFloorMaterialId =
        state.activeFloorMaterialId ??
        currentFloorMaterialId;

    const selectedWallMaterialId =
        state.activeWallMaterialId ??
        currentWallMaterialId;

    useEffect(() => {
        if (
            state.activeFloorMaterialId &&
            flooringMaterials.length > 0
        ) {
            const exists =
                flooringMaterials.some(
                    material =>
                        material.id ===
                        state.activeFloorMaterialId
                );

            if (
                !exists
            ) {
                dispatch({
                    type:
                        "SET_ACTIVE_FLOOR_MATERIAL",
                    payload:
                        null
                });
            }
        }
    }, [
        state.activeFloorMaterialId,
        flooringMaterials,
        dispatch
    ]);

    useEffect(() => {
        if (
            state.activeWallMaterialId &&
            wallMaterials.length > 0
        ) {
            const exists =
                wallMaterials.some(
                    material =>
                        material.id ===
                        state.activeWallMaterialId
                );

            if (
                !exists
            ) {
                dispatch({
                    type:
                        "SET_ACTIVE_WALL_MATERIAL",
                    payload:
                        null
                });
            }
        }
    }, [
        state.activeWallMaterialId,
        wallMaterials,
        dispatch
    ]);

    const handleSelectFloorMaterial =
        (
            materialId: string
        ) => {
            if (
                !state.layoutConfirmed
            ) {
                return;
            }

            dispatch({
                type:
                    "SET_ACTIVE_FLOOR_MATERIAL",
                payload:
                    materialId
            });
        };

    const handleSelectWallMaterial =
        (
            materialId: string
        ) => {
            if (
                !state.layoutConfirmed
            ) {
                return;
            }

            dispatch({
                type:
                    "SET_ACTIVE_WALL_MATERIAL",
                payload:
                    materialId
            });
        };

    const handleApplyFloor =
        () => {
            if (
                !state.layoutConfirmed ||
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

    const handleApplyFloorToAll =
        () => {
            if (
                !state.layoutConfirmed ||
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

    const handleApplyWall =
        () => {
            if (
                !state.layoutConfirmed ||
                !state.selectedWallId ||
                !selectedWallRegionForEdit ||
                !selectedWallBelongsToRoom ||
                !selectedWallMaterialId
            ) {
                return;
            }

            dispatch({
                type:
                    "SET_WALL_FINISH",
                payload: {
                    regionId:
                        selectedWallRegionForEdit.id,
                    wallId:
                        state.selectedWallId,
                    materialId:
                        selectedWallMaterialId
                }
            });
        };

    const handleApplyWallToRoom =
        () => {
            if (
                !state.layoutConfirmed ||
                !selectedWallRegionForEdit ||
                !selectedWallMaterialId
            ) {
                return;
            }

            const wallIds =
                new Set(
                    selectedWallRegionForEdit.walls.map(
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
                            selectedWallRegionForEdit.id,
                        wallId,
                        materialId:
                            selectedWallMaterialId
                    }
                });
            }
        };

    const handleApplyWallToAll =
        () => {
            if (
                !state.layoutConfirmed ||
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

    const layoutConfirmed =
        state.layoutConfirmed;

    return (
        <div
            className="design-panel"
            style={{
                opacity:
                    layoutConfirmed
                        ? 1
                        : 0.5
            }}
        >
            {
                !layoutConfirmed && (
                    <div
                        className="material-empty"
                        style={{
                            marginBottom:
                                "10px",
                            textAlign:
                                "center"
                        }}
                    >
                        Confirm the layout first before applying floor or wall finishes.
                    </div>
                )
            }

            <MaterialSection
                title="Floor"
                materials={
                    flooringMaterials
                }
                selectedMaterialId={
                    selectedFloorMaterialId
                }
                onSelect={
                    handleSelectFloorMaterial
                }
                onApply={
                    handleApplyFloor
                }
                onApplyToAll={
                    handleApplyFloorToAll
                }
                canApply={
                    Boolean(
                        layoutConfirmed &&
                        state.selectedRegionId &&
                        selectedFloorMaterialId
                    )
                }
                canApplyToAll={
                    Boolean(
                        layoutConfirmed &&
                        selectedFloorMaterialId &&
                        regions.length > 0
                    )
                }
            />

            <MaterialSection
                title="Walls"
                materials={
                    wallMaterials
                }
                selectedMaterialId={
                    selectedWallMaterialId
                }
                onSelect={
                    handleSelectWallMaterial
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
                        layoutConfirmed &&
                        selectedWallBelongsToRoom &&
                        selectedWallMaterialId
                    )
                }
                canApplyToRoom={
                    Boolean(
                        layoutConfirmed &&
                        selectedWallRegionForEdit &&
                        selectedWallMaterialId
                    )
                }
                canApplyToAll={
                    Boolean(
                        layoutConfirmed &&
                        selectedWallMaterialId &&
                        regions.length > 0
                    )
                }
            />

            {
                floorMaterialsLoading && (
                    <div
                        className="material-empty"
                    >
                        Loading floor materials...
                    </div>
                )
            }

            {
                !floorMaterialsLoading &&
                floorMaterialsError && (
                    <div
                        className="material-empty"
                    >
                        Failed to load floor materials.
                    </div>
                )
            }

            {
                wallMaterialsLoading && (
                    <div
                        className="material-empty"
                    >
                        Loading wall paints...
                    </div>
                )
            }

            {
                !wallMaterialsLoading &&
                wallMaterialsError && (
                    <div
                        className="material-empty"
                    >
                        Failed to load wall paints.
                    </div>
                )
            }
        </div>
    );
}