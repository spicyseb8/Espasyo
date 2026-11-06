import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    CalendarDays,
    Redo2,
    Save,
    Send,
    Trash2,
    Undo2,
    X
} from "lucide-react";
import { Vector3 } from "three";
import LoadingScreen from "@/components/LoadingScreen";
import type { Corner } from "@/components/project-loader/engine/walls/Corner";
import type { Wall } from "@/components/project-loader/engine/walls/WallTypes";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import { pointInPolygon } from "@/components/project-loader/engine/regions/Polygon";
import { solveRegions } from "@/components/project-loader/engine/regions/RegionSolver";
import {
    getAdminProject,
    getTomorrowLocalDateTime,
    getTodayLocalDate,
    isValidProjectDeadline,
    normalizeProjectDeadlineForInput
} from "@/services/assets/projectService";
import {
    getManagedFloorPlanDraft,
    loadManagedProjectStructure,
    publishManagedFloorPlanDraft,
    deleteManagedFloorPlanDraft,
    saveManagedFloorPlanDraft,
    saveManagedStructure
} from "@/services/assets/projectStructureService";
import { validateStructuralProjectData } from "@/services/assets/projectStructureContract";
import {
    loadLocalManagedProjectDraft,
    removeLocalManagedProjectDraft
} from "@/services/assets/localManagedProjectDraft";
import { createManagedEditorExitFingerprint } from "./managedEditorExitGuard";
import { useAuth } from "@/context/AuthContext";
import { getDoorAssets, getWindowAssets } from "@/services/assets/FirebaseDoorWindowLibrary";
import AdminBuildPanel from "./AdminBuildPanel";
import AdminToolDock from "./AdminToolDock";
import type { AdminStructuralTool } from "./AdminToolDock";
import AdminFloorRail from "./Adminfloorrail";
import AdminStructureScene from "./AdminStructureScene";
import {
    blueprintDisplayBounds,
    calculateCalibratedBlueprintWidth,
    distanceBetween2D,
    svgPointToWorld
} from "./blueprintGeometry";
import {
    addWallSegmentToStructure,
    closestPointOnWall,
    createManagedStructureFromExteriorOutline,
    findNearestWallEndpoint,
    findOrCreateCorner,
    hasPartialPolygonOverlap,
    getRoomPreviewGeometry,
    resolveWallDrawingPoint,
    snapToCorner,
    snapToGrid,
    snapToWallEndpoint,
    snap90Degrees,
    type Point3
} from "./structureGeometry";
import {
    calculateBuildElementPlacement,
    type BuildElementPlacementCandidate
} from "./buildElementPlacement";
import type { AdminElementModelBounds } from "@/components/project-loader/loader-components/AdminElementModelUtils";
import {
    createManagedEditorFloor,
    createManagedStructure,
    loadManagedEditorFloors,
    serializeManagedStructureProject,
    getFloorName,
    type ManagedEditorFloor,
    type ManagedStructure,
    type StructureCorner,
    type StructureElement,
    type StructureStaircase,
    type StructureStaircaseLanding,
    type StructureWall
} from "./structureTypes";
import {
    applyStructureElementPlacement,
    removeStructureElement,
    type StructureElementAction,
    type StructureElementKind
} from "./structureElementActions";
import {
    applyStaircasePlacement,
    createStaircaseFootprintPreview,
    moveStaircaseLanding,
    removeStaircase,
    resolveStaircaseDestinationFloorId,
    updateStaircaseDimensions,
    validateStaircaseFootprint,
    validateStaircasePlacement,
    type StaircaseCandidate,
    type StaircaseDrawingPhase,
    type StaircaseFootprintPreview,
    type StaircasePlacementAction
} from "./staircaseActions";
import {
    createGroupedStructureHistoryEntry,
    redoStructureHistory,
    undoStructureHistory,
    type StructureHistoryEntry
} from "./staircaseHistory";
import {
    calculateStaircaseDimensionsForFootprint,
    getStaircaseFootprintRun,
    getStaircaseFootprint,
    validateStaircaseDimensions
} from "../../../../shared/staircaseGeometry.ts";
import type {
    ProceduralStaircaseData,
    StaircaseShape,
    StaircaseTurnDirection,
    StaircaseLandingData
} from "../../../../shared/staircaseGeometry";
import "./AdminStructuralEditor.css";

type Point = { x: number; y: number };
type CalibrationStep = "idle" | "first-point" | "second-point" | "enter-measurement";
type SelectedStructureElement = {
    kind: StructureElementKind | "staircase" | "landing";
    id: string;
};
type ActiveElementPlacement = {
    kind: StructureElementKind;
    action: StructureElementAction;
    source: StructureElement;
};
type ActiveStaircasePlacement =
    | { kind: "staircase"; action: Exclude<StaircasePlacementAction, "place">; source: StructureStaircase }
    | { kind: "landing"; source: StructureStaircaseLanding };
type BlueprintSession = {
    url: string | null;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
    position: { x: number; z: number };
    rotation: number;
    calibrationPoints: Point[];
    calibrationLineEnd: Point | null;
    calibrationStep: CalibrationStep;
    measuredLength: number | null;
    actualLength: string;
    width: number;
    aspectRatio: number;
};
type PendingEditorExit =
    | { kind: "navigate"; destination: string }
    | { kind: "history"; delta: number };

const WORLD_SIZE = 20;
const CENTER = WORLD_SIZE / 2;
const DEFAULT_DOOR_DIMENSIONS = { width: 0.9, height: 2.1 };
const DEFAULT_WINDOW_DIMENSIONS = { width: 1.2, height: 1.4 };
const EMPTY_BLUEPRINT_SESSION: BlueprintSession = {
    url: null,
    name: "",
    visible: true,
    locked: false,
    opacity: 0.45,
    position: { x: 0, z: 0 },
    rotation: 0,
    calibrationPoints: [],
    calibrationLineEnd: null,
    calibrationStep: "idle",
    measuredLength: null,
    actualLength: "",
    width: 10,
    aspectRatio: 1
};

function validPositiveNumber(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function scenePointToWorldPoint(scenePoint: { x: number; z: number }): Point3 {
    const converted = svgPointToWorld({
        x: scenePoint.x + CENTER,
        y: scenePoint.z + CENTER
    }, WORLD_SIZE);
    return { x: converted.x, y: 0, z: converted.y };
}

function findStructureCorner(
    structure: ManagedStructure,
    cornerId: string
): StructureCorner | null {
    const corner = structure.corners.find(item => item.id === cornerId);
    if (corner) return corner;
    for (const wall of structure.walls) {
        for (const endpoint of [wall.start, wall.end]) {
            if (endpoint.id === cornerId) return endpoint;
        }
    }
    return null;
}

function snapWorldPoint(
    point: Point3,
    structure: ManagedStructure,
    snapCornerId: string | null = null,
    preferStructuralEndpoint = false
): Point3 {
    if (snapCornerId) {
        const snappedCorner = findStructureCorner(structure, snapCornerId);
        if (snappedCorner) return { ...snappedCorner.position };
    }
    if (preferStructuralEndpoint) {
        const nearestEndpoint = findNearestWallEndpoint(point, structure.corners, structure.walls);
        if (nearestEndpoint) return { ...nearestEndpoint.position };
    }

    let snapped = snapToGrid(point, structure.gridSize);
    snapped = snapToWallEndpoint(snapped, structure.walls);
    return snapToCorner(snapped, structure.corners);
}

function getManagedFloorRegions(structure: ManagedStructure) {
    const corners: Corner[] = structure.corners.map(corner => ({
        id: corner.id,
        position: new Vector3(corner.position.x, corner.position.y, corner.position.z)
    }));
    const walls: Wall[] = structure.walls.map(wall => ({
        id: wall.id,
        start: {
            id: wall.start.id,
            position: new Vector3(wall.start.position.x, wall.start.position.y, wall.start.position.z)
        },
        end: {
            id: wall.end.id,
            position: new Vector3(wall.end.position.x, wall.end.position.y, wall.end.position.z)
        }
    }));
    return solveRegions(corners, walls).filter(region =>
        region.corners.length >= 3 && Math.abs(region.area || 0) > 0.01
    );
}

const DEADLINE_PRESETS = [7, 30, 60] as const;

function getEditorDeadlineDateAfterDays(days: number): string {
    const [year, month, day] = getTodayLocalDate().split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
}

function normalizeEditorDeadline(value: string | null | undefined): string {
    const normalized = normalizeProjectDeadlineForInput(value);
    return normalized ? `${normalized.slice(0, 10)}T23:59` : "";
}

function formatEditorDeadline(value: string): string {
    const date = value.slice(0, 10);
    const timestamp = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(timestamp.getTime())) return date;
    return new Intl.DateTimeFormat("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    }).format(timestamp);
}

export default function AdminStructuralEditor() {
    const { projectId, draftId } = useParams();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const ownerName = typeof (location.state as { ownerName?: unknown } | null)?.ownerName === "string"
        ? (location.state as { ownerName: string }).ownerName
        : null;
    const [clientDisplayName, setClientDisplayName] = useState(ownerName ?? "");
    const [creatorDisplayName, setCreatorDisplayName] = useState("");
    const showInitializationLoading = !projectId ||
        (location.state as { showInitializationLoading?: unknown } | null)?.showInitializationLoading === true;
    const focusProjectName =
        (location.state as { focusProjectName?: unknown } | null)?.focusProjectName === true;
    const projectNameInputRef = useRef<HTMLInputElement>(null);
    const [initializationState, setInitializationState] = useState<"loading" | "ready" | "error">(
        showInitializationLoading ? "loading" : "ready"
    );
    const [isDraftRecord, setIsDraftRecord] = useState(Boolean(draftId));
    const [isPublished, setIsPublished] = useState(false);
    const [deadline, setDeadline] = useState("");
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [floorPlans, setFloorPlans] = useState<ManagedEditorFloor[]>([]);
    const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
    const structure = floorPlans.find(floor => floor.floorId === activeFloorId)?.structure ?? null;
    useEffect(() => {
        if (focusProjectName && initializationState === "ready" && !isReadOnly) {
            projectNameInputRef.current?.focus();
            projectNameInputRef.current?.select();
        }
    }, [focusProjectName, initializationState, isReadOnly]);
    const [tool, setTool] = useState<AdminStructuralTool>("wall");
    const [pendingWallStart, setPendingWallStart] = useState<StructureCorner | null>(null);
    const [wallChainStart, setWallChainStart] = useState<StructureCorner | null>(null);
    const [previewWallEnd, setPreviewWallEnd] = useState<Point3 | null>(null);
    const [wallGuides, setWallGuides] = useState<{
        snapPosition: Point3 | null;
        closing: boolean;
        alignedX: number | null;
        alignedZ: number | null;
    } | null>(null);
    const [pendingRoomStart, setPendingRoomStart] = useState<{ x: number; z: number } | null>(null);
    const [previewRoomEnd, setPreviewRoomEnd] = useState<Point3 | null>(null);
    const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [selectedStructureElement, setSelectedStructureElement] = useState<SelectedStructureElement | null>(null);
    const [activeElementPlacement, setActiveElementPlacement] = useState<ActiveElementPlacement | null>(null);
    const [activeStaircasePlacement, setActiveStaircasePlacement] = useState<ActiveStaircasePlacement | null>(null);
    const [staircasePointer, setStaircasePointer] = useState<Point3 | null>(null);
    const [staircaseDrawingStart, setStaircaseDrawingStart] = useState<Point3 | null>(null);
    const [staircaseFootprintPreview, setStaircaseFootprintPreview] =
        useState<StaircaseFootprintPreview | null>(null);
    const staircaseCommitRef = useRef(false);
    const [staircaseDrawingPhase, setStaircaseDrawingPhase] =
        useState<StaircaseDrawingPhase>("idle");
    const [staircaseDrawingRegionId, setStaircaseDrawingRegionId] = useState<string | null>(null);
    const [staircasePointerValid, setStaircasePointerValid] = useState(false);
    const [staircaseDimensions, setStaircaseDimensions] = useState({
        width: 1,
        totalRise: 2.8,
        riserCount: 16,
        treadDepth: 0.28,
        treadThickness: 0.04,
        railings: true,
        shape: "straight" as StaircaseShape,
        turnDirection: "left" as StaircaseTurnDirection
    });
    const [movePreviewReady, setMovePreviewReady] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [doors, setDoors] = useState<Asset[]>([]);
    const [windows, setWindows] = useState<Asset[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(true);
    const [assetsError, setAssetsError] = useState("");
    const [placementWidth, setPlacementWidth] = useState(DEFAULT_DOOR_DIMENSIONS.width);
    const [placementHeight, setPlacementHeight] = useState(DEFAULT_DOOR_DIMENSIONS.height);
    const [placementWidthEdited, setPlacementWidthEdited] = useState(false);
    const [placementHeightEdited, setPlacementHeightEdited] = useState(false);
    const [assetModelBounds, setAssetModelBounds] = useState<Record<string, AdminElementModelBounds>>({});
    const [buildPointer, setBuildPointer] = useState<{ point: Point3; wallId: string | null } | null>(null);
    const [blueprintSessions, setBlueprintSessions] = useState<Record<string, BlueprintSession>>({});
    const blueprintSessionsRef = useRef(blueprintSessions);
    useEffect(() => {
        blueprintSessionsRef.current = blueprintSessions;
    }, [blueprintSessions]);
    const activeBlueprintSession = activeFloorId
        ? blueprintSessions[activeFloorId] ?? EMPTY_BLUEPRINT_SESSION
        : EMPTY_BLUEPRINT_SESSION;
    const {
        url: blueprintUrl,
        name: blueprintName,
        visible: blueprintVisible,
        locked: blueprintLocked,
        opacity: blueprintOpacity,
        position: blueprintPosition,
        rotation: blueprintRotation,
        calibrationPoints,
        calibrationLineEnd,
        calibrationStep,
        measuredLength: measuredBlueprintLength,
        actualLength: actualBlueprintLength,
        width: blueprintWidth,
        aspectRatio: blueprintAspectRatio
    } = activeBlueprintSession;
    const [revision, setRevision] = useState(1);
    const [projectName, setProjectName] = useState("Untitled floor plan");
    const [status, setStatus] = useState("");
    const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null);
    const [historyByFloor, setHistoryByFloor] = useState<Record<string, StructureHistoryEntry[]>>({});
    const [futureByFloor, setFutureByFloor] = useState<Record<string, StructureHistoryEntry[]>>({});
    const history = activeFloorId ? historyByFloor[activeFloorId] ?? [] : [];
    const future = activeFloorId ? futureByFloor[activeFloorId] ?? [] : [];
    const [isAddFloorDialogOpen, setIsAddFloorDialogOpen] = useState(false);
    const [floorToDeleteId, setFloorToDeleteId] = useState<string | null>(null);
    const [newFloorMode, setNewFloorMode] = useState<"blank" | "outline">("blank");
    const [isCreatingFloor, setIsCreatingFloor] = useState(false);
    const [deadlineOpen, setDeadlineOpen] = useState(false);
    const [exitGuardOpen, setExitGuardOpen] = useState(false);
    const [exitGuardSaving, setExitGuardSaving] = useState(false);
    const [exitGuardError, setExitGuardError] = useState("");
    const [pendingEditorExit, setPendingEditorExit] = useState<PendingEditorExit | null>(null);
    const savedEditorFingerprintRef = useRef<string | null>(null);
    const savedDeadlineRef = useRef("");
    const allowEditorExitRef = useRef(false);
    const navigationCreatedDraft =
        typeof (location.state as { newlyCreatedDraftId?: unknown } | null)?.newlyCreatedDraftId === "string" &&
        (location.state as { newlyCreatedDraftId: string }).newlyCreatedDraftId === draftId;
    const [newlyCreatedDraftIdState, setNewlyCreatedDraftIdState] = useState<string | null>(
        navigationCreatedDraft && draftId ? draftId : null
    );
    const isNewlyCreatedDraft = Boolean(draftId && newlyCreatedDraftIdState === draftId);
    const editorStateRef = useRef({
        floorPlans,
        activeFloorId,
        projectName,
        deadline,
        initializationState,
        isReadOnly
    });
    const locationRef = useRef(location);
    const routerHistoryStateRef = useRef(window.history.state);
    useEffect(() => {
        editorStateRef.current = {
            floorPlans,
            activeFloorId,
            projectName,
            deadline,
            initializationState,
            isReadOnly
        };
        locationRef.current = location;
        routerHistoryStateRef.current = window.history.state;
        allowEditorExitRef.current = false;
    }, [activeFloorId, deadline, floorPlans, initializationState, isReadOnly, location, projectName]);

    const getCurrentEditorFingerprint = useCallback(() => {
        const current = editorStateRef.current;
        if (
            current.initializationState !== "ready" ||
            current.isReadOnly ||
            current.floorPlans.length === 0
        ) {
            return null;
        }
        return createManagedEditorExitFingerprint({
            floors: current.floorPlans,
            activeFloorId: current.activeFloorId,
            projectName: current.projectName,
            deadline: current.deadline
        });
    }, []);
    const hasUnsavedChanges = useCallback(() => {
        const currentFingerprint = getCurrentEditorFingerprint();
        return currentFingerprint !== null &&
            savedEditorFingerprintRef.current !== null &&
            currentFingerprint !== savedEditorFingerprintRef.current;
    }, [getCurrentEditorFingerprint]);
    const updateActiveBlueprint = (updates: Partial<BlueprintSession>) => {
        if (!activeFloorId) return;
        setBlueprintSessions(current => ({
            ...current,
            [activeFloorId]: {
                ...EMPTY_BLUEPRINT_SESSION,
                ...current[activeFloorId],
                ...updates
            }
        }));
    };
    const setBlueprintUrl = (url: string | null) => updateActiveBlueprint({ url });
    const setBlueprintName = (name: string) => updateActiveBlueprint({ name });
    const setBlueprintVisible = (visible: boolean | ((current: boolean) => boolean)) =>
        updateActiveBlueprint({ visible: typeof visible === "function" ? visible(blueprintVisible) : visible });
    const setBlueprintLocked = (locked: boolean | ((current: boolean) => boolean)) =>
        updateActiveBlueprint({ locked: typeof locked === "function" ? locked(blueprintLocked) : locked });
    const setBlueprintOpacity = (opacity: number) => updateActiveBlueprint({ opacity });
    const setBlueprintPosition = (position: { x: number; z: number }) => updateActiveBlueprint({ position });
    const setBlueprintRotation = (rotation: number) => updateActiveBlueprint({ rotation });
    const setCalibrationPoints = (calibrationPoints: Point[]) => updateActiveBlueprint({ calibrationPoints });
    const setCalibrationLineEnd = (calibrationLineEnd: Point | null) =>
        updateActiveBlueprint({ calibrationLineEnd });
    const setCalibrationStep = (calibrationStep: CalibrationStep) => updateActiveBlueprint({ calibrationStep });
    const setMeasuredBlueprintLength = (measuredLength: number | null) =>
        updateActiveBlueprint({ measuredLength });
    const setActualBlueprintLength = (actualLength: string) => updateActiveBlueprint({ actualLength });
    const setBlueprintWidth = (width: number) => updateActiveBlueprint({ width });
    const setBlueprintAspectRatio = (aspectRatio: number) => updateActiveBlueprint({ aspectRatio });
    const setActiveFloorStructure = (next: ManagedStructure) => {
        if (isReadOnly || !activeFloorId) return;
        setFloorPlans(current => current.map(floor =>
            floor.floorId === activeFloorId ? { ...floor, structure: next } : floor
        ));
    };
    const resolvedDestinationFloorId = resolveStaircaseDestinationFloorId(
        floorPlans,
        activeFloorId
    );
    const [showWallMeasurements, setShowWallMeasurements] = useState(true);
    const handleAssetModelBounds = useCallback((assetId: string, bounds: AdminElementModelBounds) => {
        setAssetModelBounds(current => {
            const existing = current[assetId];
            if (
                existing?.width === bounds.width &&
                existing.height === bounds.height &&
                existing.depth === bounds.depth
            ) {
                return current;
            }
            return { ...current, [assetId]: bounds };
        });

        if (selectedAsset?.id !== assetId) return;
        if (!placementWidthEdited) setPlacementWidth(selectedAsset.width ?? bounds.width);
        if (!placementHeightEdited) setPlacementHeight(selectedAsset.height ?? bounds.height);
    }, [placementHeightEdited, placementWidthEdited, selectedAsset]);

    useEffect(() => () => {
        const urls = new Set(
            Object.values(blueprintSessionsRef.current)
                .map(session => session.url)
                .filter((url): url is string => Boolean(url?.startsWith("blob:")))
        );
        urls.forEach(url => URL.revokeObjectURL(url));
    }, []);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getDoorAssets(), getWindowAssets()])
            .then(([doorAssets, windowAssets]) => {
                if (cancelled) return;
                setDoors(doorAssets);
                setWindows(windowAssets);
            })
            .catch(error => {
                if (cancelled) return;
                setAssetsError(error instanceof Error ? error.message : "Unable to load door and window assets.");
            })
            .finally(() => {
                if (!cancelled) setAssetsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function loadManagedProject(nextProjectId: string) {
            const metadata = await getAdminProject(nextProjectId);
            if (!metadata.projectId.trim() || !metadata.ownerId.trim()) {
                throw new Error("Project metadata is missing its project ID or client owner UID.");
            }
            if (metadata.workflowType !== "admin-managed") {
                throw new Error("This is a legacy project. Open it in the project viewer instead.");
            }

            if (!metadata.hasDraftStructure && !metadata.hasPublishedStructure) {
                if (metadata.structureInitialized !== false) {
                    throw new Error(metadata.structuralStatus === "draft"
                        ? "This draft has no saved draft JSON. The published project was not loaded to avoid overwriting it."
                        : "This project has no saved draft or published JSON file.");
                }
                const firstFloor = createManagedEditorFloor(createManagedStructure(
                        metadata.projectId,
                        metadata.projectName,
                        metadata.ownerId
                    ), 0);
                return {
                    floors: [firstFloor],
                    activeFloorId: firstFloor.floorId,
                    projectName: metadata.projectName,
                    revision: metadata.structuralRevision ?? 0,
                    metadata
                };
            }

            const loadedData: unknown = await loadManagedProjectStructure(metadata.projectId, true);
            const validationErrors = validateStructuralProjectData(loadedData);
            if (validationErrors.length) {
                throw new Error(`Saved project JSON is invalid: ${validationErrors.join(" ")}`);
            }
            const loaded = loadedData as ManagedStructure;
            if (!loaded.projectId.trim() || !loaded.ownerId.trim()) {
                throw new Error("Saved project JSON is missing its project ID or client owner UID.");
            }
            if (loaded.projectId !== metadata.projectId) throw new Error("Project ID metadata does not match saved JSON.");
            if (loaded.ownerId !== metadata.ownerId) throw new Error("Project owner metadata does not match saved JSON.");
            return {
                ...loadManagedEditorFloors(loaded),
                projectName: metadata.projectName,
                revision: loaded.structuralRevision ?? metadata.structuralRevision ?? 1,
                metadata
            };
        }

        async function initialize() {
            savedEditorFingerprintRef.current = null;
            if (showInitializationLoading) setInitializationState("loading");
            if (projectId) {
                const initialized = await loadManagedProject(projectId);
                if (!cancelled) {
                    const savedDeadline = normalizeEditorDeadline(initialized.metadata.deadline);
                    savedDeadlineRef.current = savedDeadline;
                    savedEditorFingerprintRef.current = createManagedEditorExitFingerprint({
                        floors: initialized.floors,
                        activeFloorId: initialized.activeFloorId,
                        projectName: initialized.projectName,
                        deadline: savedDeadline
                    });
                    setFloorPlans(initialized.floors);
                    setActiveFloorId(initialized.activeFloorId);
                    setProjectName(initialized.projectName);
                    setRevision(initialized.revision);
                    setClientDisplayName(initialized.metadata.ownerName ?? ownerName ?? "");
                    setCreatorDisplayName(initialized.metadata.creatorName ?? "");
                    setIsDraftRecord(false);
                    setIsPublished(initialized.metadata.structuralStatus === "published");
                    setDeadline(savedDeadline);
                    setIsReadOnly(initialized.metadata.createdBy !== user?.uid);
                    if (initialized.metadata.createdBy !== user?.uid) {
                        setStatus("Read-only view. Only the administrator who created this floor plan can edit or publish it.");
                    }
                    setInitializationState("ready");
                }
            } else if (draftId) {
                const draft = await getManagedFloorPlanDraft(draftId);
                let projectData: unknown = draft.projectData;
                let restoredLocalDraft = false;
                if (!projectData) {
                    const savedDraft = loadLocalManagedProjectDraft(draft.intendedClientId);
                    if (savedDraft) {
                        projectData = {
                            ...savedDraft.structure,
                            projectId: draft.draftId,
                            projectName: draft.projectName,
                            ownerId: draft.intendedClientId
                        };
                        restoredLocalDraft = true;
                    }
                }
                let initializedFloors: ReturnType<typeof loadManagedEditorFloors> & {
                    projectName: string;
                    revision: number;
                };
                if (projectData) {
                    const validationErrors = validateStructuralProjectData(projectData);
                    if (validationErrors.length) {
                        throw new Error(`Saved draft JSON is invalid: ${validationErrors.join(" ")}`);
                    }
                    const loaded = projectData as ManagedStructure;
                    if (loaded.projectId !== draft.draftId || loaded.ownerId !== draft.intendedClientId) {
                        throw new Error("Saved draft IDs do not match the selected draft.");
                    }
                    initializedFloors = {
                        ...loadManagedEditorFloors(loaded),
                        projectName: draft.projectName,
                        revision: draft.structuralRevision || 0
                    };
                } else {
                    const firstFloor = createManagedEditorFloor(
                        createManagedStructure(draft.draftId, draft.projectName, draft.intendedClientId),
                        0
                    );
                    initializedFloors = {
                        floors: [firstFloor],
                        activeFloorId: firstFloor.floorId,
                        projectName: draft.projectName,
                        revision: 0
                    };
                }
                if (!cancelled) {
                    const savedDeadline = normalizeEditorDeadline(draft.deadline);
                    savedDeadlineRef.current = savedDeadline;
                    savedEditorFingerprintRef.current = createManagedEditorExitFingerprint({
                        floors: initializedFloors.floors,
                        activeFloorId: initializedFloors.activeFloorId,
                        projectName: initializedFloors.projectName,
                        deadline: savedDeadline
                    });
                    setFloorPlans(initializedFloors.floors);
                    setActiveFloorId(initializedFloors.activeFloorId);
                    setProjectName(initializedFloors.projectName);
                    setRevision(initializedFloors.revision);
                    setClientDisplayName(draft.intendedClientName ?? ownerName ?? "");
                    setCreatorDisplayName(draft.creatorName ?? "");
                    setIsDraftRecord(true);
                    setIsPublished(false);
                    setDeadline(savedDeadline);
                    setIsReadOnly(draft.createdBy !== user?.uid);
                    setStatus(draft.createdBy !== user?.uid
                        ? "Read-only view. Only the administrator who created this draft can edit or publish it."
                        : restoredLocalDraft
                            ? "Restored this browser's previous local draft. Save Draft to store it in the shared admin workspace."
                            : "Unpublished database draft. The client cannot access it until it is published.");
                    setInitializationState("ready");
                }
            } else {
                throw new Error("A saved draft or project must be selected.");
            }
        }
        initialize().catch(error => {
            if (!cancelled) {
                const message = error instanceof Error ? error.message.trim() : "";
                setInitializationState("error");
                setStatus(message
                    ? `Unable to initialize project: ${message}`
                    : "Unable to initialize project. Return to Projects and try again.");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [draftId, ownerName, projectId, showInitializationLoading, user?.uid]);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (allowEditorExitRef.current || !hasUnsavedChanges()) return;

            const currentHistoryState = routerHistoryStateRef.current as { idx?: unknown } | null;
            const destinationHistoryState = event.state as { idx?: unknown } | null;
            const currentIndex = typeof currentHistoryState?.idx === "number"
                ? currentHistoryState.idx
                : null;
            const destinationIndex = typeof destinationHistoryState?.idx === "number"
                ? destinationHistoryState.idx
                : null;
            const delta = currentIndex !== null && destinationIndex !== null &&
                destinationIndex > currentIndex
                ? 1
                : -1;
            const currentLocation = locationRef.current;
            const currentUrl = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;

            event.stopImmediatePropagation();
            window.history.pushState(routerHistoryStateRef.current, "", currentUrl);
            setPendingEditorExit({ kind: "history", delta });
            setExitGuardError("");
            setExitGuardOpen(true);
        };

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasUnsavedChanges()) return;
            event.preventDefault();
            event.returnValue = "";
        };

        const handleInternalLinkClick = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                !hasUnsavedChanges()
            ) {
                return;
            }
            if (!(event.target instanceof Element)) return;
            const link = event.target.closest("a");
            if (
                !link ||
                link.target === "_blank" ||
                link.hasAttribute("download")
            ) {
                return;
            }

            const destinationUrl = new URL(link.href, window.location.origin);
            if (destinationUrl.origin !== window.location.origin) return;
            const destination =
                `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
            const currentLocation = locationRef.current;
            const current =
                `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
            if (destination === current) return;

            event.preventDefault();
            event.stopPropagation();
            setPendingEditorExit({ kind: "navigate", destination });
            setExitGuardError("");
            setExitGuardOpen(true);
        };

        window.addEventListener("popstate", handlePopState, true);
        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("click", handleInternalLinkClick, true);

        return () => {
            window.removeEventListener("popstate", handlePopState, true);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("click", handleInternalLinkClick, true);
        };
    }, [hasUnsavedChanges, location.hash, location.pathname, location.search]);

    const structureCorners = structure?.corners;
    const structureWalls = structure?.walls;
    const geometry = useMemo(() => {
        if (!structureCorners || !structureWalls) {
            return { corners: [] as Corner[], walls: [] as Wall[], regions: [] };
        }
        const corners: Corner[] = structureCorners.map(corner => ({
            id: corner.id,
            position: new Vector3(corner.position.x, corner.position.y, corner.position.z)
        }));
        const walls: Wall[] = structureWalls.map(wall => ({
            id: wall.id,
            start: {
                id: wall.start.id,
                position: new Vector3(wall.start.position.x, wall.start.position.y, wall.start.position.z)
            },
            end: {
                id: wall.end.id,
                position: new Vector3(wall.end.position.x, wall.end.position.y, wall.end.position.z)
            }
        }));
        return { corners, walls, regions: solveRegions(corners, walls) };
    }, [structureCorners, structureWalls]);

    const selectedElement = structure && selectedStructureElement &&
        (selectedStructureElement.kind === "door" || selectedStructureElement.kind === "window")
        ? (selectedStructureElement.kind === "door" ? structure.doors : structure.windows)
            .find(element => element.id === selectedStructureElement.id) ?? null
        : null;
    const selectedStaircase = structure && selectedStructureElement?.kind === "staircase"
        ? structure.stairs.find(stair => stair.id === selectedStructureElement.id) ?? null
        : null;
    const selectedLanding = structure && selectedStructureElement?.kind === "landing"
        ? structure.stairLandings.find(landing => landing.id === selectedStructureElement.id) ?? null
        : null;
    const activeBuildAsset = structure?.layoutConfirmed && selectedAsset && tool === selectedAsset.type
        ? selectedAsset
        : null;
    const activeAssetBounds = activeBuildAsset ? assetModelBounds[activeBuildAsset.id] : undefined;
    const activeElementSource = activeElementPlacement && activeBuildAsset &&
        activeElementPlacement.kind === activeBuildAsset.type
        ? activeElementPlacement.source
        : null;
    const effectivePlacementWidth = activeElementSource
        ? activeElementSource.width
        : placementWidthEdited
        ? placementWidth
        : activeBuildAsset?.width ?? activeAssetBounds?.width ?? 0;
    const effectivePlacementHeight = activeElementSource
        ? activeElementSource.height
        : placementHeightEdited
        ? placementHeight
        : activeBuildAsset?.height ?? activeAssetBounds?.height ?? 0;
    const getBuildElementCandidate = (point: Point3, preferredWallId?: string | null) => {
        if (!structure || !activeBuildAsset) return null;
        return calculateBuildElementPlacement({
            structure,
            asset: activeBuildAsset,
            point,
            placementWidth: effectivePlacementWidth,
            placementHeight: effectivePlacementHeight,
            placementDepth: activeElementSource?.depth,
            modelBounds: activeAssetBounds,
            preferredWallId,
            excludeElementId: activeElementPlacement?.action === "move"
                ? activeElementSource?.id
                : null
        });
    };
    const buildElementPlacement: BuildElementPlacementCandidate | null = buildPointer
        ? getBuildElementCandidate(buildPointer.point, buildPointer.wallId ?? selectedWallId)
        : null;
    const staircaseDimensionsForPlacement = activeStaircasePlacement?.kind === "staircase"
        ? activeStaircasePlacement.source
        : staircaseFootprintPreview
            ? {
                ...calculateStaircaseDimensionsForFootprint(
                    staircaseFootprintPreview.length,
                    staircaseFootprintPreview.width,
                    structure?.wallHeight ?? staircaseDimensions.totalRise,
                    0.28,
                    0.175,
                    staircaseDimensions.riserCount
                ),
                width: staircaseFootprintPreview.width,
                totalRise: structure?.wallHeight ?? staircaseDimensions.totalRise,
                treadThickness: staircaseDimensions.treadThickness,
                railings: staircaseDimensions.railings,
                shape: staircaseDimensions.shape,
                turnDirection: staircaseDimensions.turnDirection
            }
            : {
                ...staircaseDimensions,
                totalRise: structure?.wallHeight ?? staircaseDimensions.totalRise
            };
    const staircaseDestinationForPlacement = activeStaircasePlacement?.kind === "staircase"
        ? activeStaircasePlacement.source.destinationFloorId
        : resolvedDestinationFloorId;
    const staircaseRotationForPlacement = activeStaircasePlacement?.kind === "staircase"
        ? activeStaircasePlacement.source.rotationY
        : staircaseFootprintPreview?.candidate.rotationY ?? 0;
    const stairCandidate: StaircaseCandidate | null = staircaseFootprintPreview &&
        activeStaircasePlacement === null
        ? staircaseFootprintPreview.candidate
        : staircasePointer &&
            (activeStaircasePlacement !== null || staircaseFootprintPreview !== null)
        ? {
            position: staircasePointer,
            rotationY: activeStaircasePlacement?.kind === "landing"
                ? activeStaircasePlacement.source.rotationY
                : staircaseRotationForPlacement
        }
        : null;
    const destinationFloor = floorPlans.find(floor =>
        floor.floorId === staircaseDestinationForPlacement
    );
    const staircaseDimensionsError = validateStaircaseDimensions(staircaseDimensionsForPlacement);
    const staircaseFootprintError = structure && stairCandidate &&
        activeStaircasePlacement?.kind !== "landing"
        ? staircaseDimensionsError ?? validateStaircasePlacement({
                    candidate: stairCandidate,
                    dimensions: staircaseDimensionsForPlacement,
                    activeFloorId: activeFloorId ?? "",
                    destinationFloorId: staircaseDestinationForPlacement,
                    floors: floorPlans,
                    sourceStructure: structure,
                    sourceRegions: geometry.regions,
                    destinationFloor,
                    destinationRegions: destinationFloor
                        ? getManagedFloorRegions(destinationFloor.structure)
                        : [],
                    pointerValid: staircasePointerValid,
                    regionId: staircaseDrawingRegionId,
                    excludedStairId: activeStaircasePlacement?.kind === "staircase"
                        ? activeStaircasePlacement.source.id
                        : undefined
                })
        : null;
    const landingPlacementError = activeStaircasePlacement?.kind === "landing" && stairCandidate
        ? (() => {
            const sourceFloor = floorPlans.find(floor =>
                floor.structure.stairs.some(stair =>
                    stair.stairConnectionId === activeStaircasePlacement.source.stairConnectionId
                )
            );
            const source = sourceFloor?.structure.stairs.find(stair =>
                stair.stairConnectionId === activeStaircasePlacement.source.stairConnectionId
            );
            return source
                ? validateStaircaseFootprint({
                    ...source,
                    position: stairCandidate.position,
                    rotationY: stairCandidate.rotationY
                }, structure?.walls ?? [], geometry.regions, source.id, structure?.stairs ?? [])
                : "The connected staircase no longer exists.";
        })()
        : null;
    const staircasePlacementError = !stairCandidate
        ? null
        : !staircasePointerValid
        ? "Point to an actual room floor to position the staircase."
        : activeStaircasePlacement?.kind === "landing"
            ? landingPlacementError
            : staircaseFootprintError;
    const staircasePreview: {
        stair: ProceduralStaircaseData;
        valid: boolean;
        validationMessage: string | null;
    } | null =
        structure && stairCandidate &&         activeStaircasePlacement?.kind !== "landing" &&
        (tool === "staircase" || activeStaircasePlacement?.kind === "staircase")
            ? {
                stair: {
                    id: activeStaircasePlacement?.kind === "staircase"
                        ? activeStaircasePlacement.source.id
                        : "staircase-preview",
                    position: stairCandidate.position,
                    rotationY: stairCandidate.rotationY,
                    ...staircaseDimensionsForPlacement,
                    shape: staircaseDimensionsForPlacement.shape ?? "straight",
                    turnDirection: staircaseDimensionsForPlacement.turnDirection
                },
                valid: !staircasePlacementError,
                validationMessage: staircasePlacementError
            }
            : null;
    const activeFloorIndex = floorPlans.findIndex(floor => floor.floorId === activeFloorId);
    const staircasePanelMessage = tool !== "staircase"
        ? null
        : !resolvedDestinationFloorId
            ? `Create the ${getFloorName(activeFloorIndex + 1)} before placing stairs.`
            : staircasePlacementError;
    const staircaseFootprint = structure && stairCandidate &&
        activeStaircasePlacement?.kind !== "landing"
        ? {
            corners: getStaircaseFootprint(
                stairCandidate.position,
                staircaseDimensionsForPlacement.width,
                staircaseFootprintPreview?.length ??
                    (                    getStaircaseFootprintRun(staircaseDimensionsForPlacement)),
                stairCandidate.rotationY
            ),
            valid: !staircasePlacementError
        }
        : null;
    const landingPreview: { landing: StaircaseLandingData } | null =
        activeStaircasePlacement?.kind === "landing" && stairCandidate
            ? {
                landing: {
                    ...activeStaircasePlacement.source,
                    position: stairCandidate.position,
                    rotationY: stairCandidate.rotationY
                }
            }
            : null;
    const wallPreview: StructureWall | null =
        structure &&
        (!blueprintUrl || blueprintLocked) &&
        !structure.layoutConfirmed &&
        tool === "wall" &&
        calibrationStep === "idle" &&
        pendingWallStart &&
        previewWallEnd
            ? {
                id: "temporary-wall-preview",
                start: pendingWallStart,
                end: {
                    id: "temporary-wall-preview-end",
                    position: previewWallEnd
                }
            }
            : null;
    const roomPreview =
        structure &&
        (!blueprintUrl || blueprintLocked) &&
        !structure.layoutConfirmed &&
        tool === "room" &&
        calibrationStep === "idle" &&
        pendingRoomStart &&
        previewRoomEnd
            ? getRoomPreviewGeometry(
                { x: pendingRoomStart.x, y: 0, z: pendingRoomStart.z },
                previewRoomEnd
            )
            : null;

    const commit = (next: ManagedStructure) => {
        if (isReadOnly || !structure || !activeFloorId) return;
        setHistoryByFloor(current => ({
            ...current,
            [activeFloorId]: [...(current[activeFloorId] ?? []).slice(-49), { structure }]
        }));
        setFutureByFloor(current => ({ ...current, [activeFloorId]: [] }));
        setActiveFloorStructure(next);
    };

    const commitFloors = (nextFloors: ManagedEditorFloor[], touchedFloorIds: string[]) => {
        if (isReadOnly) return;
        const entry = createGroupedStructureHistoryEntry(
            floorPlans,
            nextFloors,
            touchedFloorIds,
            crypto.randomUUID()
        );
        setHistoryByFloor(current => {
            const next = { ...current };
            for (const floorId of touchedFloorIds) {
                next[floorId] = [...(current[floorId] ?? []).slice(-49), entry];
            }
            return next;
        });
        setFutureByFloor(current => {
            const next = { ...current };
            for (const floorId of touchedFloorIds) next[floorId] = [];
            return next;
        });
        setFloorPlans(nextFloors);
    };

    const undo = () => {
        if (isReadOnly || !structure || !activeFloorId) return;
        const transition = undoStructureHistory(
            floorPlans,
            historyByFloor,
            futureByFloor,
            activeFloorId
        );
        if (!transition) return;
        if (transition.error) {
            setStatus(transition.error);
            return;
        }
        setFloorPlans(transition.floors);
        setHistoryByFloor(transition.historyByFloor);
        setFutureByFloor(transition.futureByFloor);
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setSelectedWallId(null);
        setSelectedRegionId(null);
        setSelectedStructureElement(null);
        setActiveElementPlacement(null);
        setActiveStaircasePlacement(null);
        setStaircasePointer(null);
        setStaircaseDrawingStart(null);
        setStaircaseDrawingRegionId(null);
        setStaircaseFootprintPreview(null);
        setStaircasePointerValid(false);
        setStaircaseDrawingPhase("cancelled");
        setStaircasePointerValid(false);
        setStaircaseDrawingRegionId(null);
        setStaircaseDrawingPhase("cancelled");
        setBuildPointer(null);
    };

    const redo = () => {
        if (isReadOnly || !structure || !activeFloorId) return;
        const transition = redoStructureHistory(
            floorPlans,
            historyByFloor,
            futureByFloor,
            activeFloorId
        );
        if (!transition) return;
        if (transition.error) {
            setStatus(transition.error);
            return;
        }
        setFloorPlans(transition.floors);
        setHistoryByFloor(transition.historyByFloor);
        setFutureByFloor(transition.futureByFloor);
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setSelectedWallId(null);
        setSelectedRegionId(null);
        setSelectedStructureElement(null);
        setActiveElementPlacement(null);
        setActiveStaircasePlacement(null);
        setStaircasePointer(null);
        setBuildPointer(null);
    };

    const beginElementPlacement = (action: StructureElementAction) => {
        if (!structure || !selectedElement || !selectedStructureElement) return;
        if (selectedStructureElement.kind !== "door" && selectedStructureElement.kind !== "window") return;
        const elementAssets = selectedStructureElement.kind === "door" ? doors : windows;
        const asset = elementAssets.find(item => item.id === selectedElement.assetId);
        if (!asset) {
            setStatus(`Unable to ${action} ${selectedStructureElement.kind}: its asset is unavailable.`);
            return;
        }

        setActiveElementPlacement({
            kind: selectedStructureElement.kind,
            action,
            source: selectedElement
        });
        setMovePreviewReady(false);
        setSelectedAsset(asset);
        setSelectedWallId(null);
        setSelectedRegionId(null);
        setTool(selectedStructureElement.kind);
        setBuildPointer(null);
        setStatus(action === "move"
            ? `Move the ${selectedStructureElement.kind} to a valid wall position.`
            : `Choose a valid wall position for the duplicated ${selectedStructureElement.kind}.`);
    };

    const removeSelectedElement = () => {
        if (!structure || !selectedStructureElement) return;
        if (selectedStructureElement.kind === "staircase") {
            if (!activeFloorId) return;
            const nextFloors = removeStaircase(
                floorPlans,
                activeFloorId,
                selectedStructureElement.id
            );
            if (!nextFloors) return;
            const stair = structure.stairs.find(item => item.id === selectedStructureElement.id);
            commitFloors(
                nextFloors,
                [activeFloorId, ...(stair ? [stair.destinationFloorId] : [])]
            );
            setSelectedStructureElement(null);
            setTool("select");
            setStatus("Staircase and its linked destination landing removed.");
            return;
        }
        if (selectedStructureElement.kind === "landing") return;
        const next = removeStructureElement(
            structure,
            selectedStructureElement.kind,
            selectedStructureElement.id
        );
        if (!next) return;
        commit(next);
        setSelectedStructureElement(null);
        setActiveElementPlacement(null);
        setMovePreviewReady(false);
        setSelectedAsset(null);
        setBuildPointer(null);
        setTool("select");
        setStatus(`${selectedStructureElement.kind === "door" ? "Door" : "Window"} removed.`);
    };

    const selectStaircase = (id: string) => {
        if (tool !== "select" || calibrationStep !== "idle" || !structure) return;
        const stair = structure.stairs.find(item => item.id === id);
        if (!stair) return;
        setSelectedStructureElement({ kind: "staircase", id });
        setStaircaseDimensions({
            width: stair.width,
            totalRise: stair.totalRise,
            riserCount: stair.riserCount,
            treadDepth: stair.treadDepth,
            treadThickness: stair.treadThickness ?? 0.04,
            railings: stair.railings !== false,
            shape: stair.shape,
            turnDirection: stair.turnDirection ?? "left"
        });
        setSelectedWallId(null);
        setSelectedRegionId(null);
    };

    const selectStaircaseLanding = (id: string) => {
        if (tool !== "select" || calibrationStep !== "idle" || !structure) return;
        const landing = structure.stairLandings.find(item => item.id === id);
        if (!landing) return;
        setSelectedStructureElement({ kind: "landing", id });
        setSelectedWallId(null);
        setSelectedRegionId(null);
    };

    const beginSelectedPlacement = (action: StructureElementAction) => {
        if (!selectedStructureElement) return;
        if (selectedStructureElement.kind === "door" || selectedStructureElement.kind === "window") {
            beginElementPlacement(action);
            return;
        }
        if (selectedStructureElement.kind === "staircase" && selectedStaircase) {
            staircaseCommitRef.current = false;
            setActiveStaircasePlacement({
                kind: "staircase",
                action,
                source: selectedStaircase
            });
            setStaircasePointer(null);
            setStaircaseFootprintPreview(null);
            setSelectedStructureElement(null);
            setTool("staircase");
            setStaircaseDrawingPhase("sizing-footprint");
            setStaircasePointerValid(false);
            setSelectedWallId(null);
            setSelectedRegionId(null);
            setStatus(action === "move"
                ? "Move the staircase to a clear floor position."
                : "Move the duplicate preview to a clear floor position, then confirm it.");
            return;
        }
        if (selectedStructureElement.kind === "landing" && selectedLanding) {
            staircaseCommitRef.current = false;
            setActiveStaircasePlacement({ kind: "landing", source: selectedLanding });
            setStaircasePointer(null);
            setStaircaseFootprintPreview(null);
            setSelectedStructureElement(null);
            setTool("staircase");
            setStaircaseDrawingPhase("sizing-footprint");
            setStaircasePointerValid(false);
            setSelectedWallId(null);
            setSelectedRegionId(null);
            setStatus("Move the stair arrival marker to its position on this floor.");
        }
    };

    const updateStaircaseDimension = (
        key: "width" | "totalRise" | "riserCount" | "treadDepth" | "treadThickness",
        value: number
    ) => {
        if (!Number.isFinite(value)) return;
        const currentRun = staircaseFootprintPreview?.length ??
            (selectedStaircase
                ? getStaircaseFootprintRun(selectedStaircase)
                : null);
        const dimensions = {
            ...staircaseDimensions,
            totalRise: structure?.wallHeight ?? staircaseDimensions.totalRise,
            [key]: value
        };
        if (currentRun !== null && key === "totalRise") {
            const calculated = calculateStaircaseDimensionsForFootprint(
                currentRun,
                dimensions.width,
                value
            );
            dimensions.riserCount = calculated.riserCount;
            dimensions.treadDepth = calculated.treadDepth;
        } else if (currentRun !== null && key === "riserCount") {
            if (!Number.isInteger(value) || value < 2) {
                setStatus("Riser count must be a whole number between 2 and 80.");
                return;
            }
            dimensions.treadDepth = currentRun / (value - 1);
        } else if (currentRun !== null && key === "treadDepth") {
            const treadCount = Math.max(1, Math.round(currentRun / value));
            dimensions.riserCount = treadCount + 1;
            dimensions.treadDepth = currentRun / treadCount;
        }
        const dimensionError = validateStaircaseDimensions(dimensions);
        if (dimensionError) {
            setStatus(dimensionError);
            return;
        }
        if (!selectedStaircase || !activeFloorId) {
            setStaircaseDimensions(dimensions);
            setStatus("");
            return;
        }
        const sourceFloor = floorPlans.find(floor => floor.floorId === selectedStaircase.floorId);
        const destinationFloor = floorPlans.find(floor => floor.floorId === selectedStaircase.destinationFloorId);
        if (!sourceFloor || !destinationFloor) {
            setStatus("Unable to edit staircase: its connected floor is missing.");
            return;
        }
        const updated = updateStaircaseDimensions(
            sourceFloor.structure,
            selectedStaircase,
            dimensions
        );
        const footprintError = validateStaircaseFootprint({
            ...selectedStaircase,
            ...dimensions
        }, sourceFloor.structure.walls, geometry.regions, selectedStaircase.id, sourceFloor.structure.stairs);
        if (!updated || footprintError) {
            setStatus("These dimensions create an invalid staircase footprint.");
            return;
        }
        const run = getStaircaseFootprintRun(dimensions);
        const nextFloors = floorPlans.map(floor => {
            if (floor.floorId === selectedStaircase.floorId) {
                return { ...floor, structure: updated };
            }
            if (floor.floorId === selectedStaircase.destinationFloorId) {
                return {
                    ...floor,
                    structure: {
                        ...floor.structure,
                        stairLandings: floor.structure.stairLandings.map(landing =>
                            landing.stairConnectionId === selectedStaircase.stairConnectionId
                                ? { ...landing, width: dimensions.width, run }
                                : landing
                        )
                    }
                };
            }
            return floor;
        });
        commitFloors(nextFloors, [selectedStaircase.floorId, selectedStaircase.destinationFloorId]);
        setStaircaseDimensions(dimensions);
        setStatus("");
    };

    const updateStaircaseRailings = (enabled: boolean) => {
        const dimensions = { ...staircaseDimensions, railings: enabled };
        setStaircaseDimensions(dimensions);
        if (!selectedStaircase) return;
        const sourceFloor = floorPlans.find(floor => floor.floorId === selectedStaircase.floorId);
        if (!sourceFloor) {
            setStatus("Unable to edit staircase: its floor is missing.");
            return;
        }
        const nextFloors = floorPlans.map(floor =>
            floor.floorId === selectedStaircase.floorId
                ? {
                    ...floor,
                    structure: {
                        ...floor.structure,
                        stairs: floor.structure.stairs.map(stair =>
                            stair.id === selectedStaircase.id
                                ? { ...stair, railings: enabled }
                                : stair
                        )
                    }
                }
                : floor
        );
        commitFloors(nextFloors, [selectedStaircase.floorId]);
        setStatus("");
    };

    const updateStaircaseStepCount = (count: number) => {
        if (!Number.isInteger(count) || count < 2 || count > 80) {
            setStatus("Number of steps must be a whole number between 2 and 80.");
            return;
        }
        updateStaircaseDimension("riserCount", count);
    };

    const updateStaircaseShape = (shape: StaircaseShape) => {
        setStaircaseDimensions(current => ({ ...current, shape }));
        setStatus("");
    };

    const updateStaircaseTurnDirection = (turnDirection: StaircaseTurnDirection) => {
        setStaircaseDimensions(current => ({ ...current, turnDirection }));
        setStatus("");
    };

    const selectStructureElement = (kind: StructureElementKind, id: string) => {
        if (tool !== "select" || calibrationStep !== "idle") return;
        setSelectedStructureElement({ kind, id });
        setSelectedWallId(null);
        setSelectedRegionId(null);
    };

    const handleBuildElementPreviewReady = useCallback(() => {
        if (activeElementPlacement?.action === "move") {
            setMovePreviewReady(true);
        }
    }, [activeElementPlacement?.action]);

    const recordCalibrationPoint = (point: Point) => {
        if (calibrationStep === "idle") return false;
        if (blueprintLocked) {
            setStatus("Unlock the blueprint before calibrating it.");
            return true;
        }
        if (!blueprintVisible) {
            setStatus("Show the blueprint before selecting calibration points.");
            return true;
        }
        const bounds = blueprintDisplayBounds(blueprintWidth, blueprintAspectRatio);
        const localPoint = {
            x: point.x - blueprintPosition.x,
            y: point.y - blueprintPosition.z
        };
        const cosine = Math.cos(blueprintRotation);
        const sine = Math.sin(blueprintRotation);
        const blueprintLocalPoint = {
            x: localPoint.x * cosine - localPoint.y * sine,
            y: -localPoint.x * sine - localPoint.y * cosine
        };
        if (
            blueprintLocalPoint.x < bounds.x ||
            blueprintLocalPoint.x > bounds.x + bounds.width ||
            blueprintLocalPoint.y < bounds.y ||
            blueprintLocalPoint.y > bounds.y + bounds.height
        ) {
            setStatus("Choose calibration points on the visible blueprint.");
            return true;
        }
        if (calibrationStep === "first-point") {
            setCalibrationPoints([point]);
            setCalibrationLineEnd(point);
            setCalibrationStep("second-point");
            setStatus("First calibration point selected. Choose the second point.");
            return true;
        }
        if (calibrationStep === "second-point") {
            const firstPoint = calibrationPoints[0];
            if (!firstPoint) return true;
            const points = [...calibrationPoints, point];
            const measured = distanceBetween2D(firstPoint, point);
            if (measured <= 0) {
                setStatus("Choose two different blueprint points.");
                return true;
            }
            setCalibrationPoints(points);
            setCalibrationLineEnd(null);
            setMeasuredBlueprintLength(measured);
            setCalibrationStep("enter-measurement");
            setStatus("Enter the real-world distance between the selected points.");
            return true;
        }
        return true;
    };

    const addWallSegment = (point: { x: number; z: number }) => {
        if (!structure || structure.layoutConfirmed) return;
        const endpointCorners = structure.walls.flatMap(wall => [wall.start, wall.end]);
        const existingCorners = [...structure.corners, ...endpointCorners];
        if (pendingWallStart && !existingCorners.some(corner => corner.id === pendingWallStart.id)) {
            existingCorners.push(pendingWallStart);
        }
        const found = findOrCreateCorner({ x: point.x, y: 0, z: point.z }, existingCorners);
        if (!pendingWallStart) {
            setPendingWallStart(found.corner);
            setWallChainStart(found.corner);
            return;
        }
        if (pendingWallStart.id === found.corner.id) return;
        commit(addWallSegmentToStructure(
            { ...structure, corners: found.corners },
            pendingWallStart,
            found.corner
        ));
        setPreviewWallEnd(null);
        if (found.corner.id === wallChainStart?.id) {
            setPendingWallStart(null);
            setWallChainStart(null);
            setWallGuides(null);
            setStatus("Closed wall boundary created; the enclosed floor region is ready.");
            return;
        }
        setPendingWallStart(found.corner);
        setWallGuides(null);
    };

    const addRoomRectangle = (point: { x: number; z: number }) => {
        if (!structure || structure.layoutConfirmed) return;
        if (!pendingRoomStart) {
            setPendingRoomStart(point);
            setPreviewRoomEnd({ x: point.x, y: 0, z: point.z });
            setStatus("Choose the opposite corner of the room in the scene.");
            return;
        }

        const minX = Math.min(pendingRoomStart.x, point.x);
        const maxX = Math.max(pendingRoomStart.x, point.x);
        const minZ = Math.min(pendingRoomStart.z, point.z);
        const maxZ = Math.max(pendingRoomStart.z, point.z);
        if (maxX - minX < structure.gridSize || maxZ - minZ < structure.gridSize) {
            setStatus("Choose opposite room corners at least one grid step apart.");
            return;
        }

        const roomPolygon: Point3[] = [
            { x: minX, y: 0, z: minZ },
            { x: maxX, y: 0, z: minZ },
            { x: maxX, y: 0, z: maxZ },
            { x: minX, y: 0, z: maxZ }
        ];
        const overlapsExistingRoom = geometry.regions.some(region =>
            hasPartialPolygonOverlap(
                roomPolygon,
                region.corners.map(corner => ({ x: corner.x, y: corner.y, z: corner.z }))
            )
        );
        if (overlapsExistingRoom) {
            setStatus("This room overlaps an existing room. Draw adjoining rooms or fully nested rooms instead.");
            return;
        }

        let roomStructure = structure;
        const roomCorners: StructureCorner[] = [];
        for (const position of [
            { x: minX, y: 0, z: minZ },
            { x: maxX, y: 0, z: minZ },
            { x: maxX, y: 0, z: maxZ },
            { x: minX, y: 0, z: maxZ }
        ]) {
            const found = findOrCreateCorner(position, roomStructure.corners);
            roomStructure = { ...roomStructure, corners: found.corners };
            roomCorners.push(found.corner);
        }
        for (let index = 0; index < roomCorners.length; index += 1) {
            roomStructure = addWallSegmentToStructure(
                roomStructure,
                roomCorners[index],
                roomCorners[(index + 1) % roomCorners.length]
            );
        }
        commit(roomStructure);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setWallGuides(null);
        setStatus("Room created from the selected opposite corners.");
    };

    const placeBuildAsset = (wallId: string | null, point: { x: number; y: number; z: number }) => {
        if (!structure || !selectedAsset) {
            setStatus("Select an asset before placing it.");
            return;
        }
        if (!structure.layoutConfirmed) {
            setStatus("Confirm the layout before placing doors, windows, or openings.");
            return;
        }
        if (!wallId) {
            setStatus("Click a wall to place the selected asset.");
            return;
        }
        const candidate = getBuildElementCandidate(
            point,
            wallId
        );
        setBuildPointer(null);
        if (!candidate) {
            setStatus("Click directly on a valid wall to place the selected asset.");
            return;
        }
        if (!candidate.valid) {
            setStatus(candidate.reason);
            return;
        }

        if (selectedAsset.type === "opening") {
            commit({
                ...structure,
                openings: [...structure.openings, {
                    id: crypto.randomUUID(),
                    wallId: candidate.wallId,
                    position: candidate.position,
                    rotationY: candidate.rotationY,
                    width: candidate.width,
                    height: candidate.height,
                    depth: candidate.depth,
                    shape: candidate.shape ?? "rectangle",
                    archRise: candidate.archRise
                }]
            });
            setTool("select");
            setBuildPointer(null);
            setStatus("Opening placed.");
            return;
        }

        if (selectedAsset.type !== "door" && selectedAsset.type !== "window") {
            setStatus("This asset type cannot be placed on a wall.");
            return;
        }
        if (activeElementPlacement) {
            const next = applyStructureElementPlacement(
                structure,
                activeElementPlacement.kind,
                activeElementPlacement.source,
                activeElementPlacement.action,
                candidate,
                crypto.randomUUID()
            );
            if (!next) {
                setStatus("This placement is no longer valid. Choose another wall position.");
                return;
            }
            const placedId = activeElementPlacement.action === "move"
                ? activeElementPlacement.source.id
                : next[activeElementPlacement.kind === "door" ? "doors" : "windows"].at(-1)?.id;
            commit(next);
            setSelectedStructureElement(placedId
                ? { kind: activeElementPlacement.kind, id: placedId }
                : null);
            setActiveElementPlacement(null);
            setSelectedAsset(null);
            setTool("select");
            setBuildPointer(null);
            setStatus(activeElementPlacement.action === "move"
                ? `${activeElementPlacement.kind === "door" ? "Door" : "Window"} moved.`
                : `${activeElementPlacement.kind === "door" ? "Door" : "Window"} duplicated.`);
            return;
        }
        const element = {
            id: crypto.randomUUID(),
            assetId: selectedAsset.id,
            wallId: candidate.wallId,
            position: candidate.position,
            rotationY: candidate.rotationY,
            width: candidate.width,
            height: candidate.height,
            wallWidth: candidate.wallWidth,
            depth: candidate.depth
        };
        commit(selectedAsset.type === "door"
            ? { ...structure, doors: [...structure.doors, element] }
            : { ...structure, windows: [...structure.windows, element] });
        setTool("select");
        setBuildPointer(null);
        setStatus(`${selectedAsset.type === "door" ? "Door" : "Window"} placed.`);
    };

    const placeStaircase = (
        candidate: StaircaseCandidate,
        dimensions = staircaseDimensionsForPlacement,
        pointerValid = staircasePointerValid,
        regionId = staircaseDrawingRegionId
    ) => {
        if (!structure || !activeFloorId) return;
        if (staircaseCommitRef.current) return;
        if (activeStaircasePlacement?.kind === "landing") {
            if (!pointerValid) {
                setStatus("Point to an actual room floor to position the arrival marker.");
                return;
            }
            const sourceFloor = floorPlans.find(floor =>
                floor.structure.stairs.some(stair =>
                    stair.stairConnectionId === activeStaircasePlacement.source.stairConnectionId
                )
            );
            const source = sourceFloor?.structure.stairs.find(stair =>
                stair.stairConnectionId === activeStaircasePlacement.source.stairConnectionId
            );
            const error = source
                ? validateStaircaseFootprint({
                    ...source,
                    position: candidate.position,
                    rotationY: candidate.rotationY
                }, structure.walls, geometry.regions, source.id, structure.stairs)
                : "The connected staircase no longer exists.";
            if (error) {
                setStatus(error);
                return;
            }
            const nextFloors = moveStaircaseLanding(
                floorPlans,
                activeStaircasePlacement.source,
                candidate
            );
            if (!nextFloors) {
                setStatus("Unable to move the stair arrival marker.");
                return;
            }
            staircaseCommitRef.current = true;
            commit(nextFloors.find(floor => floor.floorId === activeFloorId)?.structure ?? structure);
            setActiveStaircasePlacement(null);
            setStaircasePointer(null);
            setTool("select");
            setSelectedStructureElement({
                kind: "landing",
                id: activeStaircasePlacement.source.id
            });
            setStatus("Stair arrival marker moved.");
            return;
        }

        const source = activeStaircasePlacement?.kind === "staircase"
            ? activeStaircasePlacement.source
            : null;
        const action = activeStaircasePlacement?.kind === "staircase"
            ? activeStaircasePlacement.action
            : "place";
        const destinationId = source?.destinationFloorId ?? staircaseDestinationForPlacement;
        const targetFloor = floorPlans.find(floor => floor.floorId === destinationId);
        const dimensionsError = validateStaircaseDimensions(dimensions);
        const error = dimensionsError ?? validateStaircasePlacement({
                    candidate,
                    dimensions,
                    activeFloorId,
                    destinationFloorId: destinationId,
                    floors: floorPlans,
                    sourceStructure: structure,
                    sourceRegions: geometry.regions,
                    destinationFloor: targetFloor,
                    destinationRegions: targetFloor
                        ? getManagedFloorRegions(targetFloor.structure)
                        : [],
                    pointerValid,
                    regionId,
                    excludedStairId: source?.id
                });
        if (error) {
            setStatus(error);
            return;
        }
        const nextFloors = applyStaircasePlacement(
            floorPlans,
            activeFloorId,
            destinationId,
            candidate,
            dimensions,
            action,
            source,
            crypto.randomUUID(),
            crypto.randomUUID(),
            crypto.randomUUID()
        );
        if (!nextFloors) {
            setStatus("Unable to place the staircase. Check its connected floor and unique IDs.");
            return;
        }
        staircaseCommitRef.current = true;
        commitFloors(nextFloors, [activeFloorId, destinationId]);
        const placedStair = nextFloors
            .find(floor => floor.floorId === activeFloorId)
            ?.structure.stairs.find(stair =>
                action === "move" ? stair.id === source?.id : stair.position === candidate.position
            );
        if (placedStair) {
            setSelectedStructureElement({ kind: "staircase", id: placedStair.id });
        }
        setActiveStaircasePlacement(null);
        setStaircasePointer(null);
        setStaircaseFootprintPreview(null);
        setStaircaseDrawingPhase("confirmed");
        setTool("select");
        setStatus(action === "move"
            ? "Staircase moved."
            : action === "duplicate"
                ? "Staircase duplicated with a new connection."
                : "Staircase placed.");
    };

    const handleScenePoint = (
        scenePoint: { x: number; y?: number; z: number },
        forcedWallId: string | null = null,
        snapCornerId: string | null = null
    ) => {
        setPreviewWallEnd(null);
        setPreviewRoomEnd(null);
        setBuildPointer(null);
        if (!structure) return;
        const rawPoint = {
            ...scenePointToWorldPoint(scenePoint),
            y: selectedAsset?.type === "window" || activeElementPlacement?.kind === "window"
                ? scenePoint.y ?? 0
                : 0
        };
        if (recordCalibrationPoint({ x: rawPoint.x, y: rawPoint.z })) return;
        if (
            blueprintUrl &&
            !blueprintLocked &&
            (tool === "wall" || tool === "room")
        ) {
            return;
        }

        let snapped = tool === "wall"
            ? resolveWallDrawingPoint(rawPoint, structure, snapCornerId, forcedWallId)
            : snapWorldPoint(rawPoint, structure, snapCornerId);
        if (tool === "wall" && pendingWallStart && !snapCornerId && !forcedWallId) {
            snapped = snap90Degrees(pendingWallStart.position, snapped);
        }
        const planarPoint = { x: snapped.x, z: snapped.z };

        if (tool === "staircase") {
            return;
        }

        if (tool === "wall") {
            addWallSegment(planarPoint);
            return;
        }

        if (tool === "room") {
            addRoomRectangle(planarPoint);
            return;
        }

        if (tool === "select") {
            setSelectedStructureElement(null);
            let nearestWall: StructureWall | null = null;
            let nearestDistance = 0.35;
            for (const wall of structure.walls) {
                const closest = closestPointOnWall(snapped, wall);
                const distance = Math.hypot(planarPoint.x - closest.x, planarPoint.z - closest.z);
                if (distance < nearestDistance) {
                    nearestWall = wall;
                    nearestDistance = distance;
                }
            }
            setSelectedWallId(nearestWall?.id ?? null);
            const region = nearestWall
                ? null
                : geometry.regions.find(item => {
                    const point = new Vector3(planarPoint.x, 0, planarPoint.z);
                    return pointInPolygon(point, item.corners) &&
                        !item.boundaryLoops.slice(1).some(loop =>
                            pointInPolygon(point, loop.corners)
                        );
                });
            setSelectedRegionId(region?.id ?? null);
            return;
        }

        const wallId = forcedWallId ?? selectedWallId;
        placeBuildAsset(wallId, { ...planarPoint, y: rawPoint.y });
    };

    const handleScenePointerMove = (scenePoint: {
        x: number;
        y: number;
        z: number;
        wallId?: string;
        snapCornerId: string | null;
        alignedX: number | null;
        alignedZ: number | null;
    } | null) => {
        if (tool !== "wall" || structure?.layoutConfirmed) {
            setWallGuides(null);
        }
        if (calibrationStep === "second-point") {
            if (scenePoint) {
                const point = scenePointToWorldPoint(scenePoint);
                setCalibrationLineEnd({ x: point.x, y: point.z });
            } else {
                setCalibrationLineEnd(null);
            }
            setPreviewWallEnd(null);
            setPreviewRoomEnd(null);
            setBuildPointer(null);
            setWallGuides(null);
            return;
        }

        if (
            blueprintUrl &&
            !blueprintLocked &&
            (tool === "wall" || tool === "room")
        ) {
            setPreviewWallEnd(null);
            setPreviewRoomEnd(null);
            setWallGuides(null);
            return;
        }

        if (
            !scenePoint ||
            !structure ||
            calibrationStep !== "idle"
        ) {
            setPreviewWallEnd(null);
            setPreviewRoomEnd(null);
            setBuildPointer(null);
            setStaircasePointer(null);
            setWallGuides(null);
            return;
        }

        const rawPoint = {
            ...scenePointToWorldPoint(scenePoint),
            y: activeBuildAsset?.type === "window"
                ? scenePoint.y
                : 0
        };
        if (tool === "staircase") return;
        let nextPoint = tool === "wall"
            ? resolveWallDrawingPoint(
                rawPoint,
                structure,
                scenePoint.snapCornerId,
                scenePoint.wallId ?? null
            )
            : snapWorldPoint(rawPoint, structure, scenePoint.snapCornerId);
        if (
            !structure.layoutConfirmed &&
            tool === "wall" &&
            pendingWallStart &&
            !scenePoint.snapCornerId &&
            !scenePoint.wallId
        ) {
            nextPoint = snap90Degrees(pendingWallStart.position, nextPoint);
        }
        if (!structure.layoutConfirmed && tool === "wall") {
            const snapPosition = scenePoint.snapCornerId
                ? findStructureCorner(structure, scenePoint.snapCornerId)?.position ?? null
                : scenePoint.wallId
                    ? nextPoint
                    : null;
            setWallGuides({
                snapPosition: snapPosition ? { ...snapPosition } : null,
                closing: Boolean(
                    wallChainStart &&
                    scenePoint.snapCornerId === wallChainStart.id
                ),
                alignedX: scenePoint.alignedX,
                alignedZ: scenePoint.alignedZ
            });
        }
        if (!structure.layoutConfirmed && tool === "wall" && pendingWallStart) {
            setPreviewRoomEnd(null);
            setBuildPointer(null);
            setPreviewWallEnd(current =>
                current &&
                current.x === nextPoint.x &&
                current.y === nextPoint.y &&
                current.z === nextPoint.z
                    ? current
                    : nextPoint
            );
            return;
        }
        if (!structure.layoutConfirmed && tool === "room" && pendingRoomStart) {
            setPreviewWallEnd(null);
            setBuildPointer(null);
            setPreviewRoomEnd(current =>
                current &&
                current.x === nextPoint.x &&
                current.y === nextPoint.y &&
                current.z === nextPoint.z
                    ? current
                    : nextPoint
            );
            return;
        }
        if (activeBuildAsset) {
            setPreviewWallEnd(null);
            setPreviewRoomEnd(null);
            setBuildPointer({
                point: nextPoint,
                wallId: scenePoint.wallId ?? selectedWallId
            });
            return;
        }
        setPreviewWallEnd(null);
        setPreviewRoomEnd(null);
        setBuildPointer(null);
    };

    const handleStaircaseFloorPointerMove = (hit: {
        point: Point3;
        snapWallPoint: Point3 | null;
        regionId: string;
        snapCornerId: string | null;
        alignedX: number | null;
        alignedZ: number | null;
    } | null) => {
        if (tool !== "staircase" || !structure) return;
        if (!hit) {
            setStaircasePointerValid(false);
            setWallGuides(null);
            return;
        }

        const snapped = hit.snapCornerId
            ? snapWorldPoint({ ...hit.point, y: 0 }, structure, hit.snapCornerId)
            : hit.snapWallPoint ?? snapWorldPoint({ ...hit.point, y: 0 }, structure);
        const isStartingRoom = activeStaircasePlacement !== null ||
            !staircaseDrawingRegionId ||
            hit.regionId === staircaseDrawingRegionId;
        setStaircasePointerValid(isStartingRoom);
        setWallGuides({
            snapPosition: hit.snapCornerId
                ? findStructureCorner(structure, hit.snapCornerId)?.position ?? null
                : null,
            closing: false,
            alignedX: hit.alignedX,
            alignedZ: hit.alignedZ
        });

        if (staircaseDrawingPhase === "sizing-footprint" && staircaseDrawingStart) {
            const footprint = createStaircaseFootprintPreview(
                staircaseDrawingStart,
                snapped,
                structure.wallHeight,
                0.28,
                staircaseDimensions.riserCount
            );
            setStaircaseFootprintPreview(footprint);
            setStaircasePointer(footprint.candidate.position);
            return;
        }
        if (activeStaircasePlacement) {
            setStaircasePointer(snapped);
        }
    };

    const handleStaircaseFloorClick = (hit: {
        point: Point3;
        snapWallPoint: Point3 | null;
        regionId: string;
        snapCornerId: string | null;
        alignedX: number | null;
        alignedZ: number | null;
    } | null) => {
        if (
            tool !== "staircase" ||
            !structure ||
            !activeFloorId ||
            calibrationStep !== "idle"
        ) return;
        if (!hit) {
            setStaircasePointerValid(false);
            return;
        }
        const snapped = hit.snapCornerId
            ? snapWorldPoint({ ...hit.point, y: 0 }, structure, hit.snapCornerId)
            : hit.snapWallPoint ?? snapWorldPoint({ ...hit.point, y: 0 }, structure);
        setStaircasePointerValid(true);

        if (staircaseDrawingPhase === "selecting-start") {
            staircaseCommitRef.current = false;
            setStaircaseDrawingStart(snapped);
            setStaircaseDrawingRegionId(hit.regionId);
            setStaircasePointer(snapped);
            setStaircaseFootprintPreview(null);
            setStaircaseDrawingPhase("sizing-footprint");
            setStatus("Move the pointer over the same room and click the opposite staircase corner.");
            return;
        }

        if (staircaseDrawingPhase !== "sizing-footprint") return;
        if (activeStaircasePlacement) {
            setStaircaseDrawingRegionId(hit.regionId);
            setStaircasePointer(snapped);
            placeStaircase(
                {
                    position: snapped,
                    rotationY: activeStaircasePlacement.kind === "staircase"
                        ? activeStaircasePlacement.source.rotationY
                        : activeStaircasePlacement.source.rotationY
                },
                activeStaircasePlacement.kind === "staircase"
                    ? activeStaircasePlacement.source
                    : staircaseDimensionsForPlacement,
                true,
                hit.regionId
            );
            return;
        }
        if (!staircaseDrawingStart) return;

        const footprint = createStaircaseFootprintPreview(
            staircaseDrawingStart,
            snapped,
            structure.wallHeight,
            0.28,
            staircaseDimensions.riserCount
        );
        setStaircaseFootprintPreview(footprint);
        setStaircasePointer(footprint.candidate.position);
        const pointerValid = hit.regionId === staircaseDrawingRegionId;
        setStaircasePointerValid(pointerValid);
        const dimensionError = validateStaircaseDimensions({
            ...footprint.dimensions,
            totalRise: structure.wallHeight,
            treadThickness: staircaseDimensions.treadThickness,
            railings: staircaseDimensions.railings,
            shape: staircaseDimensions.shape,
            turnDirection: staircaseDimensions.turnDirection
        });
        const dimensions = {
            ...footprint.dimensions,
            totalRise: structure.wallHeight,
            treadThickness: staircaseDimensions.treadThickness,
            railings: staircaseDimensions.railings,
            shape: staircaseDimensions.shape,
            turnDirection: staircaseDimensions.turnDirection
        };
        const destinationId = resolvedDestinationFloorId;
        const targetFloor = floorPlans.find(floor => floor.floorId === destinationId);
        const placementError = dimensionError ?? validateStaircasePlacement({
            candidate: footprint.candidate,
            dimensions,
            activeFloorId,
            destinationFloorId: destinationId,
            floors: floorPlans,
            sourceStructure: structure,
            sourceRegions: geometry.regions,
            destinationFloor: targetFloor,
            destinationRegions: targetFloor ? getManagedFloorRegions(targetFloor.structure) : [],
            pointerValid,
            regionId: staircaseDrawingRegionId
        });
        if (placementError) {
            setStatus(placementError);
            return;
        }
        placeStaircase(footprint.candidate, dimensions, pointerValid, staircaseDrawingRegionId);
    };

    const cancelDrawing = () => {
        const hasPendingWall = tool === "wall" && pendingWallStart !== null;
        const hasPendingRoom = tool === "room" && pendingRoomStart !== null;
        const hasPendingStaircase = staircaseDrawingStart !== null ||
            staircaseFootprintPreview !== null;
        if (!hasPendingWall && !hasPendingRoom && !hasPendingStaircase) return;

        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setStaircaseDrawingStart(null);
        setStaircaseFootprintPreview(null);
        setStaircasePointer(null);
        setStaircasePointerValid(false);
        setStaircaseDrawingRegionId(null);
        setStaircaseDrawingPhase("cancelled");
        setTool("select");
    };

    const cancelBuildPlacement = () => {
        const cancelledPlacement = activeElementPlacement;
        const cancelledStaircasePlacement = activeStaircasePlacement;
        setActiveElementPlacement(null);
        setActiveStaircasePlacement(null);
        setMovePreviewReady(false);
        setBuildPointer(null);
        setStaircasePointer(null);
        setStaircaseDrawingStart(null);
        setStaircaseFootprintPreview(null);
        if (cancelledPlacement) setSelectedAsset(null);
        setTool("select");
        if (cancelledPlacement) {
            setSelectedStructureElement({
                kind: cancelledPlacement.kind,
                id: cancelledPlacement.source.id
            });
        } else if (cancelledStaircasePlacement) {
            setSelectedStructureElement({
                kind: cancelledStaircasePlacement.kind === "staircase" ? "staircase" : "landing",
                id: cancelledStaircasePlacement.source.id
            });
        }
        setStatus("Placement cancelled.");
    };

    const handleWallClick = (wallId: string, point: Vector3, snapCornerId: string | null) => {
        if (tool === "select" && calibrationStep === "idle") {
            setSelectedStructureElement(null);
            setSelectedWallId(wallId);
            setSelectedRegionId(null);
            return;
        }
        handleScenePoint({ x: point.x, y: point.y, z: point.z }, wallId, snapCornerId);
    };

    const removeSelectedWall = () => {
        if (!structure || !selectedWallId || structure.layoutConfirmed) return;
        commit({
            ...structure,
            walls: structure.walls.filter(wall => wall.id !== selectedWallId),
            corners: structure.corners.filter(corner =>
                structure.walls.some(wall =>
                    wall.id !== selectedWallId &&
                    (wall.start.id === corner.id || wall.end.id === corner.id)
                )
            ),
            doors: structure.doors.filter(door => door.wallId !== selectedWallId),
            windows: structure.windows.filter(window => window.wallId !== selectedWallId),
            openings: structure.openings.filter(opening => opening.wallId !== selectedWallId)
        });
        setSelectedWallId(null);
        setSelectedRegionId(null);
        setSelectedStructureElement(null);
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
    };

    const handleBlueprintUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!["image/png", "image/jpeg"].includes(file.type)) {
            setStatus("Please upload a JPG or PNG blueprint.");
            event.target.value = "";
            return;
        }
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            if (image.width <= 0 || image.height <= 0) {
                URL.revokeObjectURL(url);
                setStatus("Unable to read the selected blueprint image.");
                return;
            }
            if (blueprintUrl?.startsWith("blob:")) URL.revokeObjectURL(blueprintUrl);
            setBlueprintAspectRatio(image.width / image.height);
            setBlueprintUrl(url);
            setBlueprintName(file.name);
            setBlueprintVisible(true);
            setBlueprintLocked(false);
            setBlueprintPosition({ x: 0, z: 0 });
            setBlueprintRotation(0);
            setCalibrationStep("idle");
            setCalibrationPoints([]);
            setCalibrationLineEnd(null);
            setMeasuredBlueprintLength(null);
            setStatus("Blueprint loaded for this editing session only.");
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            setStatus("Unable to read the selected blueprint image.");
        };
        image.src = url;
        event.target.value = "";
    };

    const removeBlueprint = () => {
        if (blueprintUrl?.startsWith("blob:")) URL.revokeObjectURL(blueprintUrl);
        setBlueprintUrl(null);
        setBlueprintName("");
        setBlueprintVisible(false);
        setBlueprintLocked(false);
        setBlueprintPosition({ x: 0, z: 0 });
        setBlueprintRotation(0);
        setCalibrationStep("idle");
        setCalibrationPoints([]);
        setCalibrationLineEnd(null);
        setMeasuredBlueprintLength(null);
        setActualBlueprintLength("");
        setStatus("Blueprint removed from this editing session.");
    };

    const startCalibration = () => {
        if (!blueprintUrl) return;
        if (blueprintLocked) {
            setStatus("Unlock the blueprint before calibrating it.");
            return;
        }
        setBlueprintVisible(true);
        setCalibrationPoints([]);
        setCalibrationLineEnd(null);
        setMeasuredBlueprintLength(null);
        setActualBlueprintLength("");
        setCalibrationStep("first-point");
        setStatus("Choose two points on the blueprint with a known distance.");
    };

    const cancelCalibration = () => {
        setCalibrationStep("idle");
        setCalibrationPoints([]);
        setCalibrationLineEnd(null);
        setMeasuredBlueprintLength(null);
        setActualBlueprintLength("");
    };

    const resetFloorInteractions = (nextStructure: ManagedStructure) => {
        cancelDrawing();
        if (calibrationStep !== "idle") cancelCalibration();
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setSelectedWallId(null);
        setSelectedRegionId(null);
        setSelectedStructureElement(null);
        setActiveElementPlacement(null);
        setActiveStaircasePlacement(null);
        setStaircaseDrawingPhase("idle");
        setStaircaseDrawingStart(null);
        setStaircaseDrawingRegionId(null);
        setStaircaseFootprintPreview(null);
        setStaircasePointerValid(false);
        setStaircasePointer(null);
        setMovePreviewReady(false);
        setSelectedAsset(null);
        setBuildPointer(null);
        setTool(nextStructure.layoutConfirmed ? "select" : "wall");
    };

    const switchFloor = (floorId: string) => {
        if (floorId === activeFloorId) return;
        const nextFloor = floorPlans.find(floor => floor.floorId === floorId);
        if (!nextFloor) return;
        resetFloorInteractions(nextFloor.structure);
        setActiveFloorId(nextFloor.floorId);
        setStatus("");
    };

    const deleteFloor = () => {
        if (isReadOnly || savingAction !== null || floorPlans.length <= 1 || !floorToDeleteId) return;
        const deletedFloorIndex = floorPlans.findIndex(floor => floor.floorId === floorToDeleteId);
        const deletedFloor = floorPlans[deletedFloorIndex];
        if (!deletedFloor) {
            setFloorToDeleteId(null);
            return;
        }

        const deletedStairIds = new Set(deletedFloor.structure.stairs.map(stair => stair.id));
        const deletedStairConnectionIds = new Set(
            deletedFloor.structure.stairs.map(stair => stair.stairConnectionId)
        );
        const nextFloors = floorPlans
            .filter(floor => floor.floorId !== deletedFloor.floorId)
            .map((floor, index) => ({
                ...floor,
                name: getFloorName(index),
                structure: {
                    ...floor.structure,
                    stairs: floor.structure.stairs.filter(
                        stair => stair.destinationFloorId !== deletedFloor.floorId
                    ),
                    stairLandings: floor.structure.stairLandings.filter(
                        landing =>
                            !deletedStairIds.has(landing.stairId) &&
                            !deletedStairConnectionIds.has(landing.stairConnectionId)
                    )
                }
            }));
        const nextActiveFloor = nextFloors[Math.min(deletedFloorIndex, nextFloors.length - 1)];
        if (!nextActiveFloor) return;

        resetFloorInteractions(nextActiveFloor.structure);
        setFloorPlans(nextFloors);
        setActiveFloorId(nextActiveFloor.floorId);
        setHistoryByFloor({});
        setFutureByFloor({});
        setBlueprintSessions(current => {
            const next = { ...current };
            delete next[deletedFloor.floorId];
            return next;
        });
        setFloorToDeleteId(null);
        setStatus(`${deletedFloor.name} removed. Any stairs connected to it were also removed. Save to keep this change.`);
    };

    const addFloor = () => {
        if (isReadOnly || !structure || isCreatingFloor) return;
        setIsCreatingFloor(true);
        try {
            const newStructure = createManagedStructure(
                structure.projectId,
                projectName,
                structure.ownerId
            );
            if (newFloorMode === "outline") {
                const firstFloor = floorPlans[0]?.structure;
                if (!firstFloor) throw new Error("The first floor is unavailable.");
                Object.assign(
                    newStructure,
                    createManagedStructureFromExteriorOutline(firstFloor)
                );
            }

            const newFloor = createManagedEditorFloor(newStructure, floorPlans.length);
            resetFloorInteractions(newFloor.structure);
            setFloorPlans(current => [...current, newFloor]);
            setActiveFloorId(newFloor.floorId);
            setIsAddFloorDialogOpen(false);
            setStatus(newFloorMode === "outline"
                ? "New floor created from the first floor's exterior outline."
                : "New blank floor created. Use the Blueprint button below to upload a plan and begin tracing.");
        } catch (error) {
            setStatus(error instanceof Error
                ? error.message
                : "Unable to create the requested floor.");
        } finally {
            setIsCreatingFloor(false);
        }
    };

    const applyCalibration = () => {
        if (measuredBlueprintLength === null || !validPositiveNumber(measuredBlueprintLength)) {
            setStatus("Choose two different blueprint points first.");
            return;
        }
        const realLength = Number(actualBlueprintLength);
        if (!validPositiveNumber(realLength)) {
            setStatus("Enter a valid real-world measurement greater than zero.");
            return;
        }
        try {
            const width = calculateCalibratedBlueprintWidth({
                measuredLength: measuredBlueprintLength,
                realLength,
                currentWidth: blueprintWidth
            });
            setBlueprintWidth(width);
            setCalibrationStep("idle");
            setCalibrationPoints([]);
            setCalibrationLineEnd(null);
            setMeasuredBlueprintLength(null);
            setActualBlueprintLength("");
            setStatus(`Blueprint calibrated to ${width.toFixed(2)} scene units wide.`);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to calibrate the blueprint.");
        }
    };

    const selectAsset = (asset: Asset) => {
        setActiveElementPlacement(null);
        setSelectedStructureElement(null);
        setSelectedAsset(asset);
        setBuildPointer(null);
        setPlacementWidthEdited(false);
        setPlacementHeightEdited(false);
        if (asset.type === "door") {
            const bounds = assetModelBounds[asset.id];
            setPlacementWidth(asset.width ?? bounds?.width ?? DEFAULT_DOOR_DIMENSIONS.width);
            setPlacementHeight(asset.height ?? bounds?.height ?? DEFAULT_DOOR_DIMENSIONS.height);
        } else if (asset.type === "window") {
            const bounds = assetModelBounds[asset.id];
            setPlacementWidth(asset.width ?? bounds?.width ?? DEFAULT_WINDOW_DIMENSIONS.width);
            setPlacementHeight(asset.height ?? bounds?.height ?? DEFAULT_WINDOW_DIMENSIONS.height);
        }
    };

    const activateAsset = (asset: Asset) => {
        if (!structure?.layoutConfirmed) return;
        const assetTool = asset.type === "door" || asset.type === "window" || asset.type === "opening"
            ? asset.type
            : null;
        if (!assetTool) {
            setStatus("This asset cannot be placed by the structural editor.");
            return;
        }
        if (selectedAsset?.id === asset.id && tool === assetTool) {
            setActiveElementPlacement(null);
            setTool("select");
            setBuildPointer(null);
            setStatus("Placement cancelled.");
            return;
        }
        setActiveElementPlacement(null);
        setSelectedStructureElement(null);
        setSelectedAsset(asset);
        setTool(assetTool);
        setBuildPointer(null);
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setStatus(`Placement active for ${asset.name}. Move over a wall and click to place it.`);
    };

    const confirmLayout = () => {
        if (!structure || structure.layoutConfirmed) return;
        if (!window.confirm("Once confirmed, the wall and room layout can no longer be edited. Continue?")) return;
        commit({ ...structure, layoutConfirmed: true });
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
        setTool("select");
        setStatus("Layout confirmed. Build placement is now available.");
    };

    const updateWallHeight = (height: number) => {
        if (!structure || structure.layoutConfirmed || !validPositiveNumber(height)) return;
        commit({
            ...structure,
            wallHeight: height,
            stairs: structure.stairs.map(stair => ({ ...stair, totalRise: height }))
        });
    };

    const updateWallThickness = (wallThickness: number) => {
        if (!structure || structure.layoutConfirmed || !validPositiveNumber(wallThickness)) return;
        commit({ ...structure, wallThickness });
    };

    const updateOpeningSetting = (key: "openingWidth" | "openingHeight" | "archRise", value: number) => {
        if (!structure || !validPositiveNumber(value)) return;
        if (key === "archRise" && value > structure.openingHeight) return;
        commit({ ...structure, [key]: value });
    };

    const completeGuardedExit = () => {
        const pending = pendingEditorExit;
        if (!pending) return;
        allowEditorExitRef.current = true;
        setExitGuardOpen(false);
        setExitGuardError("");
        setPendingEditorExit(null);
        if (pending.kind === "navigate") {
            navigate(pending.destination);
        } else {
            navigate(pending.delta);
        }
    };

    const requestBackNavigation = () => {
        if (!hasUnsavedChanges()) {
            navigate(-1);
            return;
        }
        setPendingEditorExit({ kind: "history", delta: -1 });
        setExitGuardError("");
        setExitGuardOpen(true);
    };

    const discardAndExit = async () => {
        if (!pendingEditorExit || exitGuardSaving || savingAction !== null) return;
        setExitGuardSaving(true);
        setExitGuardError("");
        try {
            if (draftId && isNewlyCreatedDraft) {
                await deleteManagedFloorPlanDraft(draftId);
                setNewlyCreatedDraftIdState(null);
            }
            completeGuardedExit();
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Unable to discard this floor-plan draft.";
            setExitGuardError(message);
            setStatus(message);
        } finally {
            setExitGuardSaving(false);
        }
    };

    const saveDraftAndExit = async () => {
        if (!pendingEditorExit || exitGuardSaving || savingAction !== null) return;
        setExitGuardSaving(true);
        setExitGuardError("");
        try {
            await save(false, true);
        } finally {
            setExitGuardSaving(false);
        }
    };

    const save = async (published: boolean, exitAfterSave = false) => {
        if (!structure || savingAction) {
            if (exitAfterSave) setExitGuardError("The floor plan is not ready to save. Please try again.");
            return;
        }
        if (isReadOnly) {
            const message = "This floor plan is read-only. Only its creator can save or publish it.";
            setStatus(message);
            if (exitAfterSave) setExitGuardError(message);
            return;
        }
        if (!structure.projectId.trim() || !structure.ownerId.trim()) {
            const message = "Project ID and client owner UID are required before saving.";
            setStatus(message);
            if (exitAfterSave) setExitGuardError(message);
            return;
        }
        if (!projectName.trim()) {
            const message = "A floor-plan name is required before saving.";
            setStatus(message);
            if (exitAfterSave) setExitGuardError(message);
            return;
        }
        if (published && !isPublished) {
            if (!isValidProjectDeadline(deadline) || deadline <= getTodayLocalDate()) {
                setDeadlineOpen(true);
                setStatus("Choose a valid project deadline after today before publishing.");
                return;
            }
        }
        if (published && !window.confirm(
            `Publish "${projectName.trim()}" to its assigned client with deadline ${
                deadline ? `${formatEditorDeadline(deadline)} at 11:59 PM Philippine time` : "not set"
            }?`
        )) {
            return;
        }
        setSavingAction(published ? "publish" : "draft");
        try {
            setStatus(published ? "Publishing..." : "Saving draft...");
            const savedAt = new Date().toISOString();
            const savedDeadline = draftId && deadline
                ? deadline
                : savedDeadlineRef.current;
            const nextStructure = { ...structure, projectName, savedAt, blueprint: null };
            const projectData = serializeManagedStructureProject(
                floorPlans,
                activeFloorId ?? floorPlans[0]?.floorId ?? "",
                projectName,
                savedAt
            );
            if (draftId) {
                if (published) {
                    const result = await publishManagedFloorPlanDraft({
                        draftId,
                        projectName,
                        deadline,
                        projectData: { ...projectData }
                    });
                    setRevision(Math.max(revision, 0) + 1);
                    setHistoryByFloor({});
                    setFutureByFloor({});
                    setNewlyCreatedDraftIdState(null);
                    try {
                        removeLocalManagedProjectDraft(structure.ownerId);
                    } catch (error) {
                        console.error("Published project but could not remove its prior browser draft.", error);
                    }
                    navigate(`/projects/edit/${encodeURIComponent(result.projectId)}`, {
                        replace: true,
                        state: { ownerName }
                    });
                    setStatus("Project published successfully.");
                    return;
                }

                const nextRevision = Math.max(revision, 0) + 1;
                await saveManagedFloorPlanDraft({
                    draftId,
                    projectName,
                    projectData: { ...projectData },
                    revision: nextRevision,
                    ...(deadline ? { deadline } : {})
                });
                setRevision(nextRevision);
                if (deadline) savedDeadlineRef.current = deadline;
                savedEditorFingerprintRef.current = createManagedEditorExitFingerprint({
                    floors: floorPlans,
                    activeFloorId,
                    projectName,
                    deadline: savedDeadlineRef.current
                });
                const wasNewDraft = newlyCreatedDraftIdState === draftId;
                setNewlyCreatedDraftIdState(null);
                if (wasNewDraft) {
                    navigate(
                        `${location.pathname}${location.search}${location.hash}`,
                        { replace: true, state: { ownerName } }
                    );
                }
                try {
                    removeLocalManagedProjectDraft(structure.ownerId);
                } catch (error) {
                    console.error("Draft saved but its prior browser copy could not be removed.", error);
                }
                setStatus("Draft saved to the admin workspace. It has not been shared with the client.");
                if (exitAfterSave) completeGuardedExit();
                return;
            }

            if (!projectId) throw new Error("A saved project or draft must be selected.");
            const nextRevision = published
                ? Math.max(revision, 0) + 1
                : Math.max(revision, 1);
            await saveManagedStructure({
                projectId: structure.projectId,
                projectName,
                ownerId: structure.ownerId,
                projectData: { ...projectData },
                revision: nextRevision,
                published,
                ...(!isPublished && published ? { deadline } : {})
            });
            commit(nextStructure);
            setRevision(nextRevision);
            savedEditorFingerprintRef.current = createManagedEditorExitFingerprint({
                floors: floorPlans.map(floor => floor.floorId === activeFloorId
                    ? { ...floor, structure: nextStructure }
                    : floor),
                activeFloorId,
                projectName,
                deadline: savedDeadline
            });
            if (published) setIsPublished(true);
            setStatus(published ? "Project published successfully." : "Draft saved successfully.");
            if (exitAfterSave) completeGuardedExit();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to save project.";
            setStatus(message);
            if (exitAfterSave) setExitGuardError(message);
        } finally {
            setSavingAction(null);
        }
    };

    const canSave = !isReadOnly && Boolean(
        (projectId || draftId) &&
        structure?.projectId.trim() &&
        structure.ownerId.trim() &&
        projectName.trim()
    );

    const handleToolChange = (nextTool: AdminStructuralTool) => {
        setActiveElementPlacement(null);
        setActiveStaircasePlacement(null);
        setSelectedStructureElement(null);
        setTool(nextTool);
        staircaseCommitRef.current = false;
        setStaircaseDrawingPhase(nextTool === "staircase"
            ? "selecting-start"
            : "idle");
        setStaircaseDrawingStart(null);
        setStaircaseDrawingRegionId(null);
        setStaircaseFootprintPreview(null);
        setStaircasePointerValid(false);
        setBuildPointer(null);
        setStaircasePointer(null);
        setPendingWallStart(null);
        setWallChainStart(null);
        setPreviewWallEnd(null);
        setWallGuides(null);
        setPendingRoomStart(null);
        setPreviewRoomEnd(null);
    };

    if (showInitializationLoading && initializationState === "loading") {
        return <LoadingScreen label="Preparing Floor Plan" />;
    }

    if (showInitializationLoading && initializationState === "error") {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
                <div className="max-w-lg text-center">
                    <h2 className="text-lg font-semibold">Unable to prepare floor plan</h2>
                    <p className="mt-2 break-words text-sm text-zinc-400">{status}</p>
                    <button
                        type="button"
                        className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        onClick={requestBackNavigation}
                    >
                        Back to Projects
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-editor">
            <header className="admin-editor-header">
                <div className="admin-editor-header-left">
                    <button
                        type="button"
                        className="ae-btn ae-icon-btn"
                        onClick={requestBackNavigation}
                        aria-label="Back"
                        title="Back"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="admin-editor-project">
                        <input
                            ref={projectNameInputRef}
                            value={projectName}
                            onChange={event => setProjectName(event.target.value)}
                            aria-label="Project name"
                            disabled={isReadOnly || savingAction !== null}
                            readOnly={isReadOnly}
                        />
                        <span className="admin-editor-owner" title={clientDisplayName.trim() || "Unknown client"}>
                            {clientDisplayName.trim() || "Unknown client"}
                        </span>
                    </div>
                    {isDraftRecord && (
                        <span className="admin-editor-badge" role="status" title="Unpublished database draft — not shared with the client">
                            Draft
                        </span>
                    )}
                    {isReadOnly && (
                        <span className="admin-editor-badge warn" role="status">
                            Read-only — created by {creatorDisplayName || "another administrator"}
                        </span>
                    )}
                </div>
                <div className="admin-editor-header-right">
                    {isPublished && deadline && (
                        <span className="admin-editor-badge" role="status">
                            Deadline: {formatEditorDeadline(deadline)} (11:59 PM Philippine time)
                        </span>
                    )}
                    {!isPublished && (
                        <div className="admin-editor-deadline">
                            <button
                                type="button"
                                className={`ae-btn ${deadline ? "" : "needs-attention"}`}
                                aria-expanded={deadlineOpen}
                                aria-haspopup="dialog"
                                title="Set publish deadline"
                                onClick={() => setDeadlineOpen(open => !open)}
                                disabled={isReadOnly || savingAction !== null}
                            >
                                <CalendarDays size={15} />
                                <span className="ae-label">
                                    {deadline ? formatEditorDeadline(deadline) : "Set deadline"}
                                </span>
                            </button>
                            {deadlineOpen && (
                                <div
                                    className="admin-editor-popover"
                                    role="dialog"
                                    aria-label="Publish deadline"
                                    onKeyDown={event => {
                                        if (event.key === "Escape") setDeadlineOpen(false);
                                    }}
                                >
                                    <label>
                                        Publish deadline
                                        <input
                                            type="date"
                                            value={deadline.slice(0, 10)}
                                            min={getTomorrowLocalDateTime().slice(0, 10)}
                                            onChange={event => setDeadline(
                                                event.target.value ? `${event.target.value}T23:59` : ""
                                            )}
                                            disabled={isReadOnly || savingAction !== null}
                                            aria-label="Project deadline date"
                                            autoFocus
                                        />
                                    </label>
                                    <p>Required before the project can be published to the client.</p>
                                    <p className="admin-editor-deadline-cutoff">
                                        Due by 11:59 PM Philippine time.
                                    </p>
                                    <div
                                        className="admin-editor-deadline-presets"
                                        role="group"
                                        aria-label="Suggested deadlines"
                                    >
                                        {DEADLINE_PRESETS.map(days => {
                                            const presetDate = getEditorDeadlineDateAfterDays(days);
                                            return (
                                                <button
                                                    key={days}
                                                    type="button"
                                                    className={deadline.slice(0, 10) === presetDate ? "active" : ""}
                                                    aria-pressed={deadline.slice(0, 10) === presetDate}
                                                    aria-label={`Set deadline ${days} days from today`}
                                                    disabled={isReadOnly || savingAction !== null}
                                                    onClick={() => setDeadline(`${presetDate}T23:59`)}
                                                >
                                                    {days} days
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button type="button" className="ae-btn" onClick={() => setDeadlineOpen(false)}>
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        type="button"
                        className="ae-btn"
                        onClick={() => void save(false)}
                        disabled={!canSave || savingAction !== null}
                        title={isDraftRecord ? "Save draft to admin workspace" : "Save draft"}
                        aria-label="Save draft"
                    >
                        <Save size={15} />
                        <span className="ae-label">{savingAction === "draft" ? "Saving..." : "Save draft"}</span>
                    </button>
                    <button
                        type="button"
                        className="ae-btn primary"
                        onClick={() => void save(true)}
                        disabled={!canSave || savingAction !== null}
                        title="Publish"
                        aria-label="Publish"
                    >
                        <Send size={15} />
                        <span className="ae-label">{savingAction === "publish" ? "Publishing..." : "Publish"}</span>
                    </button>
                </div>
            </header>
            {isAddFloorDialogOpen && (
                <div
                    className="admin-editor-dialog-backdrop"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setIsAddFloorDialogOpen(false);
                    }}
                    onKeyDown={event => {
                        if (event.key === "Escape") setIsAddFloorDialogOpen(false);
                    }}
                >
                    <section
                        className="admin-editor-add-floor-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-editor-add-floor-title"
                    >
                        <h2 id="admin-editor-add-floor-title">Add Floor</h2>
                        <p>Choose how to start the new floor layout.</p>
                        <label className="admin-editor-floor-choice">
                            <input
                                type="radio"
                                name="new-floor-mode"
                                value="blank"
                                checked={newFloorMode === "blank"}
                                onChange={() => setNewFloorMode("blank")}
                            />
                            <span>
                                <strong>Start with a Blank Layout</strong>
                                <small>Create an empty floor, then optionally upload and trace a blueprint.</small>
                            </span>
                        </label>
                        <label className="admin-editor-floor-choice">
                            <input
                                type="radio"
                                name="new-floor-mode"
                                value="outline"
                                checked={newFloorMode === "outline"}
                                onChange={() => setNewFloorMode("outline")}
                            />
                            <span>
                                <strong>Copy First-Floor Exterior Outline</strong>
                                <small>Copy only closed exterior walls and boundary corners with new IDs.</small>
                            </span>
                        </label>
                        <button
                            type="button"
                            className="admin-editor-dialog-cancel"
                            onClick={() => setIsAddFloorDialogOpen(false)}
                            disabled={isCreatingFloor}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="admin-editor-dialog-create"
                            onClick={addFloor}
                            disabled={isCreatingFloor}
                        >
                            {isCreatingFloor ? "Creating..." : "Create Floor"}
                        </button>
                    </section>
                </div>
            )}
            {floorToDeleteId && (
                <div
                    className="admin-editor-dialog-backdrop"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setFloorToDeleteId(null);
                    }}
                    onKeyDown={event => {
                        if (event.key === "Escape") setFloorToDeleteId(null);
                    }}
                >
                    <section
                        className="admin-editor-add-floor-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-editor-delete-floor-title"
                    >
                        <h2 id="admin-editor-delete-floor-title">Delete {floorPlans.find(floor => floor.floorId === floorToDeleteId)?.name ?? "floor"}?</h2>
                        <p>This cannot be undone. Any stairs connected to this floor will also be removed. Save the project after deleting to keep the change.</p>
                        <button
                            type="button"
                            className="admin-editor-dialog-cancel"
                            onClick={() => setFloorToDeleteId(null)}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="admin-editor-dialog-delete"
                            onClick={deleteFloor}
                            disabled={isReadOnly || savingAction !== null}
                        >
                            Delete Floor
                        </button>
                    </section>
                </div>
            )}
            <main className="admin-editor-main" aria-label="Structural editing scene">
                {structure && (
                    <AdminStructureScene
                        structure={structure}
                        floorId={activeFloorId ?? ""}
                        blueprintUrl={blueprintUrl}
                        blueprintLocked={blueprintLocked}
                        blueprintVisible={blueprintVisible}
                        blueprintOpacity={blueprintOpacity}
                        blueprintWidth={blueprintWidth}
                        blueprintAspectRatio={blueprintAspectRatio}
                        blueprintPosition={blueprintPosition}
                        blueprintRotation={blueprintRotation}
                        blueprintCalibrationActive={calibrationStep !== "idle"}
                        calibrationLine={
                            calibrationStep === "second-point" &&
                            calibrationPoints[0] &&
                            calibrationLineEnd
                                ? {
                                    start: new Vector3(calibrationPoints[0].x, 0.04, calibrationPoints[0].y),
                                    end: new Vector3(calibrationLineEnd.x, 0.04, calibrationLineEnd.y)
                                }
                                : null
                        }
                        onBlueprintPositionChange={setBlueprintPosition}
                        onBlueprintRotationChange={setBlueprintRotation}
                        selectedWallId={selectedWallId}
                        selectedRegionId={selectedRegionId}
                        selectionEnabled={tool === "select" && calibrationStep === "idle"}
                        onFloorSelect={regionId => {
                            setSelectedStructureElement(null);
                            setSelectedWallId(null);
                            setSelectedRegionId(regionId);
                        }}
                        wallPreview={wallPreview}
                        wallGuides={wallGuides}
                        showWallMeasurements={showWallMeasurements}
                        roomPreview={roomPreview}
                        buildElementAsset={activeBuildAsset}
                        buildElementPlacement={buildElementPlacement}
                        onAssetModelBounds={handleAssetModelBounds}
                        drawingActive={
                            (tool === "wall" && pendingWallStart !== null) ||
                            (tool === "room" && pendingRoomStart !== null)
                        }
                        placementActive={activeBuildAsset !== null || tool === "staircase"}
                        staircaseDrawingActive={
                            tool === "staircase"
                        }
                        staircaseDrawingPhase={staircaseDrawingPhase}
                        onCancelDrawing={cancelDrawing}
                        onCancelPlacement={cancelBuildPlacement}
                        onScenePoint={(point, snapCornerId) =>
                            handleScenePoint(point, null, snapCornerId)
                        }
                        onScenePointerMove={handleScenePointerMove}
                        onStaircaseFloorPointerMove={handleStaircaseFloorPointerMove}
                        onStaircaseFloorClick={handleStaircaseFloorClick}
                        onWallClick={handleWallClick}
                        onDoorSelect={id => selectStructureElement("door", id)}
                        onWindowSelect={id => selectStructureElement("window", id)}
                        onStaircaseSelect={selectStaircase}
                        onStaircaseLandingSelect={selectStaircaseLanding}
                        staircasePreview={staircasePreview}
                        staircaseFootprint={staircaseFootprint}
                        landingPreview={landingPreview}
                        selectedElement={activeElementPlacement || activeStaircasePlacement
                            ? null
                            : selectedStructureElement}
                        onMoveSelectedElement={() => beginSelectedPlacement("move")}
                        onDuplicateSelectedElement={() => beginSelectedPlacement("duplicate")}
                        onRemoveSelectedElement={removeSelectedElement}
                        hiddenDoorId={
                            movePreviewReady &&
                            buildElementPlacement &&
                            activeElementPlacement?.action === "move" &&
                            activeElementPlacement.kind === "door"
                                ? activeElementPlacement.source.id
                                : null
                        }
                        hiddenWindowId={
                            movePreviewReady &&
                            buildElementPlacement &&
                            activeElementPlacement?.action === "move" &&
                            activeElementPlacement.kind === "window"
                                ? activeElementPlacement.source.id
                                : null
                        }
                        hiddenStaircaseId={
                            staircasePointer &&
                            activeStaircasePlacement?.kind === "staircase" &&
                            activeStaircasePlacement.action === "move"
                                ? activeStaircasePlacement.source.id
                                : null
                        }
                        hiddenLandingId={
                            staircasePointer && activeStaircasePlacement?.kind === "landing"
                                ? activeStaircasePlacement.source.id
                                : null
                        }
                        movingElement={
                            activeElementPlacement?.action === "move"
                                ? {
                                    kind: activeElementPlacement.kind,
                                    id: activeElementPlacement.source.id
                                }
                                : null
                        }
                        onBuildElementPreviewReady={handleBuildElementPreviewReady}
                    />
                )}
            </main>
            {structure && (
                <AdminFloorRail
                    floors={floorPlans}
                    activeFloorId={activeFloorId}
                    canAdd={!isReadOnly && savingAction === null}
                    canDelete={!isReadOnly && savingAction === null && floorPlans.length > 1}
                    onSelect={switchFloor}
                    onAdd={() => setIsAddFloorDialogOpen(true)}
                    onDelete={() => {
                        if (activeFloorId) setFloorToDeleteId(activeFloorId);
                    }}
                />
            )}
            {structure && (
                <AdminToolDock
                    structure={structure}
                    readOnly={isReadOnly}
                    tool={tool}
                    blueprintUrl={blueprintUrl}
                    blueprintName={blueprintName}
                    blueprintVisible={blueprintVisible}
                    blueprintOpacity={blueprintOpacity}
                    blueprintLocked={blueprintLocked}
                    calibrationStep={calibrationStep}
                    measuredBlueprintLength={measuredBlueprintLength}
                    actualBlueprintLength={actualBlueprintLength}
                    showWallMeasurements={showWallMeasurements}
                    staircaseStepCount={staircaseDimensions.riserCount}
                    staircaseRailings={staircaseDimensions.railings}
                    staircaseShape={staircaseDimensions.shape}
                    staircaseTurnDirection={staircaseDimensions.turnDirection}
                    staircasePlacementMessage={staircasePanelMessage}
                    onStaircaseStepCountChange={updateStaircaseStepCount}
                    onStaircaseRailingsChange={updateStaircaseRailings}
                    onStaircaseShapeChange={updateStaircaseShape}
                    onStaircaseTurnDirectionChange={updateStaircaseTurnDirection}
                    onToolChange={handleToolChange}
                    onBlueprintUpload={handleBlueprintUpload}
                    onBlueprintRemove={removeBlueprint}
                    onBlueprintVisibilityChange={() => {
                        if (blueprintVisible && calibrationStep !== "idle") cancelCalibration();
                        setBlueprintVisible(value => !value);
                    }}
                    onBlueprintOpacityChange={setBlueprintOpacity}
                    onBlueprintLockChange={() => {
                        if (!blueprintLocked && calibrationStep !== "idle") cancelCalibration();
                        setPendingWallStart(null);
                        setWallChainStart(null);
                        setPreviewWallEnd(null);
                        setWallGuides(null);
                        setPendingRoomStart(null);
                        setPreviewRoomEnd(null);
                        setBlueprintLocked(value => !value);
                    }}
                    onCalibrationStart={startCalibration}
                    onCalibrationCancel={cancelCalibration}
                    onCalibrationLengthChange={setActualBlueprintLength}
                    onCalibrationApply={applyCalibration}
                    onWallHeightChange={updateWallHeight}
                    onWallThicknessChange={updateWallThickness}
                    onShowWallMeasurementsChange={setShowWallMeasurements}
                    onConfirmLayout={confirmLayout}
                    renderBuildLibrary={closeLibrary => (
                        <AdminBuildPanel
                            structure={structure}
                            readOnly={isReadOnly}
                            doors={doors}
                            windows={windows}
                            loading={assetsLoading}
                            loadError={assetsError}
                            selectedAsset={selectedAsset}
                            tool={tool}
                            placementWidth={placementWidth}
                            placementHeight={placementHeight}
                            onSelectAsset={selectAsset}
                            onActivateAsset={asset => {
                                activateAsset(asset);
                                closeLibrary();
                            }}
                            onPlacementWidthChange={value => {
                                if (validPositiveNumber(value)) {
                                    setPlacementWidth(value);
                                    setPlacementWidthEdited(true);
                                }
                            }}
                            onPlacementHeightChange={value => {
                                if (validPositiveNumber(value)) {
                                    setPlacementHeight(value);
                                    setPlacementHeightEdited(true);
                                }
                            }}
                            onOpeningWidthChange={value => updateOpeningSetting("openingWidth", value)}
                            onOpeningHeightChange={value => updateOpeningSetting("openingHeight", value)}
                            onArchRiseChange={value => updateOpeningSetting("archRise", value)}
                        />
                    )}
                />
            )}
            {!structure && !status && (
                <p className="admin-editor-loading">Loading project...</p>
            )}
            {structure && (
                <div className="admin-editor-canvas-tools" role="toolbar" aria-label="Structure history">
                    <button type="button" onClick={undo} disabled={isReadOnly || !history.length} title="Undo" aria-label="Undo">
                        <Undo2 size={16} />
                    </button>
                    <button type="button" onClick={redo} disabled={isReadOnly || !future.length} title="Redo" aria-label="Redo">
                        <Redo2 size={16} />
                    </button>
                    <span className="admin-editor-tools-divider" aria-hidden="true" />
                    <button
                        type="button"
                        className="danger"
                        onClick={removeSelectedWall}
                        disabled={isReadOnly || !selectedWallId || structure.layoutConfirmed}
                        title="Delete selected wall"
                        aria-label="Delete selected wall"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}
            {status && !status.startsWith("Blueprint calibrated to") && (
                <div
                    className={`admin-editor-toast ${status.toLowerCase().includes("unable") || status.toLowerCase().includes("error") ? "error" : ""}`}
                    role="status"
                >
                    <span>{status}</span>
                    <button type="button" onClick={() => setStatus("")} aria-label="Dismiss message" title="Dismiss">
                        <X size={14} />
                    </button>
                </div>
            )}
            {exitGuardOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                        background: "rgba(15, 15, 15, 0.45)",
                        backdropFilter: "blur(3px)"
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-unsaved-changes-title"
                        style={{
                            position: "relative",
                            width: "min(460px, 100%)",
                            borderRadius: 18,
                            background: "#ffffff",
                            padding: 24,
                            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.22)"
                        }}
                    >
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => {
                                if (exitGuardSaving || savingAction !== null) return;
                                setExitGuardOpen(false);
                                setExitGuardError("");
                                setPendingEditorExit(null);
                            }}
                            disabled={exitGuardSaving || savingAction !== null}
                            style={{
                                position: "absolute",
                                top: 14,
                                right: 14,
                                width: 34,
                                height: 34,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                borderRadius: "50%",
                                background: "transparent",
                                color: "#777777",
                                cursor: exitGuardSaving || savingAction !== null ? "default" : "pointer"
                            }}
                        >
                            <X size={19} />
                        </button>
                        <div style={{ paddingRight: 36 }}>
                            <h2
                                id="admin-unsaved-changes-title"
                                style={{
                                    margin: 0,
                                    fontSize: 19,
                                    lineHeight: 1.3,
                                    fontWeight: 700,
                                    color: "#222222"
                                }}
                            >
                                Unsaved Changes
                            </h2>
                            <p style={{
                                margin: "8px 0 0",
                                fontSize: 13,
                                lineHeight: 1.6,
                                color: "#777777"
                            }}>
                                {draftId
                                    ? isNewlyCreatedDraft
                                        ? "This new floor plan has unsaved changes."
                                        : "This draft is not autosaved. Save the latest changes before leaving, or discard them and keep the last saved draft."
                                    : "You have unsaved changes to this project."}
                            </p>
                            {exitGuardError && (
                                <p role="alert" style={{
                                    margin: "10px 0 0",
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    color: "#b42318"
                                }}>
                                    {exitGuardError}
                                </p>
                            )}
                        </div>
                        <div style={{
                            display: "flex",
                            justifyContent: draftId ? "stretch" : "flex-end",
                            gap: 10,
                            marginTop: 24
                        }}>
                            <button
                                type="button"
                                onClick={() => void discardAndExit()}
                                disabled={exitGuardSaving || savingAction !== null}
                                style={{
                                    width: draftId ? "auto" : 130,
                                    flex: draftId ? 1 : "0 0 130px",
                                    height: 42,
                                    padding: "0 16px",
                                    border: "1px solid #dededb",
                                    borderRadius: 9,
                                    background: "#f5f5f2",
                                    color: "#444444",
                                    cursor: exitGuardSaving || savingAction !== null ? "default" : "pointer",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    whiteSpace: "nowrap"
                                }}
                            >
                                Discard
                            </button>
                            {draftId && (
                                <button
                                    type="button"
                                    onClick={() => void saveDraftAndExit()}
                                    disabled={exitGuardSaving || savingAction !== null}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        height: 42,
                                        padding: "0 16px",
                                        border: "none",
                                        borderRadius: 9,
                                        background: "#ff7a00",
                                        color: "#ffffff",
                                        cursor: exitGuardSaving || savingAction !== null ? "default" : "pointer",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                        boxShadow: "0 2px 6px rgba(255, 122, 0, 0.18)"
                                    }}
                                >
                                    {exitGuardSaving || savingAction !== null ? "Saving..." : "Save Draft & Exit"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}