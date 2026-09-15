export default function PreviewLighting() {
  return (
    <>
      <ambientLight
        intensity={0.35}
      />

      <hemisphereLight
        intensity={0.25}
        position={[0, 10, 0]}
      />

      <directionalLight
        castShadow
        position={[2, 8, -2]}
        intensity={2.2}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />

      <directionalLight
        position={[43, 10, 9]}
        intensity={0.7}
      />

      <directionalLight
        position={[5, 3, 5]}
        intensity={0.2}
      />
    </>
  );
}