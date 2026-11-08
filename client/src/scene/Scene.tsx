import {
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    Canvas,
    useFrame
} from "@react-three/fiber";

import {
    useParams
} from "react-router-dom";
import {
    getRegionWallFinishAssignments,
    getRegionWallSide
} from "../engine/walls/WallFinishUtils";
import { solveRegions } from "../engine/regions/RegionSolver";
import type { PaintApplyTarget } from "./PaintApplyTarget";

import Camera
    from "./Camera";

import Lights
    from "./Lights";

import Grid
    from "./Grid";

import Walls
    from "./Walls/Walls";

import WallMeasurements
    from "./Walls/WallMeasurement";

import ClearSelection
    from "./ClearSelection";

import Floors
    from "./Floors/Floors";

import Roof
    from "./Roof/Roof";
import { RoofAssetGate } from "./Roof/Roof";

import AssetPreview
    from "./Build/AssetPreview";

import BuildInteractionEvents
    from "./Build/BuildInteractionEvents";

import WalkthroughController
    from "./Walkthrough/WalkthroughController";

import Doors
    from "./Doors/Doors";

import Windows
    from "./Windows/Windows";
import Stairs
    from "./Stairs/Stairs";

import SelectionInteractionEvents
    from "./SelectionInteractionEvents";

import FurnitureScene
    from "./Furniture/FurnitureScene";

import FurniturePreview
    from "./Furniture/FurniturePreview";

import SelectionToolbar
    from "./SelectionToolbar";

import BlueprintScene
    from "./Blueprint/BlueprintScene";

import FurnitureInteractionEvents
    from "./Furniture/FurnitureInteractionEvents";
import ModelErrorBoundary
    from "./ModelErrorBoundary";

import useEditor
    from "../context/editor/useEditor";

import AdminCommentMarkers
    from "./Comment/AdminCommentMarkers";

import {
    subscribeToAdminComments,
    type AdminComment
} from "../services/adminCommentService";

import {
    getActiveProjectDeadline,
    isDeadlinePassed,
    isValidProjectDeadline,
    subscribeToProjectDeadline
} from "../services/projectDeadlineService";

const PAINT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent([
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<path d="M13 18 24 7" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>',
    '<path d="M13 18 24 7" fill="none" stroke="#17202b" stroke-width="4" stroke-linecap="round"/>',
    '<path d="m13 18-3.5 1.5L4 28l8-3.5 4-4z" fill="#f3b63f" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>',
    '<path d="m13 18-3.5 1.5L4 28l8-3.5 4-4z" fill="#f3b63f" stroke="#17202b" stroke-width="1.8" stroke-linejoin="round"/>',
    '<path d="m11 20 4 4" fill="none" stroke="#ffffff" stroke-width="5"/>',
    '<path d="m11 20 4 4" fill="none" stroke="#17202b" stroke-width="2"/>',
    "</svg>"
].join(""))}") 4 28, auto`;

//==================================================
// PROPS
//==================================================

interface SceneProps {
    onSpawnConfirmed:
        (
            confirmed: boolean
        ) => void;

    walkthroughSpawnConfirmed:
        boolean;

    onSceneReady?: () => void;
}

//==================================================
// FORMAT PROJECT DEADLINE
//==================================================

function formatDeadlineDate(
    deadline: string
): string {
    const [
        year,
        month,
        day
    ] = deadline
        .split("-")
        .map(Number);

    return new Date(
        year,
        month - 1,
        day
    ).toLocaleDateString(
        "en-US",
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );
}

//==================================================
// SCENE READY SIGNAL
//
// Runs inside the Canvas. Signals readiness after
// two rendered frames.
//==================================================

function SceneReadySignal({
    onReady
}: {
    onReady?: () => void;
}) {
    const renderedFrames =
        useRef(0);

    const notified =
        useRef(false);

    useFrame(() => {
        if (notified.current) {
            return;
        }

        renderedFrames.current += 1;

        if (
            renderedFrames.current >= 2
        ) {
            notified.current = true;

            onReady?.();
        }
    });

    return null;
}

//==================================================
// SCENE
//==================================================

export default function Scene({
    onSpawnConfirmed,
    walkthroughSpawnConfirmed,
    onSceneReady
}: SceneProps) {
    const {
        state,
        dispatch
    } = useEditor();
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [roomApplyPopup, setRoomApplyPopup] = useState<{
        target: PaintApplyTarget;
        left: number;
        top: number;
    } | null>(null);

    const regions = useMemo(
        () => solveRegions(state.corners, state.walls),
        [state.corners, state.walls]
    );
    const paintModeActive = Boolean(
        state.activeFloorMaterialId || state.activeWallMaterialId
    );

    const handlePaintApplied = (target: PaintApplyTarget) => {
        const bounds = viewportRef.current?.getBoundingClientRect();
        if (!bounds) {
            return;
        }

        setRoomApplyPopup({
            target,
            left: Math.max(
                8,
                Math.min(bounds.width - 128, target.clientX - bounds.left + 24)
            ),
            top: Math.max(
                8,
                Math.min(bounds.height - 42, target.clientY - bounds.top)
            )
        });
    };

    const applyMaterialToRoom = () => {
        if (!roomApplyPopup) {
            return;
        }

        const { target } = roomApplyPopup;
        const room = regions.find(region => region.id === target.regionId);
        if (!room) {
            setRoomApplyPopup(null);
            return;
        }

        if (target.kind === "floor") {
            dispatch({
                type: "SET_FLOOR_FINISH",
                payload: {
                    regionId: target.regionId,
                    materialId: target.materialId
                }
            });
            setRoomApplyPopup(null);
            return;
        }

        const clickedWall = state.walls.find(wall => wall.id === target.wallId);
        const roomSide = clickedWall
            ? getRegionWallSide(clickedWall, room)
            : null;
        if (roomSide === null) {
            setRoomApplyPopup(null);
            return;
        }

        const assignments = roomSide === target.side
            ? getRegionWallFinishAssignments([room], target.materialId)
            : room.walls.flatMap(wall => {
                const insideSide = getRegionWallSide(wall, room);
                if (insideSide === null) {
                    return [];
                }

                const outsideSide: 1 | -1 = insideSide === 1 ? -1 : 1;
                const outsideIsAnotherRoom = regions.some(otherRoom =>
                    otherRoom.id !== room.id &&
                    otherRoom.walls.some(otherWall => otherWall.id === wall.id) &&
                    getRegionWallSide(wall, otherRoom) === outsideSide
                );
                return outsideIsAnotherRoom
                    ? []
                    : [{
                        wallId: wall.id,
                        materialId: target.materialId,
                        side: outsideSide
                    }];
            });

        if (assignments.length > 0) {
            dispatch({
                type: "SET_WALL_FINISHES",
                payload: assignments
            });
        }
        setRoomApplyPopup(null);
    };

    useEffect(() => {
        if (!roomApplyPopup) {
            return;
        }
        const timeout = window.setTimeout(
            () => setRoomApplyPopup(null),
            4000
        );
        return () => window.clearTimeout(timeout);
    }, [roomApplyPopup]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        canvas.style.cursor = paintModeActive ? PAINT_CURSOR : "";
        return () => {
            canvas.style.cursor = "";
        };
    }, [paintModeActive]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            setRoomApplyPopup(null);
            if (event.button === 2) {
                dispatch({
                    type: "SET_ACTIVE_FLOOR_MATERIAL",
                    payload: null
                });
                dispatch({
                    type: "SET_ACTIVE_WALL_MATERIAL",
                    payload: null
                });
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setRoomApplyPopup(null);
            }
        };

        canvas.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            canvas.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [dispatch]);

    const {
        projectId
    } = useParams<{
        projectId?: string;
    }>();

    const [
        comments,
        setComments
    ] = useState<AdminComment[]>([]);
    const [showSeparatorReminder, setShowSeparatorReminder] = useState(false);

    useEffect(() => {
        if (!state.wallSeparatorPlacement) {
            setShowSeparatorReminder(false);
            return;
        }
        setShowSeparatorReminder(true);
        const timer = window.setTimeout(
            () => setShowSeparatorReminder(false),
            4500
        );
        return () => window.clearTimeout(timer);
    }, [
        state.wallSeparatorPlacement,
        state.wallSeparatorPlacementVersion
    ]);

    //==================================================
    // PROJECT DEADLINE
    //==================================================

    const [
        projectDeadline,
        setProjectDeadline
    ] = useState<string | null>(
        getActiveProjectDeadline()
    );

    const [
        deadlinePassed,
        setDeadlinePassed
    ] = useState(
        isDeadlinePassed(
            getActiveProjectDeadline()
        )
    );

    //==================================================
    // WATCH PROJECT DEADLINE
    //==================================================

    useEffect(() => {
        const updateDeadline = () => {
            const currentDeadline =
                getActiveProjectDeadline();

            setProjectDeadline(
                currentDeadline
            );

            setDeadlinePassed(
                isDeadlinePassed(
                    currentDeadline
                )
            );
        };

        updateDeadline();

        const unsubscribe =
            subscribeToProjectDeadline(
                updateDeadline
            );

        // Refresh the reminder if the deadline
        // passes while the project remains open.
        const timer = window.setInterval(
            updateDeadline,
            15_000
        );

        return () => {
            unsubscribe();

            window.clearInterval(
                timer
            );
        };
    }, []);

    //==================================================
    // ADMIN COMMENTS
    //==================================================

    useEffect(() => {
        if (!projectId) {
            setComments([]);

            return;
        }

        return subscribeToAdminComments(
            projectId,
            setComments,
            error => {
                console.error(
                    "Failed to load admin comments:",
                    error
                );
            }
        );
    }, [
        projectId
    ]);

    //==================================================
    // RENDER
    //==================================================

    return (
        <div
            ref={viewportRef}
            onPointerDownCapture={event => {
                if (
                    !(event.target instanceof Element) ||
                    !event.target.closest("[data-apply-to-room]")
                ) {
                    setRoomApplyPopup(null);
                }
            }}
            style={{
                position: "relative",
                width: "100%",
                height: "100%"
            }}
        >
            <Canvas
                onCreated={({ gl }) => {
                    canvasRef.current = gl.domElement;
                    gl.domElement.style.cursor = paintModeActive
                        ? PAINT_CURSOR
                        : "";
                }}
                shadows="percentage"
                gl={{
                    preserveDrawingBuffer: true
                }}
                camera={{
                    position: [
                        8,
                        8,
                        8
                    ],
                    fov: 50
                }}
                style={{
                    width: "100%",
                    height: "100%",
                    background: "#ffffff"
                }}
            >
                <color
                    attach="background"
                    args={[
                        "#ffffff"
                    ]}
                />

                {/* Camera and room rendering */}

                <Suspense fallback={null}>
                <ModelErrorBoundary assetId="walkthrough-roof-assets">
                    <RoofAssetGate />
                </ModelErrorBoundary>
                <Lights
                    walkthroughSpawnConfirmed={
                        walkthroughSpawnConfirmed
                    }
                />

                <Grid />

                <BlueprintScene />

                <Camera
                    adminComments={
                        comments
                    }
                />

                <Floors onPaintApplied={handlePaintApplied} />

                <Walls onPaintApplied={handlePaintApplied} />

                <Doors />

                <Windows />

                <Stairs />

                <FurnitureScene />

                {!state.walkthroughMode && (
    <AdminCommentMarkers
        comments={comments}
    />
)}

                {/* Walkthrough roof.
                    Wrapped in its own Suspense so loading the
                    ceiling assets can never block the rest of the
                    scene (including the spawn confirmation). */}

                {
                    state.walkthroughMode &&
                    walkthroughSpawnConfirmed && (
                        <Suspense
                            fallback={
                                null
                            }
                        >
                            <Roof />
                        </Suspense>
                    )
                }

                {/* Editing interactions */}

                {
                    !state.walkthroughMode && (
                        <>
                            <SelectionToolbar />

                            <ClearSelection />

                            <BuildInteractionEvents />

                            <WallMeasurements />

                            <AssetPreview />

                            <FurniturePreview />

                            <FurnitureInteractionEvents />

                            <SelectionInteractionEvents />
                        </>
                    )
                }

                {/* Walkthrough controller */}

                {
                    state.walkthroughMode && (
                        <WalkthroughController
                            onSpawnConfirmed={
                                onSpawnConfirmed
                            }
                        />
                    )
                }

                {/* Notify the editor after the scene renders. */}

                <SceneReadySignal
                    onReady={
                        onSceneReady
                    }
                />
                </Suspense>
            </Canvas>

            {roomApplyPopup && (
                <button
                    type="button"
                    data-apply-to-room
                    aria-label="Apply this material to the room"
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        applyMaterialToRoom();
                    }}
                    style={{
                        position: "absolute",
                        left: roomApplyPopup.left,
                        top: roomApplyPopup.top,
                        zIndex: 10001,
                        pointerEvents: "auto",
                        touchAction: "manipulation",
                        padding: "8px 11px",
                        border: "1px solid #D4DCE8",
                        borderRadius: "7px",
                        background: "#FFFFFF",
                        boxShadow: "0 3px 12px rgba(0, 0, 0, 0.18)",
                        color: "#202938",
                        fontSize: "12px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        cursor: "pointer"
                    }}
                >
                    Apply to room
                </button>
            )}

            {showSeparatorReminder && (
                <div
                    role="status"
                    style={{
                        position: "fixed",
                        top: "74px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 10000,
                        pointerEvents: "none",
                        padding: "8px 14px",
                        background: "rgba(255, 255, 255, 0.96)",
                        border: "1px solid #D9DEE8",
                        borderRadius: "8px",
                        color: "#252B36",
                        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.12)",
                        fontSize: "12px",
                        fontWeight: 600,
                        whiteSpace: "nowrap"
                    }}
                >
                    Place where you want the separator.
                </div>
            )}

            {/*==================================================
                PROJECT DEADLINE REMINDER
            ==================================================*/}

            {
                projectDeadline &&
                isValidProjectDeadline(projectDeadline) &&
                !deadlinePassed && (
                    <div
                        role="status"
                        style={{
                            position: "fixed",
                            top: "74px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 9999,
                            pointerEvents: "none",
                            maxWidth: "calc(100vw - 32px)",
                            padding: "7px 14px",
                            background: "#FFF8E9",
                            border: "1px solid #F1C98C",
                            borderRadius: "8px",
                            color: "#7A4B00",
                            boxShadow: "0 3px 10px rgba(0, 0, 0, 0.12)",
                            fontSize: "11px",
                            fontWeight: 600,
                            lineHeight: "16px",
                            textAlign: "center",
                            whiteSpace: "normal"
                        }}
                    >
                        You may edit until{" "}
                        {formatDeadlineDate(projectDeadline)}.
                    </div>
                )
            }
        </div>
    );
}