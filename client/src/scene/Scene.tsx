import { Canvas } from "@react-three/fiber";

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


interface SceneProps {
    onSpawnConfirmed: (
        confirmed: boolean
    ) => void;

    walkthroughSpawnConfirmed: boolean;
}


export default function Scene({
    onSpawnConfirmed,
    walkthroughSpawnConfirmed
}: SceneProps) {

    const {
        state
    } = useEditor();

    return (
        <Canvas
            shadows
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
                height: "100%"
            }}
        >

            {/*==================================================
                SCENE LIGHTING
            ==================================================*/}
            <Lights />


            {/*==================================================
                EDITOR HELPERS
            ==================================================*/}
            <Grid />

            <BlueprintScene />


            {/*==================================================
                CAMERA
            ==================================================*/}
            <Camera />


            {/*==================================================
                MAIN HOUSE
            ==================================================*/}
            <Floors />

            <Walls />

            <Doors />

            <Windows />

            <FurnitureScene />


            {/*==================================================
                WALKTHROUGH ROOF
            ==================================================*/}
            {state.walkthroughMode &&
                walkthroughSpawnConfirmed && (
                    <Roof />
                )}


            {/*==================================================
                NORMAL EDITOR INTERACTION
            ==================================================*/}
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


            {/*==================================================
                WALKTHROUGH CONTROLLER
            ==================================================*/}
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