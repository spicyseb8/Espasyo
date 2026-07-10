import { Grid } from "@react-three/drei";

export default function SceneGrid() {
  return (
    <Grid
      args={[100, 100]}
      cellSize={1}
      cellThickness={1}
      sectionSize={4}
      sectionThickness={1}
      infiniteGrid
      fadeDistance={50}
    />
  );
}