import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { Suspense } from "react";
import {
    CanvasTexture,
    DoubleSide,
    Mesh,
    Raycaster,
    SRGBColorSpace,
    Vector2,
    Vector3
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { Copy, Move, Trash2 } from "lucide-react";
import {
    AdminProceduralStaircase,
    AdminStaircaseLandingMarker
} from "./AdminProceduralStaircase";
import type {
    ProceduralStaircaseData,
    StaircaseLandingData
} from "../../../../shared/staircaseGeometry.ts";
import type { Corner } from "@/components/project-loader/engine/walls/Corner";
import type { Wall } from "@/components/project-loader/engine/walls/WallTypes";
import AdminDoors from "@/components/project-loader/loader-components/AdminDoors";
import AdminFloors from "@/components/project-loader/loader-components/AdminFloors";
import AdminGrid from "@/components/project-loader/loader-components/AdminGrid";
import AdminLights from "@/components/project-loader/loader-components/AdminLights";
import AdminWalls from "@/components/project-loader/loader-components/AdminWalls";
import AdminWindows from "@/components/project-loader/loader-components/AdminWindows";
import AdminCamera from "@/components/project-loader/loader-components/AdminCamera";
import type {
    ManagedStructure,
    StructureStaircase,
    StructureWall
} from "./structureTypes";
import type { StaircaseDrawingPhase } from "./staircaseActions";
import type { RoomPreviewGeometry } from "./structureGeometry";
import { closestPointOnWall, wallLength, wallSurfaceArea } from "./structureGeometry";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import type { BuildElementPlacementCandidate } from "./buildElementPlacement";
import AdminBuildElementPreview, { AdminOpeningPreview } from "./AdminBuildElementPreview";
import AdminBlueprintPlane from "./AdminBlueprintPlane";

interface AdminStructureSceneProps {
    structure: ManagedStructure;
    floorId: string;
    blueprintUrl?: string | null;
    blueprintLocked?: boolean;
    blueprintVisible?: boolean;
    blueprintOpacity?: number;
    blueprintWidth?: number;
    blueprintAspectRatio?: number;
    blueprintPosition?: { x: number; z: number };
    blueprintRotation?: number;
    blueprintCalibrationActive?: boolean;
    calibrationLine?: { start: Vector3; end: Vector3 } | null;
    onBlueprintPositionChange: (position: { x: number; z: number }) => void;
    onBlueprintRotationChange: (rotation: number) => void;
    selectedWallId?: string | null;
    selectedRegionId?: string | null;
    selectionEnabled?: boolean;
    onFloorSelect?: (regionId: string) => void;
    wallPreview?: StructureWall | null;
    roomPreview?: RoomPreviewGeometry | null;
    showWallMeasurements?: boolean;
    buildElementAsset?: Asset | null;
    buildElementPlacement?: BuildElementPlacementCandidate | null;
    onAssetModelBounds?: (assetId: string, bounds: { width: number; height: number; depth: number }) => void;
    drawingActive?: boolean;
    placementActive?: boolean;
    staircaseDrawingActive?: boolean;
    staircaseDrawingPhase?: StaircaseDrawingPhase;
    onDoorSelect?: (doorId: string) => void;
    onWindowSelect?: (windowId: string) => void;
    onStaircaseSelect?: (stairId: string) => void;
    onStaircaseLandingSelect?: (landingId: string) => void;
    selectedElement?: { kind: "door" | "window" | "staircase" | "landing"; id: string } | null;
    staircasePreview?: {
        stair: ProceduralStaircaseData;
        valid: boolean;
        validationMessage?: string | null;
    } | null;
    staircaseFootprint?: {
        corners: Array<{ x: number; z: number }>;
        valid: boolean;
    } | null;
    landingPreview?: {
        landing: StaircaseLandingData;
    } | null;
    onMoveSelectedElement?: () => void;
    onDuplicateSelectedElement?: () => void;
    onRemoveSelectedElement?: () => void;
    hiddenDoorId?: string | null;
    hiddenWindowId?: string | null;
    hiddenStaircaseId?: string | null;
    hiddenLandingId?: string | null;
    movingElement?: { kind: "door" | "window"; id: string } | null;
    onBuildElementPreviewReady?: () => void;
    onScenePoint?: (point: { x: number; y: number; z: number }, snapCornerId: string | null) => void;
    onStaircaseFloorPointerMove?: (hit: StaircaseFloorHit | null) => void;
    onStaircaseFloorClick?: (hit: StaircaseFloorHit | null) => void;
    onScenePointerMove?: (point: {
        x: number;
        y: number;
        z: number;
        wallId?: string;
        snapCornerId: string | null;
        alignedX: number | null;
        alignedZ: number | null;
    } | null) => void;
    wallGuides?: {
        snapPosition: { x: number; y: number; z: number } | null;
        closing: boolean;
        alignedX: number | null;
        alignedZ: number | null;
    } | null;
    onCancelDrawing?: () => void;
    onCancelPlacement?: () => void;
    onWallClick?: (wallId: string, point: Vector3, snapCornerId: string | null) => void;
}

interface StaircaseFloorHit {
    point: { x: number; y: number; z: number };
    snapWallPoint: { x: number; y: number; z: number } | null;
    regionId: string;
    snapCornerId: string | null;
    alignedX: number | null;
    alignedZ: number | null;
}

const ignoreStaircaseFloorHit = () => {};

type PointerProjection = {
    camera: ThreeEvent<PointerEvent>["camera"];
    pointer: ThreeEvent<PointerEvent>["pointer"];
    nativeEvent: { target: EventTarget | null };
};

function getPointerSnapDetails(
    event: PointerProjection,
    point: { x: number; y: number; z: number },
    structure: ManagedStructure
) {
    const target = event.nativeEvent.target;
    if (!(target instanceof HTMLElement)) {
        return { snapCornerId: null, snapWallPoint: null, alignedX: null, alignedZ: null };
    }
    const bounds = target.getBoundingClientRect();
    const corners = new Map<string, { id: string; position: { x: number; y: number; z: number } }>();
    for (const corner of structure.corners) corners.set(corner.id, corner);
    for (const wall of structure.walls) {
        corners.set(wall.start.id, wall.start);
        corners.set(wall.end.id, wall.end);
    }

    const screenDistance = (position: { x: number; y: number; z: number }) => {
        const projected = new Vector3(position.x, position.y, position.z).project(event.camera);
        return Math.hypot(
            (projected.x - event.pointer.x) * bounds.width / 2,
            (projected.y - event.pointer.y) * bounds.height / 2
        );
    };

    let snapCornerId: string | null = null;
    let nearestSnapDistance = 14;
    let snapWallPoint: { x: number; y: number; z: number } | null = null;
    let nearestWallDistance = 12;
    let alignedX: number | null = null;
    let alignedZ: number | null = null;
    let nearestXDistance = 9;
    let nearestZDistance = 9;

    for (const corner of corners.values()) {
        const cornerDistance = screenDistance(corner.position);
        if (cornerDistance < nearestSnapDistance) {
            nearestSnapDistance = cornerDistance;
            snapCornerId = corner.id;
        }

        const xDistance = screenDistance({ x: corner.position.x, y: 0.02, z: point.z });
        if (xDistance < nearestXDistance) {
            nearestXDistance = xDistance;
            alignedX = corner.position.x;
        }
        const zDistance = screenDistance({ x: point.x, y: 0.02, z: corner.position.z });
        if (zDistance < nearestZDistance) {
            nearestZDistance = zDistance;
            alignedZ = corner.position.z;
        }
    }

    for (const wall of structure.walls) {
        const wallPoint = closestPointOnWall(point, wall);
        const wallDistance = screenDistance({ ...wallPoint, y: 0.02 });
        if (wallDistance < nearestWallDistance) {
            nearestWallDistance = wallDistance;
            snapWallPoint = { ...wallPoint, y: 0 };
        }
    }

    return { snapCornerId, snapWallPoint, alignedX, alignedZ };
}

interface PreviewLabelProps {
    label: string;
    position: [number, number, number];
    rotation: [number, number, number];
    width: number;
    height: number;
}

function PreviewLabel({ label, position, rotation, width, height }: PreviewLabelProps) {
    const texture = useMemo(() => {
        if (!label) return null;
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        const context = canvas.getContext("2d");
        if (!context) return null;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "800 220px Arial";
        context.lineJoin = "round";
        context.lineWidth = 20;
        context.strokeStyle = "rgba(0, 0, 0, 0.65)";
        context.strokeText(label, canvas.width / 2, canvas.height / 2);
        context.fillStyle = "rgba(255, 255, 255, 0.98)";
        context.fillText(label, canvas.width / 2, canvas.height / 2);

        const nextTexture = new CanvasTexture(canvas);
        nextTexture.colorSpace = SRGBColorSpace;
        nextTexture.needsUpdate = true;
        return nextTexture;
    }, [label]);

    useEffect(() => () => texture?.dispose(), [texture]);

    if (!texture || width <= 0 || height <= 0) return null;

    return (
        <mesh
            position={position}
            rotation={rotation}
            renderOrder={1000}
            frustumCulled={false}
            raycast={() => null}
        >
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={texture}
                transparent
                depthWrite={false}
                alphaTest={0.05}
                side={DoubleSide}
                toneMapped={false}
            />
        </mesh>
    );
}

function AdminWallPreviewMeasurement({
    wall,
    height,
    thickness
}: {
    wall: StructureWall;
    height: number;
    thickness: number;
}) {
    const length = wallLength(wall);
    if (!Number.isFinite(length) || length <= 0.001 || height <= 0 || thickness <= 0) return null;

    const start = wall.start.position;
    const end = wall.end.position;
    const direction = new Vector3(end.x - start.x, 0, end.z - start.z).normalize();
    const normal = new Vector3(-direction.z, 0, direction.x);
    const center = new Vector3(
        (start.x + end.x) * 0.5,
        height / 2,
        (start.z + end.z) * 0.5
    );
    const angle = Math.atan2(-direction.z, direction.x);
    const labelScale = Math.min(1, (length * 0.85) / 1.4, (height * 0.6) / 0.55);
    if (!Number.isFinite(labelScale) || labelScale <= 0) return null;

    const offset = thickness / 2 + 0.04;
    const width = 1.4 * labelScale;
    const labelHeight = 0.55 * labelScale;
    const label = `${length.toFixed(2)} m`;

    return (
        <>
            <PreviewLabel
                label={label}
                position={[center.x + normal.x * offset, center.y, center.z + normal.z * offset]}
                rotation={[0, angle, 0]}
                width={width}
                height={labelHeight}
            />
            <PreviewLabel
                label={label}
                position={[center.x - normal.x * offset, center.y, center.z - normal.z * offset]}
                rotation={[0, angle + Math.PI, 0]}
                width={width}
                height={labelHeight}
            />
        </>
    );
}

function DrawingContextMenuHandler({
    active,
    onCancel
}: {
    active: boolean;
    onCancel: () => void;
}) {
    const { gl } = useThree();

    useEffect(() => {
        const handleContextMenu = (event: MouseEvent) => {
            if (!active) return;
            event.preventDefault();
            onCancel();
        };

        gl.domElement.addEventListener("contextmenu", handleContextMenu);
        return () => gl.domElement.removeEventListener("contextmenu", handleContextMenu);
    }, [active, gl, onCancel]);

    return null;
}

function StaircaseFloorRaycaster({
    active,
    floorId,
    structure,
    onPointerMove,
    onClick
}: {
    active: boolean;
    floorId: string;
    structure: ManagedStructure;
    onPointerMove: (hit: StaircaseFloorHit | null) => void;
    onClick: (hit: StaircaseFloorHit | null) => void;
}) {
    const { camera, gl, scene } = useThree();
    const raycaster = useMemo(() => new Raycaster(), []);
    const pointer = useMemo(() => new Vector2(), []);

    useEffect(() => {
        if (!active) return;

        const getFloorHit = (event: PointerEvent | MouseEvent): StaircaseFloorHit | null => {
            const bounds = gl.domElement.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) return null;
            pointer.set(
                ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
                -((event.clientY - bounds.top) / bounds.height) * 2 + 1
            );
            scene.updateMatrixWorld(true);
            raycaster.setFromCamera(pointer, camera);
            const floorMeshes: Mesh[] = [];
            scene.traverse(object => {
                if (
                    object instanceof Mesh &&
                    object.userData.staircaseRaycastSurface === true &&
                    object.userData.floorId === floorId &&
                    typeof object.userData.regionId === "string"
                ) {
                    floorMeshes.push(object);
                }
            });
            const intersection = raycaster.intersectObjects(floorMeshes, false)[0];
            if (!intersection || typeof intersection.object.userData.regionId !== "string") {
                return null;
            }
            const snap = getPointerSnapDetails({
                camera,
                pointer,
                nativeEvent: { target: gl.domElement }
            }, intersection.point, structure);
            return {
                point: intersection.point,
                regionId: intersection.object.userData.regionId,
                ...snap
            };
        };
        const handlePointerMove = (event: PointerEvent) => {
            onPointerMove(getFloorHit(event));
        };
        const handleClick = (event: MouseEvent) => {
            if (event.button !== 0) return;
            onClick(getFloorHit(event));
        };

        gl.domElement.addEventListener("pointermove", handlePointerMove);
        gl.domElement.addEventListener("click", handleClick);
        return () => {
            gl.domElement.removeEventListener("pointermove", handlePointerMove);
            gl.domElement.removeEventListener("click", handleClick);
        };
    }, [active, camera, floorId, gl, onClick, onPointerMove, pointer, raycaster, scene, structure]);

    return null;
}

function AdminWallPreview({
    wall,
    height,
    thickness
}: {
    wall: StructureWall | null;
    height: number;
    thickness: number;
}) {
    if (!wall || !Number.isFinite(height) || height <= 0 || !Number.isFinite(thickness) || thickness <= 0) {
        return null;
    }

    const length = wallLength(wall);
    if (!Number.isFinite(length) || length <= 0.001) return null;

    const start = wall.start.position;
    const end = wall.end.position;
    const angle = Math.atan2(end.z - start.z, end.x - start.x);
    const centerX = (start.x + end.x) * 0.5;
    const centerZ = (start.z + end.z) * 0.5;

    return (
        <mesh
            position={[centerX, height / 2, centerZ]}
            rotation={[0, -angle, 0]}
            raycast={() => null}
        >
            <boxGeometry args={[length, height, thickness]} />
            <meshStandardMaterial
                color="#4DA3FF"
                transparent
                opacity={0.45}
                depthWrite={false}
            />
        </mesh>
    );
}

export default function AdminStructureScene({
    structure,
    floorId,
    blueprintUrl,
    blueprintLocked = false,
    blueprintVisible = true,
    blueprintOpacity = 0.45,
    blueprintWidth = 10,
    blueprintAspectRatio = 1,
    blueprintPosition = { x: 0, z: 0 },
    blueprintRotation = 0,
    blueprintCalibrationActive = false,
    calibrationLine = null,
    onBlueprintPositionChange,
    onBlueprintRotationChange,
    selectedWallId,
    selectedRegionId = null,
    selectionEnabled = true,
    onFloorSelect,
    wallPreview = null,
    roomPreview = null,
    wallGuides = null,
    showWallMeasurements = true,
    buildElementAsset = null,
    buildElementPlacement = null,
    onAssetModelBounds,
    drawingActive = false,
    placementActive = false,
    staircaseDrawingActive = false,
    staircaseDrawingPhase = "idle",
    onDoorSelect,
    onWindowSelect,
    onStaircaseSelect,
    onStaircaseLandingSelect,
    selectedElement = null,
    staircasePreview = null,
    staircaseFootprint = null,
    landingPreview = null,
    onMoveSelectedElement,
    onDuplicateSelectedElement,
    onRemoveSelectedElement,
    hiddenDoorId = null,
    hiddenWindowId = null,
    hiddenStaircaseId = null,
    hiddenLandingId = null,
    movingElement = null,
    onBuildElementPreviewReady,
    onScenePoint,
    onStaircaseFloorPointerMove,
    onStaircaseFloorClick,
    onScenePointerMove,
    onCancelDrawing = () => {},
    onCancelPlacement = () => {},
    onWallClick
}: AdminStructureSceneProps) {
    const corners: Corner[] = structure.corners.map(corner => ({
        id: corner.id,
        position: new Vector3(
            corner.position.x,
            corner.position.y,
            corner.position.z
        )
    }));

    const walls: Wall[] = structure.walls.map(wall => ({
        id: wall.id,
        start: {
            id: wall.start.id,
            position: new Vector3(
                wall.start.position.x,
                wall.start.position.y,
                wall.start.position.z
            )
        },
        end: {
            id: wall.end.id,
            position: new Vector3(
                wall.end.position.x,
                wall.end.position.y,
                wall.end.position.z
            )
        }
    }));

    const doors = structure.doors.map(door => ({
        id: door.id,
        wallId: door.wallId,
        position: new Vector3(
            door.position.x,
            door.position.y,
            door.position.z
        ),
        width: door.width,
        height: door.height,
        wallWidth: door.wallWidth ?? door.width
    }));

    const windows = structure.windows.map(window => ({
        id: window.id,
        wallId: window.wallId,
        position: new Vector3(
            window.position.x,
            window.position.y,
            window.position.z
        ),
        width: window.width,
        height: window.height,
        wallWidth: window.wallWidth
    }));

    const openings = structure.openings.map(opening => ({
        id: opening.id,
        wallId: opening.wallId,
        position: new Vector3(
            opening.position.x,
            opening.position.y,
            opening.position.z
        ),
        width: opening.width,
        height: opening.height,
        shape: opening.shape,
        archRise: opening.archRise
    }));
    const selectedWallData = structure.walls.find(wall => wall.id === selectedWallId) ?? null;
    const selectedWallArea = selectedWallData
        ? wallSurfaceArea(selectedWallData, structure.wallHeight)
        : null;
    const selectedWallLabelPosition = selectedWallData
        ? [
            (selectedWallData.start.position.x + selectedWallData.end.position.x) * 0.5,
            structure.wallHeight * 0.5,
            (selectedWallData.start.position.z + selectedWallData.end.position.z) * 0.5
        ] as [number, number, number]
        : null;
    const selectedElementData = selectedElement
        ? selectedElement.kind === "door"
            ? structure.doors.find(element => element.id === selectedElement.id) ?? null
            : selectedElement.kind === "window"
                ? structure.windows.find(element => element.id === selectedElement.id) ?? null
                : selectedElement.kind === "staircase"
                    ? structure.stairs.find(element => element.id === selectedElement.id) ?? null
                    : structure.stairLandings.find(element => element.id === selectedElement.id) ?? null
        : null;
    const selectedElementPosition = selectedElementData?.position;
    const selectedElementHeight = selectedElement?.kind === "staircase" && selectedElementData
        ? (selectedElementData as StructureStaircase).totalRise
        : 0;

    const toolbarPosition = selectedElementData && selectedElementPosition
        ? [
            selectedElementPosition.x,
            selectedElementPosition.y + selectedElementHeight + 0.25,
            selectedElementPosition.z
        ] as [number, number, number]
        : null;

    const handleSceneClick = (event: ThreeEvent<MouseEvent>) => {
        if (!onScenePoint || event.nativeEvent.button !== 0) return;
        event.stopPropagation();
        const snap = getPointerSnapDetails(event, event.point, structure);
        onScenePoint({
            x: event.point.x,
            y: event.point.y,
            z: event.point.z
        }, snap.snapCornerId);
    };

    const handleScenePointerMove = (event: ThreeEvent<PointerEvent>) => {
        const snap = getPointerSnapDetails(event, event.point, structure);
        onScenePointerMove?.({
            x: event.point.x,
            y: event.point.y,
            z: event.point.z,
            snapCornerId: snap.snapCornerId,
            alignedX: snap.alignedX,
            alignedZ: snap.alignedZ
        });
    };
    const handleWallPointerMove = (
        wallId: string,
        point: Vector3,
        event: ThreeEvent<PointerEvent>
    ) => {
        onScenePointerMove?.({
            x: point.x,
            y: point.y,
            z: point.z,
            wallId,
            ...getPointerSnapDetails(event, point, structure)
        });
    };

    const handleWallClick = (
        wallId: string,
        point: Vector3,
        event: ThreeEvent<MouseEvent>
    ) => {
        onWallClick?.(
            wallId,
            point,
            getPointerSnapDetails(event, point, structure).snapCornerId
        );
    };

    return (
        <Canvas
            shadows="percentage"
            gl={{ preserveDrawingBuffer: true }}
            camera={{ position: [8, 8, 8], fov: 50 }}
            style={{ width: "100%", height: "100%", background: "#ffffff" }}
            onPointerLeave={() => onScenePointerMove?.(null)}
        >
            <color attach="background" args={["#ffffff"]} />
            <Suspense fallback={null}>
                <AdminLights corners={corners} />
                <AdminGrid />
                <DrawingContextMenuHandler
                    active={drawingActive || placementActive}
                    onCancel={placementActive ? onCancelPlacement : onCancelDrawing}
                />
                {blueprintUrl && blueprintVisible && (
                    <AdminBlueprintPlane
                        url={blueprintUrl}
                        opacity={blueprintOpacity}
                        width={blueprintWidth}
                        aspectRatio={blueprintAspectRatio}
                        position={blueprintPosition}
                        rotation={blueprintRotation}
                        locked={blueprintLocked}
                        calibrationActive={blueprintCalibrationActive}
                        onPositionChange={onBlueprintPositionChange}
                        onRotationChange={onBlueprintRotationChange}
                    />
                )}
                <AdminCamera
                    leftOrbitEnabled={
                        (!blueprintUrl || blueprintLocked) &&
                        !(staircaseDrawingActive && (
                            staircaseDrawingPhase === "selecting-start" ||
                            staircaseDrawingPhase === "sizing-footprint"
                        ))
                    }
                />
                <StaircaseFloorRaycaster
                    active={staircaseDrawingActive}
                    floorId={floorId}
                    structure={structure}
                    onPointerMove={onStaircaseFloorPointerMove ?? ignoreStaircaseFloorHit}
                    onClick={onStaircaseFloorClick ?? ignoreStaircaseFloorHit}
                />
                <mesh
                    rotation-x={-Math.PI / 2}
                    position={[0, -0.01, 0]}
                    onClick={handleSceneClick}
                    onPointerMove={handleScenePointerMove}
                >
                    <planeGeometry args={[400, 400]} />
                    <meshBasicMaterial
                        transparent
                        opacity={0}
                        colorWrite={false}
                        depthWrite={false}
                    />
                </mesh>
                <AdminWallPreview
                    wall={wallPreview}
                    height={structure.wallHeight}
                    thickness={structure.wallThickness}
                />
                {wallPreview && showWallMeasurements && (
                    <AdminWallPreviewMeasurement
                        wall={wallPreview}
                        height={structure.wallHeight}
                        thickness={structure.wallThickness}
                    />
                )}
                {wallGuides?.alignedX !== null && wallGuides?.alignedX !== undefined && (
                    <Line
                        points={[
                            [wallGuides.alignedX, 0.025, -20],
                            [wallGuides.alignedX, 0.025, 20]
                        ]}
                        color="#7d99aa"
                        lineWidth={1}
                        transparent
                        opacity={0.45}
                        depthTest={false}
                        renderOrder={100000}
                        frustumCulled={false}
                        raycast={() => null}
                    />
                )}
                {wallGuides?.alignedZ !== null && wallGuides?.alignedZ !== undefined && (
                    <Line
                        points={[
                            [-20, 0.025, wallGuides.alignedZ],
                            [20, 0.025, wallGuides.alignedZ]
                        ]}
                        color="#7d99aa"
                        lineWidth={1}
                        transparent
                        opacity={0.45}
                        depthTest={false}
                        renderOrder={100000}
                        frustumCulled={false}
                        raycast={() => null}
                    />
                )}
                {wallGuides?.snapPosition && (
                    <>
                        <mesh
                            position={[
                                wallGuides.snapPosition.x,
                                0.055,
                                wallGuides.snapPosition.z
                            ]}
                            raycast={() => null}
                            renderOrder={100001}
                        >
                            <sphereGeometry args={[0.09, 16, 16]} />
                            <meshBasicMaterial
                                color={wallGuides.closing ? "#19a974" : "#168bd2"}
                                depthTest={false}
                                toneMapped={false}
                            />
                        </mesh>
                        {wallGuides.closing && (
                            <Html
                                position={[
                                    wallGuides.snapPosition.x,
                                    0.2,
                                    wallGuides.snapPosition.z
                                ]}
                                center
                                distanceFactor={10}
                                style={{
                                    padding: "3px 6px",
                                    borderRadius: 4,
                                    background: "rgba(25, 169, 116, 0.92)",
                                    color: "#fff",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    pointerEvents: "none"
                                }}
                            >
                                Close room
                            </Html>
                        )}
                    </>
                )}
                {roomPreview && (
                    <>
                        {roomPreview.corners.map((start, index) => {
                            const end = roomPreview.corners[(index + 1) % roomPreview.corners.length];
                            const wall: StructureWall = {
                                id: `temporary-room-wall-${index}`,
                                start: { id: `temporary-room-corner-${index}`, position: start },
                                end: { id: `temporary-room-corner-${(index + 1) % roomPreview.corners.length}`, position: end }
                            };
                            return (
                                <AdminWallPreview
                                    key={wall.id}
                                    wall={wall}
                                    height={structure.wallHeight}
                                    thickness={structure.wallThickness}
                                />
                            );
                        })}
                        <mesh
                            position={[
                                (roomPreview.corners[0].x + roomPreview.corners[2].x) / 2,
                                0.02,
                                (roomPreview.corners[0].z + roomPreview.corners[2].z) / 2
                            ]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            raycast={() => null}
                        >
                            <planeGeometry args={[Math.max(roomPreview.width, 0.1), Math.max(roomPreview.length, 0.1)]} />
                            <meshStandardMaterial
                                color="#7ec8ff"
                                transparent
                                opacity={0.42}
                                side={DoubleSide}
                                depthWrite={false}
                            />
                        </mesh>
                        <PreviewLabel
                            label={`${roomPreview.width.toFixed(2)} m`}
                            position={[
                                (roomPreview.corners[0].x + roomPreview.corners[2].x) / 2,
                                0.03,
                                roomPreview.corners[0].z + (roomPreview.corners[2].z - roomPreview.corners[0].z) * 0.18
                            ]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            width={Math.max(roomPreview.width * 0.55, 0.6)}
                            height={Math.max(roomPreview.width * 0.55, 0.6) * 0.5}
                        />
                        <PreviewLabel
                            label={`${roomPreview.length.toFixed(2)} m`}
                            position={[
                                roomPreview.corners[0].x + (roomPreview.corners[2].x - roomPreview.corners[0].x) * 0.82,
                                0.03,
                                (roomPreview.corners[0].z + roomPreview.corners[2].z) / 2
                            ]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            width={Math.max(roomPreview.length * 0.55, 0.6)}
                            height={Math.max(roomPreview.length * 0.55, 0.6) * 0.5}
                        />
                        <PreviewLabel
                            label={`${roomPreview.area.toFixed(2)} m²`}
                            position={[
                                (roomPreview.corners[0].x + roomPreview.corners[2].x) / 2,
                                0.035,
                                (roomPreview.corners[0].z + roomPreview.corners[2].z) / 2
                            ]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            width={Math.max(roomPreview.width * 0.6, 0.9)}
                            height={Math.max(roomPreview.width * 0.6, 0.9) * 0.4}
                        />
                    </>
                )}
                <AdminFloors
                    floorId={floorId}
                    corners={corners}
                    walls={walls}
                    floorFinishes={structure.floorFinishes}
                    selectedRegionId={selectedRegionId}
                    onSelectRegion={selectionEnabled ? onFloorSelect : undefined}
                    allowInteractionPropagation={!selectionEnabled}
                    showAreaLabels={false}
                />
                {structure.stairs
                    .filter(stair => stair.floorId === floorId && stair.id !== hiddenStaircaseId)
                    .map(stair => (
                        <AdminProceduralStaircase
                            key={stair.id}
                            stair={stair}
                            onSelect={selectionEnabled
                                ? () => onStaircaseSelect?.(stair.id)
                                : undefined}
                        />
                    ))}
                {structure.stairLandings
                    .filter(landing => landing.floorId === floorId && landing.id !== hiddenLandingId)
                    .map(landing => (
                        <AdminStaircaseLandingMarker
                            key={landing.id}
                            landing={landing}
                            selected={selectedElement?.kind === "landing" && selectedElement.id === landing.id}
                            onSelect={selectionEnabled
                                ? () => onStaircaseLandingSelect?.(landing.id)
                                : undefined}
                        />
                    ))}
                {staircasePreview && (
                    <AdminProceduralStaircase
                        stair={staircasePreview.stair}
                        preview
                        valid={staircasePreview.valid}
                        validationMessage={staircasePreview.validationMessage}
                    />
                )}
                {staircaseFootprint && (
                    <Line
                        points={[
                            ...staircaseFootprint.corners.map(point =>
                                new Vector3(point.x, 0.035, point.z)
                            ),
                            ...staircaseFootprint.corners.slice(0, 1).map(point =>
                                new Vector3(point.x, 0.035, point.z)
                            )
                        ]}
                        color={staircaseFootprint.valid ? "#168bd2" : "#df4545"}
                        lineWidth={2}
                        depthTest={false}
                        raycast={() => null}
                    />
                )}
                {landingPreview && (
                    <AdminStaircaseLandingMarker
                        landing={landingPreview.landing}
                        selected
                    />
                )}
                <AdminWalls
                    corners={corners}
                    walls={walls}
                    doors={doors}
                    windows={windows}
                    openings={openings}
                    wallHeight={structure.wallHeight}
                    wallThickness={structure.wallThickness}
                    wallFinishes={structure.wallFinishes}
                    excludedCutoutElementId={movingElement?.id}
                    selectedWallId={selectedWallId}
                    onWallClick={handleWallClick}
                    onWallPointerMove={handleWallPointerMove}
                />
                <AdminDoors
                    doors={structure.doors}
                    wallThickness={structure.wallThickness}
                    onDoorSelect={onDoorSelect}
                    hiddenDoorId={hiddenDoorId}
                />
                <AdminWindows
                    windows={structure.windows}
                    wallThickness={structure.wallThickness}
                    onWindowSelect={onWindowSelect}
                    hiddenWindowId={hiddenWindowId}
                />
                {buildElementPlacement?.kind === "opening" && (
                    <AdminOpeningPreview
                        candidate={buildElementPlacement}
                        wallThickness={structure.wallThickness}
                    />
                )}
                {buildElementAsset && buildElementAsset.type !== "opening" && (
                    <AdminBuildElementPreview
                        asset={buildElementAsset}
                        candidate={buildElementPlacement ?? null}
                        wallThickness={structure.wallThickness}
                        onModelBounds={onAssetModelBounds ?? (() => {})}
                        onPreviewReady={onBuildElementPreviewReady}
                    />
                )}
                {selectedElementData && toolbarPosition && selectedElement && (
                    <Html position={toolbarPosition} zIndexRange={[10000, 0]}>
                        <div
                            className="admin-structure-selection-toolbar"
                            role="toolbar"
                            aria-label={`${selectedElement.kind} actions`}
                            onPointerDown={event => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onPointerUp={event => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onClick={event => event.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={onMoveSelectedElement}
                                title={selectedElement.kind === "landing" ? "Move stair arrival" : `Move ${selectedElement.kind}`}
                                aria-label={selectedElement.kind === "landing" ? "Move stair arrival" : `Move ${selectedElement.kind}`}
                            >
                                <Move size={18} />
                            </button>
                            {selectedElement.kind !== "landing" && <button
                                type="button"
                                onClick={onDuplicateSelectedElement}
                                title={`Duplicate ${selectedElement.kind}`}
                                aria-label={`Duplicate ${selectedElement.kind}`}
                            >
                                <Copy size={18} />
                            </button>}
                            {selectedElement.kind !== "landing" && <button
                                type="button"
                                className="delete"
                                onClick={onRemoveSelectedElement}
                                title={`Remove ${selectedElement.kind}`}
                                aria-label={`Remove ${selectedElement.kind}`}
                            >
                                <Trash2 size={18} />
                            </button>}
                        </div>
                    </Html>
                )}
                {selectedWallId && (() => {
                    const wall = walls.find(item => item.id === selectedWallId);
                    if (!wall) return null;
                    return (
                        <Line
                            points={[
                                new Vector3(wall.start.position.x, 0.025, wall.start.position.z),
                                new Vector3(wall.end.position.x, 0.025, wall.end.position.z)
                            ]}
                            color="#2563eb"
                            lineWidth={3}
                        />
                    );
                })()}
                {selectedWallArea !== null && selectedWallLabelPosition && (
                    <Html
                        position={selectedWallLabelPosition}
                        center
                        zIndexRange={[1000, 0]}
                        style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
                    >
                        <span className="admin-structure-area-label">
                            {`${selectedWallArea.toFixed(2)} m²`}
                        </span>
                    </Html>
                )}
                {calibrationLine && (
                    <Line
                        points={[calibrationLine.start, calibrationLine.end]}
                        color="#00e5ff"
                        lineWidth={4}
                        depthTest={false}
                        depthWrite={false}
                        toneMapped={false}
                        renderOrder={100000}
                        frustumCulled={false}
                        raycast={() => null}
                    />
                )}
            </Suspense>
        </Canvas>
    );
}
