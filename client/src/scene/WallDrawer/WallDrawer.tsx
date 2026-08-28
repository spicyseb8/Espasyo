import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, Plane, Raycaster, Vector3 } from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useEditor from "../../context/editor/useEditor";
import { Tool } from "../../context/editor/tools";
import type { Wall } from "../../engine/walls/WallTypes";
import { BuildTool } from "../../context/BuildTool";

import PreviewWall from "../Preview/PreviewWall";
import WallMeasurement from "../Preview/WallMeasurement";
import type { MeasurementGroup } from "../../engine/walls/Measurement";

import AlignmentGuides from "../Guides/AlignmentGuides";
import CornerHighlight from "../Corners/CornerHighlight";

import {
    snapToGrid,
    snap90Degrees,
    snapToWall,
    snapToWallEndpoint
} from "../../engine/walls/wallSnapping";

import { getAlignmentGuides } from "../../engine/walls/Alignment";

import { placeWall } from "../../engine/walls/PlaceWalls";

import { hitWallByRaycast } from "../../engine/walls/wallHit";

const raycaster = new Raycaster();

const groundPlane = new Plane(
    new Vector3(0, 1, 0),
    0
);

function getRoomRectangle(start: Vector3, end: Vector3): Vector3[] {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    return [
        new Vector3(minX, 0, minZ),
        new Vector3(maxX, 0, minZ),
        new Vector3(maxX, 0, maxZ),
        new Vector3(minX, 0, maxZ)
    ];
}

function polygonBounds(points: Vector3[]) {
    const xs = points.map(point => point.x);
    const zs = points.map(point => point.z);

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
    };
}

function isHorizontalWall(wall: Wall) {
    return Math.abs(wall.end.position.x - wall.start.position.x) > 0.001 &&
        Math.abs(wall.end.position.z - wall.start.position.z) < 0.001;
}

function isVerticalWall(wall: Wall) {
    return Math.abs(wall.end.position.z - wall.start.position.z) > 0.001 &&
        Math.abs(wall.end.position.x - wall.start.position.x) < 0.001;
}

function segmentOverlapsWall(start: Vector3, end: Vector3, wall: Wall, tolerance = 0.05): boolean {
    const horizontal = Math.abs(start.z - end.z) < tolerance;
    const vertical = Math.abs(start.x - end.x) < tolerance;

    if (!horizontal && !vertical) {
        return false;
    }

    const wallHorizontal = isHorizontalWall(wall);
    const wallVertical = isVerticalWall(wall);

    if (horizontal && !wallHorizontal) {
        return false;
    }

    if (vertical && !wallVertical) {
        return false;
    }

    const edgeX1 = Math.min(start.x, end.x);
    const edgeX2 = Math.max(start.x, end.x);
    const edgeZ1 = Math.min(start.z, end.z);
    const edgeZ2 = Math.max(start.z, end.z);

    const wallX1 = Math.min(wall.start.position.x, wall.end.position.x);
    const wallX2 = Math.max(wall.start.position.x, wall.end.position.x);
    const wallZ1 = Math.min(wall.start.position.z, wall.end.position.z);
    const wallZ2 = Math.max(wall.start.position.z, wall.end.position.z);

    const sameX = Math.abs(start.x - wall.start.position.x) < tolerance && Math.abs(end.x - wall.end.position.x) < tolerance;
    const sameZ = Math.abs(start.z - wall.start.position.z) < tolerance && Math.abs(end.z - wall.end.position.z) < tolerance;

    if (horizontal && Math.abs(start.z - wall.start.position.z) < tolerance) {
        const overlapStart = Math.max(edgeX1, wallX1);
        const overlapEnd = Math.min(edgeX2, wallX2);
        if (overlapEnd - overlapStart > tolerance || sameX) {
            return true;
        }
    }

    if (vertical && Math.abs(start.x - wall.start.position.x) < tolerance) {
        const overlapStart = Math.max(edgeZ1, wallZ1);
        const overlapEnd = Math.min(edgeZ2, wallZ2);
        if (overlapEnd - overlapStart > tolerance || sameZ) {
            return true;
        }
    }

    return false;
}

function clipRoomByExistingWalls(room: Vector3[], walls: Wall[]): Vector3[][] {
    let rooms: Vector3[][] = [room];

    for (const wall of walls) {
        const nextRooms: Vector3[][] = [];

        for (const currentRoom of rooms) {
            const bounds = polygonBounds(currentRoom);
            const wallX = wall.start.position.x;
            const wallZ = wall.start.position.z;

            if (isVerticalWall(wall)) {
                const xInside = wallX > bounds.minX + 0.05 && wallX < bounds.maxX - 0.05;
                const zOverlaps = wall.start.position.z >= bounds.minZ - 0.05 && wall.start.position.z <= bounds.maxZ + 0.05;
                if (!xInside || !zOverlaps) {
                    nextRooms.push(currentRoom);
                    continue;
                }

                const leftRoom = [
                    new Vector3(bounds.minX, 0, bounds.minZ),
                    new Vector3(wallX, 0, bounds.minZ),
                    new Vector3(wallX, 0, bounds.maxZ),
                    new Vector3(bounds.minX, 0, bounds.maxZ)
                ];

                const rightRoom = [
                    new Vector3(wallX, 0, bounds.minZ),
                    new Vector3(bounds.maxX, 0, bounds.minZ),
                    new Vector3(bounds.maxX, 0, bounds.maxZ),
                    new Vector3(wallX, 0, bounds.maxZ)
                ];

                nextRooms.push(leftRoom, rightRoom);
            } else if (isHorizontalWall(wall)) {
                const zInside = wallZ > bounds.minZ + 0.05 && wallZ < bounds.maxZ - 0.05;
                const xOverlaps = wall.start.position.x >= bounds.minX - 0.05 && wall.start.position.x <= bounds.maxX + 0.05;
                if (!zInside || !xOverlaps) {
                    nextRooms.push(currentRoom);
                    continue;
                }

                const topRoom = [
                    new Vector3(bounds.minX, 0, bounds.minZ),
                    new Vector3(bounds.maxX, 0, bounds.minZ),
                    new Vector3(bounds.maxX, 0, wallZ),
                    new Vector3(bounds.minX, 0, wallZ)
                ];

                const bottomRoom = [
                    new Vector3(bounds.minX, 0, wallZ),
                    new Vector3(bounds.maxX, 0, wallZ),
                    new Vector3(bounds.maxX, 0, bounds.maxZ),
                    new Vector3(bounds.minX, 0, bounds.maxZ)
                ];

                nextRooms.push(topRoom, bottomRoom);
            } else {
                nextRooms.push(currentRoom);
            }
        }

        rooms = nextRooms.length > 0 ? nextRooms : rooms;
    }

    return rooms;
}

function getRoomDimensions(start: Vector3, end: Vector3) {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.z - start.z);

    return {
        width,
        height,
        area: width * height
    };
}

/**
 * Builds a MeasurementGroup for a wall that is still being drawn (i.e.
 * doesn't exist in state.walls yet), so the live preview can reuse the
 * same "painted on the wall" WallMeasurement component as placed walls.
 */
function buildLiveMeasurement(start: Vector3, end: Vector3, height: number, thickness: number): MeasurementGroup {
    const length = start.distanceTo(end);
    const direction = length > 0.0001
        ? end.clone().sub(start).normalize()
        : new Vector3(1, 0, 0);
    const normal = new Vector3(-direction.z, 0, direction.x);
    const center = start.clone().add(end).multiplyScalar(0.5);

    return {
        id: "preview",
        start: start.clone(),
        end: end.clone(),
        length,
        area: length * height,
        center,
        direction,
        normal,
        height,
        thickness,
        walls: []
    };
}

/**
 * Bakes a short label into a canvas texture - same "painted on" look as
 * Floor.tsx / WallMeasurement.tsx, reused here for the Room tool's live
 * width/height/area readout instead of a floating DOM tooltip.
 */
function useLabelTexture(text: string) {
    const texture = useMemo(() => {
        if (!text) return null;

        const canvas = document.createElement("canvas");
        const size = 1024;
        canvas.width = size;
        canvas.height = 512;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.clearRect(0, 0, size, 512);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "800 220px Arial";
        ctx.lineJoin = "round";

        ctx.lineWidth = 20;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.strokeText(text, size / 2, 256);

        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.fillText(text, size / 2, 256);

        const newTexture = new CanvasTexture(canvas);
        newTexture.needsUpdate = true;
        return newTexture;
    }, [text]);

    // CRITICAL: this hook is called for width/height/area labels that
    // update on nearly every frame while the Room tool is being dragged.
    // Without disposing the previous texture on each change, this leaks
    // three GPU textures per frame and exhausts VRAM in seconds, crashing
    // the WebGL context ("Context Lost").
    useEffect(() => {
        return () => {
            texture?.dispose();
        };
    }, [texture]);

    return texture;
}

interface RoomLabelProps {
    texture: CanvasTexture | null;
    position: [number, number, number];
    width: number;
    height: number;
}

function RoomLabel({ texture, position, width, height }: RoomLabelProps) {
    if (!texture) return null;

    return (
        <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={texture}
                transparent
                depthWrite={false}
                alphaTest={0.05}
                side={DoubleSide}
            />
        </mesh>
    );
}

export default function WallDrawer() {
    const { state, dispatch } = useEditor();
    const { camera, pointer, gl, scene } = useThree();

    const mouseDown = useRef({
        x: 0,
        y: 0
    });

    const moved = useRef(false);
    const pointerButton = useRef(0);
    const startedOnCanvas = useRef(false);
    const isClick = useRef(false); // Track if it's a click (not drag)

    const [startPoint, setStartPoint] = useState<Vector3 | null>(null);
    const [roomStartPoint, setRoomStartPoint] = useState<Vector3 | null>(null);
    const currentPoint = useRef(new Vector3());
    const guides = useRef<ReturnType<typeof getAlignmentGuides>>([]);
    const [, forceUpdate] = useState(0);

    // Track if we're currently drawing (to prevent conflicts with camera)
    const isDrawing = useRef(false);

    // Last value pushed to global state via SET_DRAFT_WALL_LENGTH, so we
    // only dispatch when the rounded (displayed) length actually changes -
    // not on every frame.
    const lastDraftLength = useRef<number | null>(null);

    // useFrame (below) returns early whenever the tool isn't Wall/Room, so
    // it can't be relied on to clear the draft length when switching away
    // from the Wall tool. This effect guarantees it's cleared in that case
    // and on unmount.
    useEffect(() => {
        if (state.activeTool !== Tool.Wall && lastDraftLength.current !== null) {
            lastDraftLength.current = null;
            dispatch({ type: "SET_DRAFT_WALL_LENGTH", payload: null });
        }

        return () => {
            if (lastDraftLength.current !== null) {
                lastDraftLength.current = null;
                dispatch({ type: "SET_DRAFT_WALL_LENGTH", payload: null });
            }
        };
    }, [state.activeTool, dispatch]);

    //----------------------------------------------------
    // Mouse Position - Keep this as is
    //----------------------------------------------------
    useFrame(() => {
        if (
            state.activeTool !== Tool.Wall &&
            state.activeTool !== Tool.Room
        ) {
            return;
        }

        raycaster.setFromCamera(pointer, camera);

        const wallHit = hitWallByRaycast(
            raycaster,
            scene.children,
            state.walls
        );

        let point: Vector3;

        if (wallHit) {
            point = wallHit.point;
        } else {
            point = new Vector3();
            raycaster.ray.intersectPlane(groundPlane, point);
        }

        let snapped = point.clone();

        if (state.snapEnabled) {
            snapped = snapToGrid(snapped, state.gridSize);
        }

        snapped = snapToWallEndpoint(snapped, state.walls);
        snapped = snapToWall(snapped, state.walls);

        if (state.activeTool === Tool.Wall && startPoint) {
            snapped = snap90Degrees(startPoint, snapped);
        }

        currentPoint.current.copy(snapped);

        if (state.activeTool === Tool.Wall) {
            guides.current = getAlignmentGuides(snapped, state.corners);
        } else {
            guides.current = [];
        }

        // Push the live length to global state so FloorPlanPanel can show
        // it while the wall is being dragged out. Only dispatches when the
        // rounded value actually changes, and clears back to null the
        // moment we're not actively dragging a wall.
        //
        // NOTE: this assumes a "SET_DRAFT_WALL_LENGTH" action exists in
        // your editor reducer (payload: number | null). If your reducer
        // uses a strict discriminated-union action type, add this case
        // there too - otherwise this dispatch will just be ignored.
        if (state.activeTool === Tool.Wall && startPoint) {
            const draftLength = Math.round(startPoint.distanceTo(currentPoint.current) * 100) / 100;

            if (lastDraftLength.current !== draftLength) {
                lastDraftLength.current = draftLength;
                dispatch({ type: "SET_DRAFT_WALL_LENGTH", payload: draftLength });
            }
        } else if (lastDraftLength.current !== null) {
            lastDraftLength.current = null;
            dispatch({ type: "SET_DRAFT_WALL_LENGTH", payload: null });
        }

        forceUpdate(v => v + 1);
    });

    //----------------------------------------------------
    // Mouse Down - Only for drawing, not camera
    //----------------------------------------------------
    const handlePointerDown = useCallback((e: PointerEvent) => {

        if (
    state.buildTool === BuildTool.Door ||
    state.buildTool === BuildTool.Window ||
    state.buildTool === BuildTool.Opening
) {
    return;
}
        mouseDown.current = {
            x: e.clientX,
            y: e.clientY
        };

        moved.current = false;
        pointerButton.current = e.button;
        isClick.current = true;

        // Check if event started on canvas
        const target = e.target as Node | null;
        startedOnCanvas.current = 
            target !== null &&
            (target === gl.domElement || gl.domElement.contains(target));

        // Don't handle if not on canvas
        if (!startedOnCanvas.current) return;

        // Only handle left click (button 0) for drawing
        // Right click (button 2) will be handled by pointerup
        // Middle click (button 1) is ignored for drawing
        if (e.button === 0 || e.button === 2) {
            // Store that drawing might start
            isDrawing.current = true;
        }
    }, [gl]);

    //----------------------------------------------------
    // Mouse Move - Track if it's a drag vs click
    //----------------------------------------------------
    const handlePointerMove = useCallback((e: PointerEvent) => {
        const dx = e.clientX - mouseDown.current.x;
        const dy = e.clientY - mouseDown.current.y;

        if (Math.sqrt(dx * dx + dy * dy) > 5) {
            moved.current = true;
            isClick.current = false;
            // If user is dragging, cancel drawing
            isDrawing.current = false;
        }
    }, []);

    //----------------------------------------------------
    // Mouse Up - Drawing logic only
    //----------------------------------------------------
    const handlePointerUp = useCallback(() => {
        // Ignore if not started on canvas
        if (!startedOnCanvas.current) {
            isDrawing.current = false;
            return;
        }

        // Ignore if moved (it was a drag, not a click)
        if (moved.current || !isClick.current) {
            isDrawing.current = false;
            return;
        }

        // Only handle left and right click for drawing
        if (pointerButton.current === 2) {
            // Right click - toggle tool or cancel
            if (state.layoutConfirmed) {
                isDrawing.current = false;
                return;
            }

            if (state.activeTool === Tool.Room) {
                setRoomStartPoint(null);
                dispatch({
                    type: "SET_ACTIVE_TOOL",
                    payload: Tool.Select
                });
                guides.current = [];
                isDrawing.current = false;
                return;
            }

            dispatch({
                type: "SET_ACTIVE_TOOL",
                payload: state.activeTool === Tool.Wall ? Tool.Select : Tool.Wall
            });

            setStartPoint(null);
            guides.current = [];
            isDrawing.current = false;
            return;
        }

        // Only handle left click for drawing
        if (pointerButton.current !== 0) {
            isDrawing.current = false;
            return;
        }

        // --- Room Tool Logic ---
        if (state.activeTool === Tool.Room) {
            if (roomStartPoint === null) {
                setRoomStartPoint(currentPoint.current.clone());
                isDrawing.current = false;
                return;
            }

            const rect = getRoomRectangle(roomStartPoint, currentPoint.current);
            if (rect.length !== 4) {
                setRoomStartPoint(null);
                isDrawing.current = false;
                return;
            }

            let corners = [...state.corners];
            let walls = [...state.walls];
            const roomPolygons = clipRoomByExistingWalls(rect, walls);

            for (const polygon of roomPolygons) {
                for (let index = 0; index < polygon.length; index++) {
                    const nextIndex = (index + 1) % polygon.length;
                    const start = polygon[index];
                    const end = polygon[nextIndex];

                    const overlapsExistingWall = walls.some(wall =>
                        segmentOverlapsWall(start, end, wall)
                    );

                    if (overlapsExistingWall) {
                        continue;
                    }

                    const result = placeWall(
                        corners,
                        walls,
                        start,
                        end
                    );

                    corners = result.corners;
                    walls = result.walls;
                }
            }

            dispatch({ type: "SET_CORNERS", payload: corners });
            dispatch({ type: "SET_WALLS", payload: walls });
            setRoomStartPoint(null);
            isDrawing.current = false;
            return;
        }

        // --- Wall Tool Logic ---
        if (state.activeTool !== Tool.Wall) {
            isDrawing.current = false;
            return;
        }

        if (startPoint === null) {
            setStartPoint(currentPoint.current.clone());
            isDrawing.current = false;
            return;
        }

        const result = placeWall(
            state.corners,
            state.walls,
            startPoint,
            currentPoint.current
        );

        dispatch({
            type: "SET_CORNERS",
            payload: result.corners
        });

        dispatch({
            type: "SET_WALLS",
            payload: result.walls
        });

        if (result.shouldFinish) {
            setStartPoint(null);
        } else {
            setStartPoint(result.endCorner.position.clone());
        }

        isDrawing.current = false;
    }, [
        startPoint,
        state.activeTool,
        state.layoutConfirmed,
        state.corners,
        state.walls,
        roomStartPoint,
        dispatch
    ]);

    //----------------------------------------------------
    // Prevent context menu on canvas
    //----------------------------------------------------
    const handleContextMenu = useCallback((e: MouseEvent) => {
        const target = e.target as Node | null;
        const onCanvas = 
            target !== null &&
            (target === gl.domElement || gl.domElement.contains(target));

        if (onCanvas) e.preventDefault();
    }, [gl]);

    //----------------------------------------------------
    // Events - Only drawing events
    //----------------------------------------------------
    useEffect(() => {
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("contextmenu", handleContextMenu);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu]);

    //----------------------------------------------------
    // Render - Keep your existing render logic
    //----------------------------------------------------
    const ghostHalfLength = 0.10;
    const ghostStart = new Vector3(
        currentPoint.current.x - ghostHalfLength,
        0,
        currentPoint.current.z
    );
    const ghostEnd = new Vector3(
        currentPoint.current.x + ghostHalfLength,
        0,
        currentPoint.current.z
    );

    const roomRect = roomStartPoint ? getRoomRectangle(roomStartPoint, currentPoint.current) : null;
    const roomDimensions = roomStartPoint ? getRoomDimensions(roomStartPoint, currentPoint.current) : null;

    // Room tool live labels - painted onto the floor preview instead of
    // floating Html tooltips, matching Floor.tsx / WallMeasurement.tsx.
    const widthLabelText = roomDimensions ? `${roomDimensions.width.toFixed(2)} m` : "";
    const heightLabelText = roomDimensions ? `${roomDimensions.height.toFixed(2)} m` : "";
    const areaLabelText = roomDimensions ? `${roomDimensions.area.toFixed(2)} m²` : "";

    const widthTexture = useLabelTexture(widthLabelText);
    const heightTexture = useLabelTexture(heightLabelText);
    const areaTexture = useLabelTexture(areaLabelText);

    return (
        <>
            {state.activeTool === Tool.Wall && (
                <>
                    <AlignmentGuides guides={guides.current} />
                    <CornerHighlight guides={guides.current} />

                    {startPoint ? (
                        <>
                            <PreviewWall
                                start={startPoint}
                                end={currentPoint.current}
                                height={state.wallHeight}
                                thickness={state.wallThickness}
                            />
                            <WallMeasurement
                                measurement={buildLiveMeasurement(
                                    startPoint,
                                    currentPoint.current,
                                    state.wallHeight,
                                    state.wallThickness
                                )}
                            />
                        </>
                    ) : (
                        <PreviewWall
                            start={ghostStart}
                            end={ghostEnd}
                            height={state.wallHeight}
                            thickness={state.wallThickness}
                        />
                    )}
                </>
            )}

            {state.activeTool === Tool.Room && roomStartPoint && roomRect && roomDimensions && (
                <>
                    {roomRect.map((point, index) => {
                        const next = roomRect[(index + 1) % roomRect.length];
                        return (
                            <PreviewWall
                                key={`room-wall-${index}`}
                                start={point}
                                end={next}
                                height={state.wallHeight}
                                thickness={state.wallThickness}
                            />
                        );
                    })}

                    <mesh
                        position={[
                            (roomRect[0].x + roomRect[2].x) / 2,
                            0.02,
                            (roomRect[0].z + roomRect[2].z) / 2
                        ]}
                        rotation={[-Math.PI / 2, 0, 0]}
                    >
                        <planeGeometry args={[Math.max(roomDimensions.width, 0.1), Math.max(roomDimensions.height, 0.1)]} />
                        <meshStandardMaterial
                            color="#7ec8ff"
                            transparent
                            opacity={0.42}
                            side={DoubleSide}
                        />
                    </mesh>

                    {/* Width readout, painted near the top edge of the preview */}
                    <RoomLabel
                        texture={widthTexture}
                        position={[
                            (roomRect[0].x + roomRect[2].x) / 2,
                            0.03,
                            roomRect[0].z + (roomRect[2].z - roomRect[0].z) * 0.18
                        ]}
                        width={Math.max(roomDimensions.width * 0.55, 0.6)}
                        height={Math.max(roomDimensions.width * 0.55, 0.6) * 0.5}
                    />

                    {/* Height readout, painted near the right edge of the preview */}
                    <RoomLabel
                        texture={heightTexture}
                        position={[
                            roomRect[0].x + (roomRect[2].x - roomRect[0].x) * 0.82,
                            0.03,
                            (roomRect[0].z + roomRect[2].z) / 2
                        ]}
                        width={Math.max(roomDimensions.height * 0.55, 0.6)}
                        height={Math.max(roomDimensions.height * 0.55, 0.6) * 0.5}
                    />

                    {/* Area readout, painted at the center of the preview */}
                    <RoomLabel
                        texture={areaTexture}
                        position={[
                            (roomRect[0].x + roomRect[2].x) / 2,
                            0.035,
                            (roomRect[0].z + roomRect[2].z) / 2
                        ]}
                        width={Math.max(roomDimensions.width * 0.6, 0.9)}
                        height={Math.max(roomDimensions.width * 0.6, 0.9) * 0.4}
                    />
                </>
            )}
        </>
    );
}