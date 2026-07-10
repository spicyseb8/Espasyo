export default function Lights() {
  return (
    <>
      <ambientLight intensity={1.5} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
      />
    </>
  );
}