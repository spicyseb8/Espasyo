import { Grid } from "@react-three/drei";

export default function SceneGrid() {
  return (
   <Grid
    position={[0, -0.01, 0]}
    args={[60, 60]}
    cellSize={1}
    cellThickness={1}
    sectionSize={4}
    sectionThickness={1}
    infiniteGrid = {false}
    fadeDistance={40}
/>
  );
}