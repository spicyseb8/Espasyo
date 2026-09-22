import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface Props {
    model: string;
}

function ModelPreview({ model }: Props) {
    const { scene } = useGLTF(model);

    const clonedScene = useMemo(() => {
        const clone = scene.clone(true);

        clone.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = false;
                object.receiveShadow = false;

                if (Array.isArray(object.material)) {
                    object.material = object.material.map(
                        material => material.clone()
                    );
                } else if (object.material) {
                    object.material = object.material.clone();
                }
            }
        });

        return clone;
    }, [scene]);

    return (
        <Bounds
            fit
            clip
            margin={1.15}
        >
            <Center>
                <primitive object={clonedScene} />
            </Center>
        </Bounds>
    );
}

function LoadingPreview() {
    return (
        <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial />
        </mesh>
    );
}

export default function AssetModelThumbnail({
    model
}: Props) {

    if (!model) {
        return null;
    }

    return (
        <Canvas
            className="asset-model-canvas"
            camera={{
                position: [2.5, 2, 2.5],
                fov: 35
            }}
            dpr={[1, 1]}
            gl={{
                antialias: true,
                alpha: true
            }}
            style={{
                width: "100%",
                height: "100%",
                pointerEvents: "none"
            }}
        >
            <ambientLight intensity={1.8} />

            <directionalLight
                position={[3, 5, 4]}
                intensity={2.5}
            />

            <directionalLight
                position={[-3, 2, -2]}
                intensity={1.2}
            />

            <Suspense fallback={<LoadingPreview />}>
                <ModelPreview model={model} />
            </Suspense>
        </Canvas>
    );
}