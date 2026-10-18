import { Suspense, useEffect, useMemo, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import {
  MODEL_OFFSET,
  MODEL_ROTATION,
  MODEL_URL,
  WAYPOINTS,
} from "./Waypoints";

function Room() {
  // drei's useGLTF enables Meshopt + Draco decoding automatically.
  const { scene } = useGLTF(MODEL_URL);

  useEffect(() => {
    scene.updateMatrixWorld(true);

    // Debug: compare these numbers with your waypoint coordinates.
    // If the waypoints are not inside this box, the model is offset/scaled.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // eslint-disable-next-line no-console
    console.info(
      "[Room] bounding box (Y-up)\n",
      "min:", box.min.toArray().map((n) => +n.toFixed(2)),
      "max:", box.max.toArray().map((n) => +n.toFixed(2)),
      "\n size:", size.toArray().map((n) => +n.toFixed(2)),
      "center:", center.toArray().map((n) => +n.toFixed(2))
    );

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat?.map) mat.map.anisotropy = 4;
      }
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      position={MODEL_OFFSET}
      rotation={MODEL_ROTATION}
    />
  );
}

/** Moves the camera along the waypoints based on scroll progress (0 → N-1). */
function CameraRig({ progress }: { progress: MutableRefObject<number> }) {
  const { camera } = useThree();

  const state = useMemo(
    () => ({
      pos: new THREE.Vector3(...WAYPOINTS[0].position),
      look: new THREE.Vector3(...WAYPOINTS[0].target),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      desiredPos: new THREE.Vector3(),
      desiredLook: new THREE.Vector3(),
    }),
    []
  );

  useEffect(() => {
    camera.position.copy(state.pos);
    camera.lookAt(state.look);
    camera.updateMatrixWorld();
  }, [camera, state]);

  useFrame((_, dt) => {
    const last = WAYPOINTS.length - 1;
    const p = Math.min(Math.max(progress.current, 0), last);
    const i = Math.min(Math.floor(p), last - 1);
    const f = p - i;

    // The scroll itself is already eased (see usePagedScroll), so the camera
    // follows it linearly instead of dwelling near each waypoint.
    const t = f;

    const from = WAYPOINTS[i];
    const to = WAYPOINTS[i + 1];

    state.desiredPos
      .set(...from.position)
      .lerp(state.a.set(...to.position), t);
    state.desiredLook
      .set(...from.target)
      .lerp(state.b.set(...to.target), t);

    // Frame-rate independent damping.
    const k = 1 - Math.exp(-8 * dt);
    state.pos.lerp(state.desiredPos, k);
    state.look.lerp(state.desiredLook, k);

    camera.position.copy(state.pos);
    camera.lookAt(state.look);
    camera.updateMatrixWorld(); // keep the view matrix in sync every frame
  });

  return null;
}

function Loader({ onDone }: { onDone: () => void }) {
  const { progress, active } = useProgress();
  useEffect(() => {
    if (!active && progress === 100) onDone();
  }, [active, progress, onDone]);
  return null;
}

export default function RoomScene({
  progress,
  onLoaded,
}: {
  progress: MutableRefObject<number>;
  onLoaded: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 45, near: 0.05, far: 100 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.6} />
      <Suspense fallback={null}>
        <Room />
        <Environment preset="apartment" />
        <Loader onDone={onLoaded} />
      </Suspense>
      <CameraRig progress={progress} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);