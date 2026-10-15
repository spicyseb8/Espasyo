
import {
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

import useEditor
    from "../context/editor/useEditor";

import AdminCommentMarkers
    from "./Comment/AdminCommentMarkers";

import {
    subscribeToAdminComments,
    type AdminComment
} from "../services/adminCommentService";

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
// SCENE READY SIGNAL
//==================================================
//
// This component runs inside the Canvas.
//
// It signals readiness after two rendered frames.
// If the scene is waiting for a Suspense-loaded model,
// this signal cannot run until that suspended content
// becomes available.
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
    ] = useState<
        AdminComment[]
    >([]);

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

        <Canvas
            shadows
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

            <AdminCommentMarkers
                comments={
                    comments
                }
            />

            {/* Walkthrough roof */}

            {
                state.walkthroughMode &&
                walkthroughSpawnConfirmed && (

                    <Roof />

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

        </Canvas>
    );
}
