import {
    useEffect,
    useState
} from "react";
import {
    Canvas
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

interface SceneProps {
    onSpawnConfirmed:
        (
            confirmed:
                boolean
        ) => void;
    walkthroughSpawnConfirmed:
        boolean;
}

export default function Scene({
    onSpawnConfirmed,
    walkthroughSpawnConfirmed
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

    return (
        <Canvas
            shadows
            camera={{
                position: [
                    8,
                    8,
                    8
                ],
                fov:
                    50
            }}
            style={{
                width:
                    "100%",
                height:
                    "100%"
            }}
        >
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

            {state.walkthroughMode &&
                walkthroughSpawnConfirmed && (
                    <Roof />
                )}

            {!state.walkthroughMode && (
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
            )}

            {state.walkthroughMode && (
                <WalkthroughController
                    onSpawnConfirmed={
                        onSpawnConfirmed
                    }
                />
            )}
        </Canvas>
    );
}