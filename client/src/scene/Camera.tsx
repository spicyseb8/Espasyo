import { OrbitControls } from "@react-three/drei";

export default function Camera() {
  return (
    <OrbitControls
      makeDefault
      target={[0, 0, 0]}
      enablePan={true}      // drag to move around the space (right-click / two-finger drag by default)
      enableZoom={true}     // scroll to zoom in/out
      enableRotate={true}   // drag to orbit/look around
      screenSpacePanning={false} // pan relative to screen, not just the ground plane — feels more "free"
      minDistance={2}       // optional: stop the user zooming inside geometry
      maxDistance={100}     // optional: stop them zooming out to infinity
    />
  );
}