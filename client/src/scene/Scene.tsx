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

import FurnitureScene from "./Furniture/FurnitureScene";

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

        <Camera />

        <ClearSelection />

        <BuildInteractionEvents />

        <Floors />

        <Walls />

        <Doors />
        

        <WallMeasurements />

        <AssetPreview />

        <WallDrawer />
         <FurnitureScene />

    </Canvas>
            

    );

}