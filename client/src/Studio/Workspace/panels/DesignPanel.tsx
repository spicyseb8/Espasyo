
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

import {
    getRegionWallFinishAssignments,
    WALL_SIDE_FINISH_BUCKET
} from "../../../engine/walls/WallFinishUtils";

import MaterialSection
    from "./MaterialSection";

export default function DesignPanel() {
    const {
        state,
        dispatch
    } = useEditor();

    const regions = useMemo(
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
    ] = useState<Material[]>([]);

    const [
        floorMaterialsLoading,
        setFloorMaterialsLoading
    ] = useState(true);

    const [
        floorMaterialsError,
        setFloorMaterialsError
    ] = useState(false);

    const [
        wallMaterials,
        setWallMaterials
    ] = useState<Material[]>([]);

    const [
        wallMaterialsLoading,
        setWallMaterialsLoading
    ] = useState(true);

    const [
        wallMaterialsError,
        setWallMaterialsError
    ] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadFloorMaterials() {
            try {
                setFloorMaterialsLoading(true);
                setFloorMaterialsError(false);

                const materials = await getFloorMaterials();

                if (cancelled) {
                    return;
                }

                setFlooringMaterials(materials);
            } catch (error) {
                console.error(
                    "Failed to load floor materials:",
                    error
                );

                if (cancelled) {
                    return;
                }

                setFlooringMaterials([]);
                setFloorMaterialsError(true);
            } finally {
                if (!cancelled) {
                    setFloorMaterialsLoading(false);
                }
            }
        }

        loadFloorMaterials();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadWallMaterials() {
            try {
                setWallMaterialsLoading(true);
                setWallMaterialsError(false);

                const materials = await getWallMaterials();

                if (cancelled) {
                    return;
                }

                setWallMaterials(materials);
            } catch (error) {
                console.error(
                    "Failed to load wall materials:",
                    error
                );

                if (cancelled) {
                    return;
                }

                setWallMaterials([]);
                setWallMaterialsError(true);
            } finally {
                if (!cancelled) {
                    setWallMaterialsLoading(false);
                }
            }
        }

        loadWallMaterials();

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedRegion =
        regions.find(
            region =>
                region.id === state.selectedRegionId
        ) ?? null;

    const selectedWallRegion =
        regions.find(
            region =>
                region.id === state.selectedWallRegionId
        ) ?? null;

    const selectedWallRegionForEdit =
        selectedWallRegion ??
        (
            selectedRegion &&
            state.selectedWallId &&
            selectedRegion.walls.some(
                wall =>
                    wall.id === state.selectedWallId
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
                    wall.id === state.selectedWallId
            )
        );

    // Read the material assigned to the actual selected face.
    const selectedWallSideKey =
        state.selectedWallId &&
        state.selectedWallSide !== null &&
        state.selectedWallSide !== undefined
            ? `${state.selectedWallId}::side:${state.selectedWallSide}`
            : null;

    const sideWallMaterialId =
        selectedWallSideKey
            ? state.wallFinishes[
                WALL_SIDE_FINISH_BUCKET
            ]?.[selectedWallSideKey] ?? null
            : null;

    // Preserve compatibility with existing room-based wall finishes.
    const legacyWallMaterialId =
        selectedWallBelongsToRoom &&
        selectedWallRegionForEdit &&
        state.selectedWallId
            ? state.wallFinishes[
                selectedWallRegionForEdit.id
            ]?.[state.selectedWallId] ?? null
            : null;

    const currentWallMaterialId =
        sideWallMaterialId ??
        legacyWallMaterialId;

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
            const exists = flooringMaterials.some(
                material =>
                    material.id ===
                    state.activeFloorMaterialId
            );

            if (!exists) {
                dispatch({
                    type: "SET_ACTIVE_FLOOR_MATERIAL",
                    payload: null
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
            const exists = wallMaterials.some(
                material =>
                    material.id ===
                    state.activeWallMaterialId
            );

            if (!exists) {
                dispatch({
                    type: "SET_ACTIVE_WALL_MATERIAL",
                    payload: null
                });
            }
        }
    }, [
        state.activeWallMaterialId,
        wallMaterials,
        dispatch
    ]);

    const handleSelectFloorMaterial = (
        materialId: string
    ) => {
        dispatch({
            type: "SET_ACTIVE_FLOOR_MATERIAL",
            payload: materialId
        });
    };

    const handleSelectWallMaterial = (
        materialId: string
    ) => {
        dispatch({
            type: "SET_ACTIVE_WALL_MATERIAL",
            payload: materialId
        });
    };

    const handleApplyFloor = () => {
        if (
            !state.selectedRegionId ||
            !selectedFloorMaterialId
        ) {
            return;
        }

        dispatch({
            type: "SET_FLOOR_FINISH",
            payload: {
                regionId: state.selectedRegionId,
                materialId: selectedFloorMaterialId
            }
        });
    };

    const handleApplyFloorToAll = () => {
        if (
            !selectedFloorMaterialId
        ) {
            return;
        }

        for (const region of regions) {
            dispatch({
                type: "SET_FLOOR_FINISH",
                payload: {
                    regionId: region.id,
                    materialId: selectedFloorMaterialId
                }
            });
        }
    };

    // Apply the selected material to only the clicked wall face.
    const handleApplyWall = () => {
        if (
            !state.selectedWallId ||
            state.selectedWallSide === null ||
            state.selectedWallSide === undefined ||
            !selectedWallMaterialId
        ) {
            return;
        }

        dispatch({
            type: "SET_WALL_FINISH",
            payload: {
                regionId:
                    selectedWallRegionForEdit?.id ?? null,
                wallId: state.selectedWallId,
                materialId: selectedWallMaterialId,
                side: state.selectedWallSide
            }
        });
    };

    const handleApplyWallToRoom = () => {
        if (
            !selectedWallRegionForEdit ||
            !selectedWallMaterialId
        ) {
            return;
        }

        dispatch({
            type: "SET_WALL_FINISHES",
            payload: getRegionWallFinishAssignments(
                [selectedWallRegionForEdit],
                selectedWallMaterialId
            )
        });
    };

    const handleApplyWallToAll = () => {
        if (
            !selectedWallMaterialId
        ) {
            return;
        }

        dispatch({
            type: "SET_WALL_FINISHES",
            payload: getRegionWallFinishAssignments(
                regions,
                selectedWallMaterialId
            )
        });
    };

    const canApplyWall =
        Boolean(
            state.selectedWallId &&
            state.selectedWallSide !== null &&
            state.selectedWallSide !== undefined &&
            selectedWallMaterialId
        );

    return (
        <div className="design-panel">
            <MaterialSection
                title="Floor"
                materials={flooringMaterials}
                selectedMaterialId={selectedFloorMaterialId}
                onSelect={handleSelectFloorMaterial}
                onApply={handleApplyFloor}
                onApplyToAll={handleApplyFloorToAll}
                canApply={Boolean(
                    state.selectedRegionId &&
                    selectedFloorMaterialId
                )}
                canApplyToAll={Boolean(
                    selectedFloorMaterialId &&
                    regions.length > 0
                )}
            />

            <MaterialSection
                title="Walls"
                materials={wallMaterials}
                selectedMaterialId={selectedWallMaterialId}
                onSelect={handleSelectWallMaterial}
                onApply={handleApplyWall}
                onApplyToRoom={handleApplyWallToRoom}
                onApplyToAll={handleApplyWallToAll}
                canApply={canApplyWall}
                canApplyToRoom={Boolean(
                    selectedWallRegionForEdit &&
                    selectedWallMaterialId
                )}
                canApplyToAll={Boolean(
                    selectedWallMaterialId &&
                    regions.length > 0
                )}
            />

            {floorMaterialsLoading && (
                <div className="material-empty">
                    Loading floor materials...
                </div>
            )}

            {!floorMaterialsLoading &&
                floorMaterialsError && (
                    <div className="material-empty">
                        Failed to load floor materials.
                    </div>
                )}

            {wallMaterialsLoading && (
                <div className="material-empty">
                    Loading wall paints...
                </div>
            )}

            {!wallMaterialsLoading &&
                wallMaterialsError && (
                    <div className="material-empty">
                        Failed to load wall paints.
                    </div>
                )}
        </div>
    );
}
