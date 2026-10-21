import {
    Suspense,
    useEffect,
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

import WallDrawer
    from "./WallDrawer/WallDrawer";

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
        state
    } = useEditor();

    const {
        projectId
    } = useParams<{
        projectId?: string;
    }>();

    const [
        comments,
        setComments
    ] = useState<AdminComment[]>([]);

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
            style={{
                position: "relative",
                width: "100%",
                height: "100%"
            }}
        >
            <Canvas
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
                <Lights />

                <Grid />

                <BlueprintScene />

                <Camera
                    adminComments={
                        comments
                    }
                />

                <Floors />

                <Walls />

                <Doors />

                <Windows />

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

                            <WallDrawer />

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