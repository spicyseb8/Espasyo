import { Canvas } from "@react-three/fiber";
import Camera from "./Camera";
import Lights from "./Lights";
import Grid from "./Grid";
import WallDrawer from "./WallDrawer/WallDrawer";

export default function Scene() {
  return (
    <Canvas 
      camera={{
        position: [0, 12, 0],
        fov: 50,
      }}
    >
      <WallDrawer />
      <Lights />
      <Grid />
      <Camera />
    </Canvas>
  );
}