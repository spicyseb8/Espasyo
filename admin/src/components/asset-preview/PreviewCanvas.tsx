import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";

import type { Asset } from "@/services/assets/asset-types";

import PreviewCamera from "./PreviewCamera";
import PreviewLighting from "./PreviewLighting";
import PreviewRoom from "./PreviewRoom";
import PreviewEnvironment from "./PreviewEnvironment";
import PreviewControls from "./PreviewControls";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [
  6,
  5.5,
  6,
];

export default function PreviewCanvas({
  asset,
}: {
  asset: Asset | null;
}) {
  return (
    <Canvas
      shadows="basic"
      orthographic
      camera={{
        position: DEFAULT_CAMERA_POSITION,
        zoom: 72,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: true,
        toneMappingExposure: 0.9,
      }}
      dpr={[1, 2]}
    >
      <color
        attach="background"
        args={["#521212"]}
      />

      <PreviewCamera />

      <PreviewLighting />

      <PreviewRoom asset={asset} />

      <PreviewEnvironment />

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={10}
        blur={2}
        far={4}
      />

      <PreviewControls />
    </Canvas>
  );
}