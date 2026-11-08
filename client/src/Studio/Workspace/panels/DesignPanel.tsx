
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { Search, SeparatorHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
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
    getWallFinishSides
} from "../../../engine/walls/WallFinishUtils";
import {
    getWallPaintFaceKey,
    removeWallPaintSeparator,
    type WallPaintMergeConflict,
    type WallPaintFace,
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

type FlooringCategory = "all" | "tiles" | "wood";

function getFlooringCategory(
    material: Material
): Exclude<FlooringCategory, "all"> | null {
    const sourceCategory = material.sourceCategory?.trim().toLowerCase() ?? "";

    if (/\bwood\b|\btimber\b/.test(sourceCategory)) {
        return "wood";
    }

    if (/\btile\b|\btiles\b|\bceramic\b/.test(sourceCategory)) {
        return "tiles";
    }

    const materialName = material.name.toLowerCase();
    if (/\bwood\b|\btimber\b/.test(materialName)) {
        return "wood";
    }

    if (/\btile\b|\btiles\b|\bceramic\b/.test(materialName)) {
        return "tiles";
    }

    return null;
}

interface Props {
    mode: "flooring" | "paint";
}

export default function DesignPanel({ mode }: Props) {
    const {
        state,
        dispatch
    } = useEditor();
    const [showSeparatorOrientations, setShowSeparatorOrientations] =
        useState(false);
    const [separatorPopoverPosition, setSeparatorPopoverPosition] =
        useState<{ top: number; left: number } | null>(null);
    const [materialSearch, setMaterialSearch] = useState("");
    const [flooringCategory, setFlooringCategory] =
        useState<FlooringCategory>("all");
    const [floorFavoritesFirst, setFloorFavoritesFirst] = useState(false);
    const [wallFavoritesFirst, setWallFavoritesFirst] = useState(false);
    const separatorMenuRef = useRef<HTMLDivElement | null>(null);
    const separatorTriggerRef = useRef<HTMLButtonElement | null>(null);
    const separatorPopoverRef = useRef<HTMLDivElement | null>(null);
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
        () => {
            const searchedMaterials = filterMaterialsBySearch(
                flooringMaterials,
                normalizedMaterialSearch
            );

            return flooringCategory === "all"
                ? searchedMaterials
                : searchedMaterials.filter(
                    material =>
                        getFlooringCategory(material) === flooringCategory
                );
        },
        [flooringMaterials, flooringCategory, normalizedMaterialSearch]
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
            if (
                target instanceof Node &&
                !separatorMenuRef.current?.contains(target) &&
                !separatorPopoverRef.current?.contains(target)
            ) {
                setShowSeparatorOrientations(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
        };
    }, [showSeparatorOrientations]);

    useLayoutEffect(() => {
        if (!showSeparatorOrientations) {
            return;
        }

        const updatePosition = () => {
            const trigger = separatorTriggerRef.current;
            if (!trigger) return;

            const bounds = trigger.getBoundingClientRect();
            const popoverWidth = Math.min(248, window.innerWidth - 24);
            const left = Math.max(
                12,
                Math.min(bounds.left, window.innerWidth - popoverWidth - 12)
            );
            setSeparatorPopoverPosition({
                top: Math.max(8, bounds.top - 106),
                left
            });
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [showSeparatorOrientations]);

    useEffect(() => {
        if (!showSeparatorOrientations) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setShowSeparatorOrientations(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
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
            payload: state.activeFloorMaterialId === materialId
                ? null
                : materialId
        });
    };

    const handleSelectWallMaterial = (
        materialId: string
    ) => {
        dispatch({
            type: "SET_ACTIVE_WALL_MATERIAL",
            payload: state.activeWallMaterialId === materialId
                ? null
                : materialId
        });
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

    return (
        <div className="design-panel">
            <div
                ref={separatorMenuRef}
                className="design-panel-tools"
            >
                <div className="wall-separator-menu">
                    <button
                        ref={separatorTriggerRef}
                        type="button"
                        className="wall-separator-trigger"
                        aria-haspopup="true"
                        aria-expanded={showSeparatorOrientations}
                        aria-label={
                            state.wallSeparatorPlacement
                                ? "Cancel separator placement"
                                : "Add a surface separator"
                        }
                        title={
                            state.wallSeparatorPlacement
                                ? "Cancel separator placement"
                                : "Divide a floor or wall surface into sections"
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
                            setShowSeparatorOrientations(current => !current);
                        }}
                    >
                        <SeparatorHorizontal size={17} aria-hidden="true" />
                    </button>
                </div>
                <div className="design-panel-tool-row">
                    <div
                        className="material-search"
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

            {!state.wallSeparatorPlacement &&
                showSeparatorOrientations &&
                createPortal(
                    <div
                        ref={separatorPopoverRef}
                        className="wall-separator-orientations"
                        role="group"
                        aria-label="Separator orientation"
                        style={separatorPopoverPosition
                            ? {
                                top: separatorPopoverPosition.top,
                                left: separatorPopoverPosition.left
                            }
                            : { visibility: "hidden" }}
                    >
                        <button
                            type="button"
                            className="wall-separator-option"
                            aria-label="Horizontal: divide the selected surface into top and bottom sections"
                            onClick={() => handleStartSeparatorPlacement("horizontal")}
                        >
                            <span className="separator-orientation-diagram horizontal" aria-hidden="true" />
                            <span className="separator-option-copy">
                                <strong>Horizontal</strong>
                                <span>Top and bottom sections</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className="wall-separator-option"
                            aria-label="Vertical: divide the selected surface into left and right sections"
                            onClick={() => handleStartSeparatorPlacement("vertical")}
                        >
                            <span className="separator-orientation-diagram vertical" aria-hidden="true" />
                            <span className="separator-option-copy">
                                <strong>Vertical</strong>
                                <span>Left and right sections</span>
                            </span>
                        </button>
                    </div>,
                    document.body
                )}

            {mode === "flooring" && (
                <>
                    <MaterialSection
                        title="Flooring"
                        materials={filteredFlooringMaterials}
                        favoriteType="flooring"
                        flooringCategory={flooringCategory}
                        onFlooringCategoryChange={setFlooringCategory}
                        favoritesFirst={floorFavoritesFirst}
                        onToggleFavoritesFirst={() =>
                            setFloorFavoritesFirst(value => !value)
                        }
                        selectedMaterialId={state.activeFloorMaterialId}
                        onSelect={handleSelectFloorMaterial}
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
                    {floorMaterialsLoading && (
                        <div className="material-empty">
                            Loading floor materials...
                        </div>
                    )}
                    {!floorMaterialsLoading && floorMaterialsError && (
                        <div className="material-empty">
                            Failed to load floor materials.
                        </div>
                    )}
                </>
            )}

            {mode === "paint" && (
                <>
                    <MaterialSection
                        title="Paint"
                        materials={filteredWallMaterials}
                        favoriteType="wallPaint"
                        favoritesFirst={wallFavoritesFirst}
                        onToggleFavoritesFirst={() =>
                            setWallFavoritesFirst(value => !value)
                        }
                        selectedMaterialId={state.activeWallMaterialId}
                        onSelect={handleSelectWallMaterial}
                    />
                    {!wallMaterialsLoading &&
                        !wallMaterialsError &&
                        normalizedMaterialSearch &&
                        filteredWallMaterials.length === 0 &&
                        wallMaterials.length > 0 && (
                            <div className="material-empty">
                                No paint materials match your search.
                            </div>
                        )}
                    {wallMaterialsLoading && (
                        <div className="material-empty">
                            Loading wall paints...
                        </div>
                    )}
                    {!wallMaterialsLoading && wallMaterialsError && (
                        <div className="material-empty">
                            Failed to load wall paints.
                        </div>
                    )}
                </>
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
                {mode === "paint" && pendingMerge && (
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
                {mode === "flooring" && pendingFloorMerge && (
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

        </div>
    );
}
