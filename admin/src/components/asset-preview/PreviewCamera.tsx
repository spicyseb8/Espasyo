import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export const DEFAULT_CAMERA_POSITION: [
  number,
  number,
  number
] = [6, 5.5, 6];

export const DEFAULT_CAMERA_TARGET: [
  number,
  number,
  number
] = [0, 1.2, 0];

export default function PreviewCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(
      ...DEFAULT_CAMERA_POSITION
    );

    camera.lookAt(
      ...DEFAULT_CAMERA_TARGET
    );

    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}