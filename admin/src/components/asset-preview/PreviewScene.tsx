import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Line,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [6, 5.5, 6];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 1.2, 0];

const CURTAIN_MODEL = "/models/curtainsV4.glb";
const TV_MODEL = "/models/TV.glb";
const CABINET_MODEL = "/models/Cabinet.glb";

/* =========================================================
   TRANSPARENCY LOOK (for TV + Cabinet)
   ========================================================= */

const TRANSPARENT_OPACITY = 0.6;

/* =========================================================
   SAVED CURTAIN / TV / CABINET
   ========================================================= */

const SAVED_CURTAIN = {
  model: "curtainsV4.glb",
  position: [0.36381508186794065, 1.8000000000000003, -2.480325287135881] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

const SAVED_TV = {
  model: "TV.glb",
  position: [-1.0306140071150516, 1.08, -0.18208562992245714] as [number, number, number],
  rotation: [0, 7.853981633974479, 0] as [number, number, number],
  scale: [0.7, 0.7, 0.7] as [number, number, number],
};

const SAVED_CABINET = {
  model: "Cabinet.glb",
  position: [-0.8056224435930731, 0.182, -0.30279023544309247] as [number, number, number],
  rotation: [0, 10.995574287564279, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

/* =========================================================
   SOLID MATERIAL PROPS
   ========================================================= */

const SOLID_MATERIAL_PROPS = {
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
} as const;

/* =========================================================
   VISIBLE EDGES
   ========================================================= */

function VisibleEdges() {
  return <Edges threshold={1} color="#666666" linewidth={1} />;
}

/* =========================================================
   CAMERA
   ========================================================= */

function PreviewCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    camera.lookAt(...DEFAULT_CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

/* =========================================================
   GLB MODEL
   ========================================================= */

function GLBModel({
  modelPath,
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  transparent = false,
}: {
  modelPath: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  transparent?: boolean;
}) {
  const { scene } = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;

        if (transparent) {
          const applyTransparency = (material: THREE.Material) => {
            const cloned = material.clone();
            cloned.transparent = true;
            cloned.opacity = TRANSPARENT_OPACITY;
            cloned.depthWrite = false;
            return cloned;
          };

          if (Array.isArray(object.material)) {
            object.material = object.material.map(applyTransparency);
          } else if (object.material) {
            object.material = applyTransparency(object.material);
          }
        }
      }
    });

    return clone;
  }, [scene, transparent]);

  return (
    <primitive
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

useGLTF.preload(CURTAIN_MODEL);
useGLTF.preload(TV_MODEL);
useGLTF.preload(CABINET_MODEL);

function CurtainModel() {
  return (
    <GLBModel
      modelPath={CURTAIN_MODEL}
      position={SAVED_CURTAIN.position}
      rotation={SAVED_CURTAIN.rotation}
      scale={SAVED_CURTAIN.scale}
      transparent={false}
    />
  );
}

function TVModel() {
  return (
    <GLBModel
      modelPath={TV_MODEL}
      position={SAVED_TV.position}
      rotation={SAVED_TV.rotation}
      scale={SAVED_TV.scale}
      transparent
    />
  );
}

function CabinetModel() {
  return (
    <GLBModel
      modelPath={CABINET_MODEL}
      position={SAVED_CABINET.position}
      rotation={SAVED_CABINET.rotation}
      scale={SAVED_CABINET.scale}
      transparent
    />
  );
}

/* =========================================================
   ROOM
   ========================================================= */

function PreviewRoom() {
  const wallHeight = 3;
  const roomWidth = 4.6;
  const roomDepth = 5.5;

  const floorThickness = 0.3;

  const backWallThickness = 0.2;
  const leftWallThickness = 1.0;

  const floorTopY = floorThickness;

  const backWallCenterZ = -roomDepth / 2 + backWallThickness / 2;
  const backWallInnerZ = -roomDepth / 2 + backWallThickness;

  const leftWallCenterX = -roomWidth / 2 + leftWallThickness / 2;
  const leftWallInnerX = -roomWidth / 2 + leftWallThickness;

  const leftWallLength = roomDepth / 2 - backWallInnerZ;
  const leftWallCenterZ = backWallInnerZ + leftWallLength / 2;

  const backTrimDepth = 0.08;
  const backTrimHeight = 0.28;

  const leftTrimDepth = 0.08;
  const leftTrimHeight = 0.28;

  const backTrimCenterZ = backWallInnerZ + backTrimDepth / 2;
  const backTrimInnerZ = backWallInnerZ + backTrimDepth;

  const leftTrimCenterX = leftWallInnerX + leftTrimDepth / 2;
  const leftTrimLength = roomDepth / 2 - backTrimInnerZ;
  const leftTrimCenterZ = backTrimInnerZ + leftTrimLength / 2;

  return (
    <group>
      {/* FLOOR */}
      <mesh receiveShadow castShadow position={[0, floorThickness / 2, 0]} name="preview-floor">
        <boxGeometry args={[roomWidth, floorThickness, roomDepth]} />
        <meshStandardMaterial attach="material-0" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-1" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-2" color="#e4b763" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-3" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-4" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-5" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <VisibleEdges />
      </mesh>

      {/* BACK WALL */}
      <mesh castShadow receiveShadow position={[0, floorTopY + wallHeight / 2, backWallCenterZ]}>
        <boxGeometry args={[roomWidth, wallHeight, backWallThickness]} />
        <meshStandardMaterial attach="material-0" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-1" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-2" color="#646463" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-3" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-4" color="#e8e4d8" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-5" color="#e0e0e0" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <VisibleEdges />
      </mesh>

      {/* LEFT WALL */}
      <mesh castShadow receiveShadow position={[leftWallCenterX, floorTopY + wallHeight / 2, leftWallCenterZ]}>
        <boxGeometry args={[leftWallThickness, wallHeight, leftWallLength]} />
        <meshStandardMaterial attach="material-0" color="#ffffff" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-1" color="#646463" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-2" color="#646463" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-3" color="#646463" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-4" color="#646463" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <meshStandardMaterial attach="material-5" color="#646463" roughness={0.85} {...SOLID_MATERIAL_PROPS} />
        <VisibleEdges />
      </mesh>

      {/* WALL SEAM */}
      <Line
        points={[
          [leftWallInnerX, floorTopY, backWallInnerZ],
          [leftWallInnerX, floorTopY + wallHeight, backWallInnerZ],
        ]}
        color="#666666"
        lineWidth={1}
      />

      {/* INNER TRIMS */}
      <mesh castShadow position={[0, backTrimHeight / 2 + floorTopY, backTrimCenterZ]}>
        <boxGeometry args={[roomWidth, backTrimHeight, backTrimDepth]} />
        <meshStandardMaterial color="#e9e6dd" roughness={0.75} {...SOLID_MATERIAL_PROPS} />
        <VisibleEdges />
      </mesh>

      <mesh castShadow position={[leftTrimCenterX, leftTrimHeight / 2 + floorTopY, leftTrimCenterZ]}>
        <boxGeometry args={[leftTrimDepth, leftTrimHeight, leftTrimLength]} />
        <meshStandardMaterial color="#e9e6dd" roughness={0.75} {...SOLID_MATERIAL_PROPS} />
        <VisibleEdges />
      </mesh>
    </group>
  );
}

/* =========================================================
   SHADOW GROUND
   ========================================================= */

function ShadowGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <shadowMaterial transparent opacity={0.35} />
    </mesh>
  );
}

/* =========================================================
   LIGHTING — two shaping lights:
   - KEY LIGHT: main shadow-caster (position [5, 10, -8])
   - ACCENT LIGHT: front-right, low angle, aimed up at the
     TV/cabinet face (matches the arrow's direction)
   ========================================================= */

function PreviewLighting() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight intensity={0.25} position={[0, 10, 0]} />

      {/* KEY LIGHT — main shadow-caster */}
      <directionalLight
        castShadow
        position={[5, 10, -8]}
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

      {/* ACCENT LIGHT — moved to front-right, low angle, aimed up at
          the TV/cabinet face, matching the arrow's direction */}
      <directionalLight
        position={[7, 3.5, 9]}
        intensity={0.7}
      />

      <directionalLight position={[5, 3, 5]} intensity={0.2} />
    </>
  );
}

/* =========================================================
   ORBIT CONTROLS
   ========================================================= */

function SnapBackControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const handleEnd = () => {
    const controls = controlsRef.current;
    if (!controls) return;

    const camera = controls.object;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

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
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      camera.position.set(
        startPos.x + (endPos.x - startPos.x) * eased,
        startPos.y + (endPos.y - startPos.y) * eased,
        startPos.z + (endPos.z - startPos.z) * eased
      );

      controls.target.set(
        startTarget.x + (endTarget.x - startTarget.x) * eased,
        startTarget.y + (endTarget.y - startTarget.y) * eased,
        startTarget.z + (endTarget.z - startTarget.z) * eased
      );

      controls.update();
      if (t < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
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

/* =========================================================
   MAIN PREVIEW SCENE
   ========================================================= */

export default function PreviewScene() {
  return (
    <div className="h-full w-full overflow-hidden bg-[#dfe0de]">
      <Canvas
        shadows
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
        <color attach="background" args={["#521212"]} />

        <PreviewCamera />
        <PreviewLighting />
        <ShadowGround />
        <PreviewRoom />

        <CurtainModel />
        <TVModel />
        <CabinetModel />

        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.5}
          scale={10}
          blur={2}
          far={4}
        />

        <SnapBackControls />
      </Canvas>
    </div>
  );
}