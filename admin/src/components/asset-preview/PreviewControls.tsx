import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "./PreviewCamera";

export default function PreviewControls() {
  const controlsRef =
    useRef<OrbitControlsImpl>(null);

  const handleEnd = () => {
    const controls =
      controlsRef.current;

    if (!controls) {
      return;
    }

    const camera =
      controls.object;

    const startPos =
      camera.position.clone();

    const startTarget =
      controls.target.clone();

    const endPos = {
      x: DEFAULT_CAMERA_POSITION[0],
      y: DEFAULT_CAMERA_POSITION[1],
      z: DEFAULT_CAMERA_POSITION[2],
    };

    const endTarget = {
      x: DEFAULT_CAMERA_TARGET[0],
      y: DEFAULT_CAMERA_TARGET[1],
      z: DEFAULT_CAMERA_TARGET[2],
    };

    const duration = 450;

    const startTime =
      performance.now();

    const animate = (
      now: number
    ) => {
      const t = Math.min(
        (now - startTime) / duration,
        1
      );

      const eased =
        1 -
        Math.pow(
          1 - t,
          3
        );

      camera.position.set(
        startPos.x +
          (endPos.x - startPos.x) *
            eased,

        startPos.y +
          (endPos.y - startPos.y) *
            eased,

        startPos.z +
          (endPos.z - startPos.z) *
            eased
      );

      controls.target.set(
        startTarget.x +
          (endTarget.x - startTarget.x) *
            eased,

        startTarget.y +
          (endTarget.y - startTarget.y) *
            eased,

        startTarget.z +
          (endTarget.z - startTarget.z) *
            eased
      );

      controls.update();

      if (t < 1) {
        requestAnimationFrame(
          animate
        );
      }
    };

    requestAnimationFrame(
      animate
    );
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={false}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 2.1}
      target={DEFAULT_CAMERA_TARGET}
      onEnd={handleEnd}
    />
  );
}