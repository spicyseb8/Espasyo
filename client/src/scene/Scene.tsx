import {
    Canvas
} from "@react-three/fiber";

import Camera from "./Camera";
import Lights from "./Lights";
import Grid from "./Grid";

import Walls from "./Walls/Walls";
import WallMeasurements from "./Walls/WallMeasurement";
import WallDrawer from "./WallDrawer/WallDrawer";

import ClearSelection from "./ClearSelection";
import Floors from "./Floors/Floors";

import AssetPreview from "./Build/AssetPreview";
import BuildInteractionEvents from "./Build/BuildInteractionEvents";

import WalkthroughController
    from "./Walkthrough/WalkthroughController";

import Doors from "./Doors/Doors";
import Windows from "./Windows/Windows";

import FurnitureScene
    from "./Furniture/FurnitureScene";

import FurniturePreview
    from "./Furniture/FurniturePreview";

import BlueprintScene
    from "./Blueprint/BlueprintScene";

import FurnitureInteractionEvents
    from "./Furniture/FurnitureInteractionEvents";

import useEditor
    from "../context/editor/useEditor";


export default function Scene() {

    const {
        state
    } = useEditor();


    return (

        <Canvas
            camera={{
                position: [0, 20, 0],
                fov: 50
            }}
        >

            {/*==================================================
                BASIC SCENE
            ==================================================*/}

            <Lights />

            <Grid />

            <BlueprintScene />

            <Camera />


            {/*==================================================
                ACTUAL SCENE OBJECTS

                These stay visible during walkthrough.
            ==================================================*/}

            <Floors />

            <Walls />

            <Doors />

            <Windows />

            <FurnitureScene />


            {/*==================================================
                NORMAL EDITOR INTERACTIONS

                Completely disabled during walkthrough.
            ==================================================*/}

            {!state.walkthroughMode && (
                <>

                    <ClearSelection />

                    <BuildInteractionEvents />

                    <WallMeasurements />

                    <AssetPreview />

                    <WallDrawer />

                    <FurniturePreview />

                    <FurnitureInteractionEvents />

                </>
            )}


            {/*==================================================
                WALKTHROUGH MODE

                Only active while walkthrough is enabled.
            ==================================================*/}

            {state.walkthroughMode && (
                <WalkthroughController />
            )}

        </Canvas>

    );

}