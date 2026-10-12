"use client"; // only needed if you're on the Next.js App Router

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Config ──────────────────────────────────────────────────────────────
// 4 models spaced evenly across the same 1s loop.
const MODELS = [
  { url: "/models/loader-files/furni1.glb", delay: 0, variant: "straight" },
  { url: "/models/loader-files/furni2.glb", delay: 0.25, variant: "left" },
  { url: "/models/loader-files/furni3.glb", delay: 0.5, variant: "right" },
  { url: "/models/loader-files/furni4.glb", delay: 0.75, variant: "straight" },
] as const;

type Variant = "straight" | "left" | "right";

// Models start at the top at full size, then get "sucked" down toward a point
// at the bottom-center while shrinking to nothing.
// Stops: 0% / 25% / 50% / 75% / 100%   (1 unit ≈ 100px)
const KEYFRAMES: Record<Variant, { x: number[]; y: number[]; s: number[]; r: number[] }> = {
  straight: {
    x: [0, 0, 0, 0, 0],
    y: [1.2, 0.6, -0.2, -1.1, -1.9],
    s: [1, 0.95, 0.75, 0.4, 0],
    r: [0, 0, 0, 0, 0],
  },
  left: {
    x: [-1.1, -0.85, -0.5, -0.2, 0],
    y: [1.2, 0.6, -0.2, -1.1, -1.9],
    s: [1, 0.95, 0.75, 0.4, 0],
    r: [0, -8, -16, -24, -32],
  },
  right: {
    x: [1.1, 0.85, 0.5, 0.2, 0],
    y: [1.2, 0.6, -0.2, -1.1, -1.9],
    s: [1, 0.95, 0.75, 0.4, 0],
    r: [0, 8, 16, 24, 32],
  },
};

const STOPS = [0, 0.25, 0.5, 0.75, 1];
// Quick fade-in at the top, fade out as it vanishes at the bottom.
const OPACITY = [0, 1, 1, 0.9, 0];
/** Size of each model at its largest (was 1). Bump to make models bigger. */
const TARGET_SIZE = 1.5;

// Linear interpolation between keyframe stops, exactly like CSS `linear`.
function sample(keys: number[], t: number) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t <= STOPS[i + 1]) {
      const f = (t - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
      return THREE.MathUtils.lerp(keys[i], keys[i + 1], f);
    }
  }
  return keys[keys.length - 1];
}

// ── One falling model ───────────────────────────────────────────────────
function FallingModel({ url, delay, variant }: { url: string; delay: number; variant: Variant }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  const { model, materials, baseScale } = useMemo(() => {
    const clone = scene.clone(true);
    const materials: THREE.Material[] = [];
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material.clone();
        mat.transparent = true; // required so we can fade opacity
        obj.material = mat;
        materials.push(mat);
      }
    });
    // Normalize every model to the same footprint, regardless of source size
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(clone).getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    return { model: clone, materials, baseScale: TARGET_SIZE / maxDim };
  }, [scene]);

  const k = KEYFRAMES[variant];

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = (clock.elapsedTime + delay) % 1; // 1s loop, staggered per model
    g.position.set(sample(k.x, t), sample(k.y, t), 0);
    g.rotation.z = THREE.MathUtils.degToRad(sample(k.r, t));
    g.scale.setScalar(Math.max(baseScale * sample(k.s, t), 0.0001));
    const opacity = sample(OPACITY, t);
    for (const m of materials) m.opacity = opacity;
  });

  return (
    <group ref={group}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

// ── Drop-in replacement for your old LoadingScreen ──────────────────────
export default function LoadingScreen() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-[300px] w-[260px]" role="status" aria-label="Loading">
          <Canvas
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 0, 4.5], fov: 50 }}
            dpr={[1, 2]}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 4, 5]} intensity={1.4} />
            {/* Purple glow sits at the "drain" point at the bottom */}
            <pointLight position={[0, -1.5, 2]} intensity={6} color="#5c3d99" />
            <Suspense fallback={null}>
              {MODELS.map((m) => (
                <FallingModel key={m.url} {...m} />
              ))}
            </Suspense>
          </Canvas>
        </div>
        <p className="text-sm">Loading...</p>
      </div>
    </main>
  );
}

MODELS.forEach((m) => useGLTF.preload(m.url));