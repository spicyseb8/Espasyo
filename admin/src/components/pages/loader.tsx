
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import {
  Box,
  Download,
  FileUp,
  Ruler,
  X,
} from "lucide-react";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import * as THREE from "three";

import PreviewEnvironment from "@/components/asset-preview/PreviewEnvironment";
import PreviewLighting from "@/components/asset-preview/PreviewLighting";
import PreviewRoom from "@/components/asset-preview/PreviewRoom";
import { PREVIEW_ROOM_DIMENSIONS } from "@/components/asset-preview/previewRoomDimensions";

const ROOM_FLOOR_TOP = PREVIEW_ROOM_DIMENSIONS.floorThickness;

const CAMERA_POSITION: [number, number, number] = [6, 5.5, 6];
const CAMERA_TARGET: [number, number, number] = [0, 1.2, 0];

type ModelDetails = {
  object: THREE.Group;
  sourceScene: THREE.Group;
  animations: THREE.AnimationClip[];
  width: number;
  height: number;
  depth: number;
  centerX: number;
  centerZ: number;
  minY: number;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Dimension({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border-t border-stone-200 py-3 first:border-0">
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500">{label}</span>
        <span className="font-medium tabular-nums text-stone-900">
          {value.toFixed(3)} m
        </span>
      </div>
    </div>
  );
}

function RoomDimension({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-t border-stone-200 py-3 first:border-0">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-stone-500">{label}</span>
        <span className="text-right font-medium tabular-nums text-stone-900">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function ModelSizeChecker() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<ModelDetails | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);

    new GLTFLoader().load(
      objectUrl,
      (gltf) => {
        if (cancelled) return;

        const sourceScene = gltf.scene;
        sourceScene.updateMatrixWorld(true);

        const bounds = new THREE.Box3().setFromObject(sourceScene);

        if (bounds.isEmpty()) {
          setError("This file does not contain a visible 3D model.");
          setIsLoading(false);
          return;
        }

        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());

        // Clone the scene for preview, preserving the original for export.
        const previewObject = sourceScene.clone(true);

        setModel({
          object: previewObject,
          sourceScene,
          animations: gltf.animations,
          width: size.x,
          height: size.y,
          depth: size.z,
          centerX: center.x,
          centerZ: center.z,
          minY: bounds.min.y,
        });

        setIsLoading(false);
      },
      undefined,
      () => {
        if (!cancelled) {
          setError("Could not load this GLB. Check that the file is valid.");
          setIsLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && nextFile.name.toLowerCase().endsWith(".glb")) {
      setFile(nextFile);
      setModel(null);
      setScaleFactor(1);
      setError(null);
      setIsLoading(true);
    } else if (nextFile) {
      setError("Choose a .glb file to preview.");
    }

    event.target.value = "";
  };

  const handleScaleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = Number(event.target.value);

    if (Number.isFinite(value) && value > 0 && value <= 100) {
      setScaleFactor(value);
    }
  };

  const handleDownload = async () => {
    if (!model || !file || isExporting) return;

    setIsExporting(true);
    setError(null);

    try {
      // Export the original model only.
      // Do not export the Canvas, room, lights, or preview effects.
      const exportScene = model.sourceScene.clone(true);

      // Preserve the original file and apply scale to the export.
      exportScene.scale.setScalar(scaleFactor);
      exportScene.updateMatrixWorld(true);

      const exporter = new GLTFExporter();

      const result = await exporter.parseAsync(exportScene, {
        binary: true,
        animations: model.animations,
        trs: true,
      });

      if (!(result instanceof ArrayBuffer)) {
        throw new Error("The exporter did not produce a binary GLB.");
      }

      const blob = new Blob([result], {
        type: "model/gltf-binary",
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const baseName = file.name.replace(/\.glb$/i, "");

      link.href = downloadUrl;
      link.download = `${baseName}_resized.glb`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (err) {
      console.error("GLB export failed:", err);

      setError(
        err instanceof Error
          ? `Export failed: ${err.message}`
          : "Could not export this GLB."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setModel(null);
    setScaleFactor(1);
    setError(null);
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f3ef] text-stone-900">
      <header className="flex min-h-16 items-center justify-between border-b border-stone-200 bg-white px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center bg-[#d65337] text-white">
            <Ruler size={18} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-sm font-semibold">GLB size checker</h1>
            <p className="text-xs text-stone-500">
              Resize and export 3D models
            </p>
          </div>
        </div>

        <span className="hidden text-xs text-stone-500 sm:block">
          Floor: {PREVIEW_ROOM_DIMENSIONS.width} × {PREVIEW_ROOM_DIMENSIONS.depth} m
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6 border-b border-stone-200 bg-white p-5 sm:p-7 lg:border-r lg:border-b-0">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#b74730]">
              Model dimensions
            </p>

            <h2 className="text-xl font-semibold">Resize your model</h2>

            <p className="mt-2 text-sm leading-6 text-stone-500">
              Upload a GLB, adjust its scale, preview the result, and
              download the resized model.
            </p>
          </div>

          <section aria-label="Preview room dimensions">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Preview room dimensions
            </p>
            <RoomDimension
              label="Floor (width × depth)"
              value={`${PREVIEW_ROOM_DIMENSIONS.width.toFixed(2)} × ${PREVIEW_ROOM_DIMENSIONS.depth.toFixed(2)} m`}
            />
            <RoomDimension
              label="Floor thickness"
              value={`${PREVIEW_ROOM_DIMENSIONS.floorThickness.toFixed(2)} m`}
            />
            <RoomDimension
              label="Back wall (W × H × T)"
              value={`${PREVIEW_ROOM_DIMENSIONS.width.toFixed(2)} × ${PREVIEW_ROOM_DIMENSIONS.wallHeight.toFixed(2)} × ${PREVIEW_ROOM_DIMENSIONS.backWallThickness.toFixed(2)} m`}
            />
            <RoomDimension
              label="Left wall (T × H × L)"
              value={`${PREVIEW_ROOM_DIMENSIONS.leftWallThickness.toFixed(2)} × ${PREVIEW_ROOM_DIMENSIONS.wallHeight.toFixed(2)} × ${(PREVIEW_ROOM_DIMENSIONS.depth - PREVIEW_ROOM_DIMENSIONS.backWallThickness).toFixed(2)} m`}
            />
          </section>

          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Choose a GLB file"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 items-center justify-center gap-2 bg-[#d65337] px-4 text-sm font-medium text-white transition-colors hover:bg-[#bd452d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d65337]"
          >
            <FileUp size={17} aria-hidden="true" />
            {file ? "Choose another GLB" : "Upload GLB"}
          </button>

          {error && (
            <p role="alert" className="text-sm leading-5 text-red-700">
              {error}
            </p>
          )}

          {file && (
            <section aria-label="Selected model" className="min-w-0">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Box
                    size={18}
                    className="mt-0.5 shrink-0 text-stone-500"
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">
                      {file.name}
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      Original: {formatSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearFile}
                  className="grid size-8 shrink-0 place-items-center text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                  aria-label="Remove model"
                  title="Remove model"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              {isLoading ? (
                <p
                  className="border-t border-stone-200 py-3 text-sm text-stone-500"
                  role="status"
                >
                  Loading model...
                </p>
              ) : model ? (
                <>
                  <div className="border-t border-stone-200 py-4">
                    <label
                      htmlFor="model-scale"
                      className="mb-2 block text-sm font-medium"
                    >
                      Scale multiplier
                    </label>

                    <input
                      id="model-scale"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.1"
                      value={scaleFactor}
                      onChange={handleScaleChange}
                      className="h-10 w-full border border-stone-300 px-3 text-sm outline-none focus:border-[#d65337]"
                    />

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[0.5, 1, 2].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setScaleFactor(value)}
                          className={`h-9 border text-sm transition-colors ${
                            scaleFactor === value
                              ? "border-[#d65337] bg-[#fff1ed] text-[#b74730]"
                              : "border-stone-200 hover:bg-stone-50"
                          }`}
                        >
                          {value}×
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-1">
                    <p className="py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Resized dimensions
                    </p>

                    <Dimension
                      label="Width"
                      value={model.width * scaleFactor}
                    />

                    <Dimension
                      label="Height"
                      value={model.height * scaleFactor}
                    />

                    <Dimension
                      label="Depth"
                      value={model.depth * scaleFactor}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isExporting}
                    className="flex min-h-11 w-full items-center justify-center gap-2 bg-[#d65337] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#bd452d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={17} aria-hidden="true" />
                    {isExporting
                      ? "Exporting GLB..."
                      : "Download Resized GLB"}
                  </button>

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    Only the model is exported. The preview room, lighting,
                    camera, and shadows are excluded.
                  </p>
                </>
              ) : null}
            </section>
          )}

          <div className="mt-auto border-t border-stone-200 pt-4 text-xs leading-5 text-stone-500">
            Scale changes preserve proportions. The original uploaded
            file remains unchanged.
          </div>
        </aside>

        <section
          className="relative min-h-[55vh] lg:min-h-0"
          aria-label="3D room preview"
        >
          <Canvas
            shadows="basic"
            orthographic
            camera={{
              position: CAMERA_POSITION,
              zoom: 72,
              near: 0.1,
              far: 100,
            }}
            gl={{
              antialias: true,
              alpha: false,
              toneMappingExposure: 0.9,
            }}
            dpr={[1, 2]}
          >
            <color attach="background" args={["#e9e8e3"]} />

            <PreviewLighting />
            <PreviewRoom asset={null} />

            {model && (
              <group
                position={[
                  -model.centerX * scaleFactor,
                  ROOM_FLOOR_TOP - model.minY * scaleFactor,
                  -model.centerZ * scaleFactor,
                ]}
                scale={scaleFactor}
              >
                <primitive object={model.object} />
              </group>
            )}

            <PreviewEnvironment />

            <ContactShadows
              position={[0, ROOM_FLOOR_TOP + 0.01, 0]}
              opacity={0.45}
              scale={8}
              blur={2}
              far={4}
            />

            <OrbitControls
              enablePan={false}
              enableZoom
              minZoom={35}
              maxZoom={140}
              target={CAMERA_TARGET}
              minPolarAngle={Math.PI / 5}
              maxPolarAngle={Math.PI / 2.05}
            />
          </Canvas>

          {!file && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-600 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#d65337]"
              aria-label="Upload a GLB to preview"
            >
              <span className="grid size-12 place-items-center border border-stone-300 bg-white/80">
                <FileUp size={21} aria-hidden="true" />
              </span>

              <span className="text-sm font-medium">
                Upload a GLB to preview
              </span>
            </button>
          )}

          {isLoading && (
            <div
              className="absolute inset-0 grid place-items-center bg-white/40 text-sm text-stone-700"
              role="status"
            >
              Loading model...
            </div>
          )}
        </section>
      </div>
    </main>
  );
}