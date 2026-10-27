import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { Suspense } from "react";
import { CanvasTexture, DoubleSide, SRGBColorSpace, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { Copy, Move, Trash2 } from "lucide-react";
import type { Corner } from "@/components/project-loader/engine/walls/Corner";
import type { Wall } from "@/components/project-loader/engine/walls/WallTypes";
import AdminDoors from "@/components/project-loader/loader-components/AdminDoors";
import AdminFloors from "@/components/project-loader/loader-components/AdminFloors";
import AdminGrid from "@/components/project-loader/loader-components/AdminGrid";
import AdminLights from "@/components/project-loader/loader-components/AdminLights";
import AdminWalls from "@/components/project-loader/loader-components/AdminWalls";
import AdminWindows from "@/components/project-loader/loader-components/AdminWindows";
import AdminCamera from "@/components/project-loader/loader-components/AdminCamera";
import type { ManagedStructure, StructureWall } from "./structureTypes";
import type { RoomPreviewGeometry } from "./structureGeometry";
import { wallLength, wallSurfaceArea } from "./structureGeometry";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import type { BuildElementPlacementCandidate } from "./buildElementPlacement";
import AdminBuildElementPreview, { AdminOpeningPreview } from "./AdminBuildElementPreview";
import AdminBlueprintPlane from "./AdminBlueprintPlane";

interface AdminStructureSceneProps {
    structure: ManagedStructure;
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
    onDoorSelect?: (doorId: string) => void;
    onWindowSelect?: (windowId: string) => void;
    selectedElement?: { kind: "door" | "window"; id: string } | null;
    onMoveSelectedElement?: () => void;
    onDuplicateSelectedElement?: () => void;
    onRemoveSelectedElement?: () => void;
    hiddenDoorId?: string | null;
    hiddenWindowId?: string | null;
    movingElement?: { kind: "door" | "window"; id: string } | null;
    onBuildElementPreviewReady?: () => void;
    onScenePoint?: (point: { x: number; y: number; z: number }) => void;
    onScenePointerMove?: (point: { x: number; y: number; z: number; wallId?: string } | null) => void;
    onCancelDrawing?: () => void;
    onCancelPlacement?: () => void;
    onWallClick?: (wallId: string, point: Vector3) => void;
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
    showWallMeasurements = true,
    buildElementAsset = null,
    buildElementPlacement = null,
    onAssetModelBounds,
    drawingActive = false,
    placementActive = false,
    onDoorSelect,
    onWindowSelect,
    selectedElement = null,
    onMoveSelectedElement,
    onDuplicateSelectedElement,
    onRemoveSelectedElement,
    hiddenDoorId = null,
    hiddenWindowId = null,
    movingElement = null,
    onBuildElementPreviewReady,
    onScenePoint,
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
        ? (selectedElement.kind === "door" ? structure.doors : structure.windows)
            .find(element => element.id === selectedElement.id) ?? null
        : null;

    const toolbarPosition = selectedElementData
        ? [
            selectedElementData.position.x,
            selectedElementData.position.y + selectedElementData.height * 0.5,
            selectedElementData.position.z
        ] as [number, number, number]
        : null;

    const handleSceneClick = (event: ThreeEvent<MouseEvent>) => {
        if (!onScenePoint || event.nativeEvent.button !== 0) return;
        event.stopPropagation();
        onScenePoint({
            x: event.point.x,
            y: event.point.y,
            z: event.point.z
        });
    };

    const handleScenePointerMove = (event: ThreeEvent<PointerEvent>) => {
        onScenePointerMove?.({
            x: event.point.x,
            y: event.point.y,
            z: event.point.z
        });
    };

    const handleWallPointerMove = (wallId: string, point: Vector3) => {
        onScenePointerMove?.({
            x: point.x,
            y: point.y,
            z: point.z,
            wallId
        });
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
                <AdminCamera leftOrbitEnabled={!blueprintUrl || blueprintLocked} />
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
                    corners={corners}
                    walls={walls}
                    floorFinishes={structure.floorFinishes}
                    selectedRegionId={selectedRegionId}
                    onSelectRegion={selectionEnabled ? onFloorSelect : undefined}
                    allowInteractionPropagation={!selectionEnabled}
                    showAreaLabels={false}
                />
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
                    onWallClick={onWallClick}
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
                                title={`Move ${selectedElement.kind}`}
                                aria-label={`Move ${selectedElement.kind}`}
                            >
                                <Move size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={onDuplicateSelectedElement}
                                title={`Duplicate ${selectedElement.kind}`}
                                aria-label={`Duplicate ${selectedElement.kind}`}
                            >
                                <Copy size={18} />
                            </button>
                            <button
                                type="button"
                                className="delete"
                                onClick={onRemoveSelectedElement}
                                title={`Remove ${selectedElement.kind}`}
                                aria-label={`Remove ${selectedElement.kind}`}
                            >
                                <Trash2 size={18} />
                            </button>
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
