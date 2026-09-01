import { Canvas } from "@react-three/fiber";

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

import Doors from "./Doors/Doors";
import Windows from "./Windows/Windows";

import FurnitureScene from "./Furniture/FurnitureScene";
import FurniturePreview
    from "./Furniture/FurniturePreview";
import BlueprintScene
    from "./Blueprint/BlueprintScene";
import FurnitureInteractionEvents
    from "./Furniture/FurnitureInteractionEvents";
export default function Scene() {

    return (

        <Canvas
        camera={{
            position: [0, 20, 0],
            fov: 50
        }}
    >

        <Lights />

        <Grid />

        <BlueprintScene />

        <Camera />

        <ClearSelection />

        <BuildInteractionEvents />

        <Floors />

        <Walls />

        <Doors />
        <Windows />

        <WallMeasurements />

        <AssetPreview />

        <WallDrawer />
         <FurnitureScene />
         <FurniturePreview />
        <FurnitureInteractionEvents />

    </Canvas>
            

    );

}