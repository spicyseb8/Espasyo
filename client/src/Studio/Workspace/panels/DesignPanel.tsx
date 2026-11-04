
import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { Columns2, Plus, Rows2, Search, X } from "lucide-react";
import "./DesignPanel.css";

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
    getWallFinishSides,
    WALL_SIDE_FINISH_BUCKET
} from "../../../engine/walls/WallFinishUtils";
import {
    getWallPaintFaceKey,
    getWallPaintSections,
    removeWallPaintSeparator,
    type WallPaintMergeConflict,
    type WallPaintFace,
    type WallPaintSection,
    type WallPaintSeparatorOrientation
} from "../../../../../shared/wallPaintSeparators";

import MaterialSection
    from "./MaterialSection";

function filterMaterialsBySearch(
    materials: Material[],
    search: string
): Material[] {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
        return materials;
    }

    return materials.filter(material =>
        Object.values(material as unknown as Record<string, unknown>).some(
            value =>
                typeof value === "string" &&
                value.toLowerCase().includes(normalizedSearch)
        )
    );
}

export default function DesignPanel() {
    const {
        state,
        dispatch
    } = useEditor();
    const [showSeparatorOrientations, setShowSeparatorOrientations] =
        useState(false);
    const [materialSearch, setMaterialSearch] = useState("");
    const separatorMenuRef = useRef<HTMLDivElement | null>(null);
    const [pendingMerge, setPendingMerge] = useState<{
        faceKey: string;
        separatorId: string;
        face: WallPaintFace;
        wallId: string;
        side: 1 | -1;
        regionId: string | null;
        baseMaterialId?: string;
        choices: Record<string, string>;
        conflicts: WallPaintMergeConflict[];
    } | null>(null);
    const [pendingFloorMerge, setPendingFloorMerge] = useState<{
        regionId: string;
        separatorId: string;
        face: WallPaintFace;
        baseMaterialId?: string;
        choices: Record<string, string>;
        conflicts: WallPaintMergeConflict[];
    } | null>(null);

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

    const normalizedMaterialSearch = materialSearch.trim().toLowerCase();

    const filteredFlooringMaterials = useMemo(
        () => filterMaterialsBySearch(flooringMaterials, normalizedMaterialSearch),
        [flooringMaterials, normalizedMaterialSearch]
    );

    const filteredWallMaterials = useMemo(
        () => filterMaterialsBySearch(wallMaterials, normalizedMaterialSearch),
        [wallMaterials, normalizedMaterialSearch]
    );

    useEffect(() => {
        if (!showSeparatorOrientations) {
            return;
        }

        const handleOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && !separatorMenuRef.current?.contains(target)) {
                setShowSeparatorOrientations(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
        };
    }, [showSeparatorOrientations]);

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
    const selectedFloorFace = state.selectedRegionId
        ? state.floorPaintSeparators[state.selectedRegionId]
        : undefined;
    const selectedFloorSections = getWallPaintSections(selectedFloorFace);
    const selectedFloorSection = selectedFloorSections.find(
        section => section.id === state.selectedFloorSectionId
    );
    const selectedFloorSectionMaterialId = selectedFloorSection
        ? selectedFloorFace?.sectionMaterials[selectedFloorSection.id] ??
            currentFloorMaterialId
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

    const selectedWallFaceKey =
        state.selectedWallId &&
        state.selectedWallSide !== null
            ? getWallPaintFaceKey(
                state.selectedWallId,
                state.selectedWallSide
            )
            : null;
    const selectedWallFace = selectedWallFaceKey
        ? state.wallPaintSeparators[selectedWallFaceKey]
        : undefined;
    const selectedWallSections = getWallPaintSections(selectedWallFace);
    const selectedWallSection: WallPaintSection | undefined =
        selectedWallSections.find(
            section => section.id === state.selectedWallSectionId
        );
    const selectedSectionMaterialId = selectedWallSection
        ? selectedWallFace?.sectionMaterials[selectedWallSection.id] ??
            currentWallMaterialId
        : null;

    const selectedFloorMaterialId =
        state.activeFloorMaterialId ??
        selectedFloorSectionMaterialId ??
        currentFloorMaterialId;

    const selectedWallMaterialId =
        state.activeWallMaterialId ??
        selectedSectionMaterialId ??
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

        if (selectedFloorSection) {
            dispatch({
                type: "SET_FLOOR_SECTION_MATERIAL",
                payload: {
                    regionId: state.selectedRegionId,
                    sectionId: selectedFloorSection.id,
                    materialId: selectedFloorMaterialId
                }
            });
        } else {
            dispatch({
                type: "SET_FLOOR_FINISH",
                payload: {
                    regionId: state.selectedRegionId,
                    materialId: selectedFloorMaterialId
                }
            });
        }
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

        if (selectedWallSection && selectedWallFaceKey) {
            dispatch({
                type: "SET_WALL_SECTION_MATERIAL",
                payload: {
                    faceKey: selectedWallFaceKey,
                    sectionId: selectedWallSection.id,
                    materialId: selectedWallMaterialId
                }
            });
        } else {
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
        }
    };

    const handleStartSeparatorPlacement = (
        orientation: WallPaintSeparatorOrientation
    ) => {
        dispatch({
            type: "SET_WALL_SEPARATOR_PLACEMENT",
            payload: orientation
        });
        setShowSeparatorOrientations(false);
        setPendingMerge(null);
        setPendingFloorMerge(null);
    };

    const commitSeparatorRemoval = (
        faceKey: string,
        wallId: string,
        side: 1 | -1,
        regionId: string | null,
        nextFace: WallPaintFace | null,
        baseMaterialId?: string
    ) => {
        setPendingMerge(null);
        if (!nextFace || nextFace.separators.length === 0) {
            const retainedMaterialId = Object.values(
                nextFace?.sectionMaterials ?? {}
            )[0] ?? baseMaterialId;
            if (retainedMaterialId) {
                dispatch({
                    type: "SET_WALL_FINISH",
                    payload: {
                        regionId,
                        wallId,
                        materialId: retainedMaterialId,
                        side
                    }
                });
            }
            dispatch({
                type: "SET_WALL_PAINT_FACE",
                payload: { faceKey, face: null }
            });
            return;
        }
        dispatch({
            type: "SET_WALL_PAINT_FACE",
            payload: { faceKey, face: nextFace }
        });
    };

    const handleRemoveSeparator = (
        choices: Record<string, string> = {}
    ) => {
        if (
            !selectedWallFaceKey ||
            !selectedWallFace ||
            !state.selectedWallSeparatorId ||
            !state.selectedWallId ||
            state.selectedWallSide === null
        ) {
            return;
        }

        const wall = state.walls.find(
            item => item.id === state.selectedWallId
        );
        const baseMaterialId = wall
            ? getWallFinishSides(
                wall,
                regions,
                state.wallFinishes
            ).find(
                finish => finish.side === state.selectedWallSide
            )?.materialId
            : undefined;
        const result = removeWallPaintSeparator(
            selectedWallFace,
            state.selectedWallSeparatorId,
            baseMaterialId,
            choices
        );

        if (result.conflicts.length > 0) {
            setPendingMerge({
                faceKey: selectedWallFaceKey,
                separatorId: state.selectedWallSeparatorId,
                face: selectedWallFace,
                wallId: state.selectedWallId,
                side: state.selectedWallSide,
                regionId: selectedWallRegionForEdit?.id ?? null,
                baseMaterialId,
                choices,
                conflicts: result.conflicts
            });
            return;
        }

        commitSeparatorRemoval(
            selectedWallFaceKey,
            state.selectedWallId,
            state.selectedWallSide,
            selectedWallRegionForEdit?.id ?? null,
            result.face,
            baseMaterialId
        );
    };

    const handleRemoveFloorSeparator = (
        choices: Record<string, string> = {}
    ) => {
        const regionId = state.selectedRegionId;
        const separatorId = state.selectedFloorSeparatorId;
        const face = regionId
            ? state.floorPaintSeparators[regionId]
            : undefined;
        if (!regionId || !separatorId || !face) return;

        const baseMaterialId = state.floorFinishes[regionId];
        const result = removeWallPaintSeparator(
            face,
            separatorId,
            baseMaterialId,
            choices
        );
        if (result.conflicts.length > 0) {
            setPendingFloorMerge({
                regionId,
                separatorId,
                face,
                baseMaterialId,
                choices,
                conflicts: result.conflicts
            });
            return;
        }
        commitFloorSeparatorRemoval(regionId, result.face, baseMaterialId);
    };

    const commitFloorSeparatorRemoval = (
        regionId: string,
        nextFace: WallPaintFace | null,
        baseMaterialId?: string
    ) => {
        setPendingFloorMerge(null);
        if (!nextFace || nextFace.separators.length === 0) {
            const retainedMaterialId = Object.values(
                nextFace?.sectionMaterials ?? {}
            )[0] ?? baseMaterialId;
            if (retainedMaterialId) {
                dispatch({
                    type: "SET_FLOOR_FINISH",
                    payload: { regionId, materialId: retainedMaterialId }
                });
            }
            dispatch({
                type: "SET_FLOOR_PAINT_FACE",
                payload: { regionId, face: null }
            });
            return;
        }
        dispatch({
            type: "SET_FLOOR_PAINT_FACE",
            payload: { regionId, face: nextFace }
        });
    };

    const handleRemoveSelectedSeparator = () => {
        if (state.selectedWallSeparatorId) {
            handleRemoveSeparator();
        } else if (state.selectedFloorSeparatorId) {
            handleRemoveFloorSeparator();
        }
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
            <div
                ref={separatorMenuRef}
                className={`design-panel-tools ${
                    showSeparatorOrientations ? "has-separator-options" : ""
                }`}
                onKeyDown={event => {
                    if (event.key === "Escape") {
                        setShowSeparatorOrientations(false);
                    }
                }}
                onMouseLeave={() => setShowSeparatorOrientations(false)}
            >
                <div
                    className="wall-separator-menu"
                    onMouseEnter={() => setShowSeparatorOrientations(true)}
                >
                    <button
                        type="button"
                        className="wall-separator-trigger"
                        aria-haspopup="true"
                        aria-expanded={showSeparatorOrientations}
                        aria-label={
                            state.wallSeparatorPlacement
                                ? "Cancel separator placement"
                                : "Add separator"
                        }
                        title={
                            state.wallSeparatorPlacement
                                ? "Cancel separator placement"
                                : "Add separator"
                        }
                        onClick={() => {
                            if (state.wallSeparatorPlacement) {
                                dispatch({
                                    type: "SET_WALL_SEPARATOR_PLACEMENT",
                                    payload: null
                                });
                                setShowSeparatorOrientations(false);
                                return;
                            }
                            setShowSeparatorOrientations(true);
                        }}
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <div className="design-panel-tool-row">
                    {!state.wallSeparatorPlacement && showSeparatorOrientations && (
                        <div
                            className="wall-separator-orientations is-visible"
                            role="group"
                            aria-label="Separator orientation"
                        >
                            <button
                                type="button"
                                className="wall-separator-option"
                                aria-label="Horizontal separator"
                                title="Horizontal separator"
                                onClick={() => handleStartSeparatorPlacement("horizontal")}
                            >
                                <Rows2 size={17} />
                            </button>
                            <button
                                type="button"
                                className="wall-separator-option"
                                aria-label="Vertical separator"
                                title="Vertical separator"
                                onClick={() => handleStartSeparatorPlacement("vertical")}
                            >
                                <Columns2 size={17} />
                            </button>
                        </div>
                    )}

                    <div
                        className="material-search"
                        onMouseEnter={() => setShowSeparatorOrientations(false)}
                    >
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={materialSearch}
                            onChange={event => setMaterialSearch(event.target.value)}
                            placeholder="Search materials..."
                            aria-label="Search floor and wall materials"
                        />
                        {materialSearch && (
                            <button
                                type="button"
                                className="material-search-clear"
                                aria-label="Clear material search"
                                title="Clear search"
                                onClick={() => setMaterialSearch("")}
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <MaterialSection
                title="Floor"
                materials={filteredFlooringMaterials}
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
            {!floorMaterialsLoading &&
                !floorMaterialsError &&
                normalizedMaterialSearch &&
                filteredFlooringMaterials.length === 0 &&
                flooringMaterials.length > 0 && (
                    <div className="material-empty">
                        No flooring materials match your search.
                    </div>
                )}

            <MaterialSection
                title="Walls"
                materials={filteredWallMaterials}
                selectedMaterialId={selectedWallMaterialId}
                onSelect={handleSelectWallMaterial}
                onApply={handleApplyWall}
                onApplyToRoom={handleApplyWallToRoom}
                onApplyToAll={handleApplyWallToAll}
                applyLabel="Apply to Wall"
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
            {!wallMaterialsLoading &&
                !wallMaterialsError &&
                normalizedMaterialSearch &&
                filteredWallMaterials.length === 0 &&
                wallMaterials.length > 0 && (
                    <div className="material-empty">
                        No wall paints match your search.
                    </div>
                )}

            {(state.selectedWallSeparatorId ||
                state.selectedFloorSeparatorId ||
                pendingMerge ||
                pendingFloorMerge) && (
            <section className="wall-separator-controls">
                <div className="wall-separator-control-actions">
                    {(state.selectedWallSeparatorId || state.selectedFloorSeparatorId) && (
                        <button
                            type="button"
                            className="wall-separator-remove"
                            onClick={handleRemoveSelectedSeparator}
                        >
                            Remove Selected
                        </button>
                    )}
                </div>
                {pendingMerge && (
                    <div className="wall-separator-merge">
                        <strong>Choose the paint to keep in each merged section</strong>
                        {pendingMerge.conflicts.map(conflict => (
                            <label key={conflict.sectionId}>
                                <span>Merged section</span>
                                <select
                                    value={pendingMerge.choices[conflict.sectionId] ?? ""}
                                    onChange={event => {
                                        const choices = {
                                            ...pendingMerge.choices,
                                            [conflict.sectionId]: event.target.value
                                        };
                                        setPendingMerge({
                                            ...pendingMerge,
                                            choices
                                        });
                                    }}
                                >
                                    <option value="" disabled>Select paint</option>
                                    {conflict.materialIds.map(materialId => {
                                        const material = wallMaterials.find(
                                            item => item.id === materialId
                                        );
                                        return (
                                            <option key={materialId} value={materialId}>
                                                {material?.name ?? materialId}
                                            </option>
                                        );
                                    })}
                                </select>
                            </label>
                        ))}
                        <button
                            type="button"
                            disabled={!pendingMerge.conflicts.every(conflict =>
                                conflict.materialIds.includes(
                                    pendingMerge.choices[conflict.sectionId] ?? ""
                                )
                            )}
                            onClick={() => {
                                const result = removeWallPaintSeparator(
                                    pendingMerge.face,
                                    pendingMerge.separatorId,
                                    pendingMerge.baseMaterialId,
                                    pendingMerge.choices
                                );
                                if (result.conflicts.length > 0) {
                                    setPendingMerge({
                                        ...pendingMerge,
                                        conflicts: result.conflicts
                                    });
                                    return;
                                }
                                commitSeparatorRemoval(
                                    pendingMerge.faceKey,
                                    pendingMerge.wallId,
                                    pendingMerge.side,
                                    pendingMerge.regionId,
                                    result.face,
                                    pendingMerge.baseMaterialId
                                );
                            }}
                        >
                            Merge Sections
                        </button>
                    </div>
                )}
                {pendingFloorMerge && (
                    <div className="wall-separator-merge">
                        <strong>Choose the flooring to keep in each merged section</strong>
                        {pendingFloorMerge.conflicts.map(conflict => (
                            <label key={conflict.sectionId}>
                                <span>Merged section</span>
                                <select
                                    value={pendingFloorMerge.choices[conflict.sectionId] ?? ""}
                                    onChange={event => {
                                        const choices = {
                                            ...pendingFloorMerge.choices,
                                            [conflict.sectionId]: event.target.value
                                        };
                                        setPendingFloorMerge({
                                            ...pendingFloorMerge,
                                            choices
                                        });
                                    }}
                                >
                                    <option value="" disabled>Select flooring</option>
                                    {conflict.materialIds.map(materialId => {
                                        const material = flooringMaterials.find(
                                            item => item.id === materialId
                                        );
                                        return (
                                            <option key={materialId} value={materialId}>
                                                {material?.name ?? materialId}
                                            </option>
                                        );
                                    })}
                                </select>
                            </label>
                        ))}
                        <button
                            type="button"
                            disabled={!pendingFloorMerge.conflicts.every(conflict =>
                                conflict.materialIds.includes(
                                    pendingFloorMerge.choices[conflict.sectionId] ?? ""
                                )
                            )}
                            onClick={() => {
                                const result = removeWallPaintSeparator(
                                    pendingFloorMerge.face,
                                    pendingFloorMerge.separatorId,
                                    pendingFloorMerge.baseMaterialId,
                                    pendingFloorMerge.choices
                                );
                                if (result.conflicts.length > 0) {
                                    setPendingFloorMerge({
                                        ...pendingFloorMerge,
                                        conflicts: result.conflicts
                                    });
                                    return;
                                }
                                commitFloorSeparatorRemoval(
                                    pendingFloorMerge.regionId,
                                    result.face,
                                    pendingFloorMerge.baseMaterialId
                                );
                            }}
                        >
                            Merge Sections
                        </button>
                    </div>
                )}
            </section>
            )}

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
