
import {
    Suspense,
    useMemo,
    useRef
} from "react";

import {
    Canvas,
    useFrame
} from "@react-three/fiber";

import {
    Center,
    useGLTF
} from "@react-three/drei";

import * as THREE from "three";

//==================================================
// CONFIGURATION
//==================================================

const MODELS = [
    {
        url: "/models/loader-files/furni1.glb",
        delay: 0,
        variant: "straight"
    },
    {
        url: "/models/loader-files/furni2.glb",
        delay: 0.25,
        variant: "left"
    },
    {
        url: "/models/loader-files/furni3.glb",
        delay: 0.5,
        variant: "right"
    },
    {
        url: "/models/loader-files/furni4.glb",
        delay: 0.75,
        variant: "straight"
    }
] as const;

type Variant =
    | "straight"
    | "left"
    | "right";

interface AnimationKeyframes {
    x: number[];
    y: number[];
    s: number[];
    r: number[];
}

const KEYFRAMES: Record<
    Variant,
    AnimationKeyframes
> = {
    straight: {
        x: [0, 0, 0, 0, 0],
        y: [0.9, 0.4, -0.2, -0.9, -1.5],
        s: [1, 0.92, 0.7, 0.35, 0],
        r: [0, 0, 0, 0, 0]
    },

    left: {
        x: [-0.9, -0.7, -0.4, -0.15, 0],
        y: [0.9, 0.4, -0.2, -0.9, -1.5],
        s: [1, 0.92, 0.7, 0.35, 0],
        r: [0, -8, -16, -24, -32]
    },

    right: {
        x: [0.9, 0.7, 0.4, 0.15, 0],
        y: [0.9, 0.4, -0.2, -0.9, -1.5],
        s: [1, 0.92, 0.7, 0.35, 0],
        r: [0, 8, 16, 24, 32]
    }
};

const STOPS = [
    0,
    0.25,
    0.5,
    0.75,
    1
];

const OPACITY = [
    0,
    1,
    1,
    0.9,
    0
];

const TARGET_SIZE = 2.2;

//==================================================
// INTERPOLATION
//==================================================

function sample(
    keys: number[],
    t: number
): number {

    for (
        let i = 0;
        i < STOPS.length - 1;
        i++
    ) {

        if (t <= STOPS[i + 1]) {

            const f =
                (
                    t - STOPS[i]
                ) /
                (
                    STOPS[i + 1] -
                    STOPS[i]
                );

            return THREE.MathUtils.lerp(
                keys[i],
                keys[i + 1],
                f
            );
        }
    }

    return keys[keys.length - 1];
}

//==================================================
// ANIMATED FURNITURE
//==================================================

interface FallingModelProps {
    url: string;
    delay: number;
    variant: Variant;
}

interface AnimatedMaterial {
    material: THREE.Material;
    originalOpacity: number;
}

function FallingModel({
    url,
    delay,
    variant
}: FallingModelProps) {

    const group =
        useRef<THREE.Group>(null);

    const animationStartTime =
        useRef<number | null>(null);

    const {
        scene
    } = useGLTF(url);

    //==================================================
    // CLONE MODEL AND MATERIALS
    //==================================================

    const {
        model,
        materials,
        baseScale
    } = useMemo(() => {

        const clone =
            scene.clone(true);

        const animatedMaterials:
            AnimatedMaterial[] = [];

        clone.traverse(
            (object: THREE.Object3D) => {

                if (
                    !(object instanceof THREE.Mesh)
                ) {
                    return;
                }

                object.castShadow = false;
                object.receiveShadow = false;

                // Some GLBs have a single material.
                // Others assign an array of materials.
                const originalMaterials =
                    Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                const clonedMaterials =
                    originalMaterials.map(
                        originalMaterial => {

                            const material =
                                originalMaterial.clone();

                            const originalOpacity =
                                material.opacity;

                            material.transparent =
                                true;

                            material.depthWrite =
                                false;

                            material.needsUpdate =
                                true;

                            animatedMaterials.push({
                                material,
                                originalOpacity
                            });

                            return material;
                        }
                    );

                object.material =
                    Array.isArray(object.material)
                        ? clonedMaterials
                        : clonedMaterials[0];
            }
        );

        // Normalize the model so different GLB source
        // dimensions do not create inconsistent sizes.
        const size =
            new THREE.Vector3();

        new THREE.Box3()
            .setFromObject(clone)
            .getSize(size);

        const maxDimension =
            Math.max(
                size.x,
                size.y,
                size.z,
                0.0001
            );

        return {
            model: clone,
            materials: animatedMaterials,
            baseScale:
                TARGET_SIZE / maxDimension
        };

    }, [
        scene
    ]);

    const keyframes =
        KEYFRAMES[variant];

    //==================================================
    // ANIMATION
    //==================================================

    useFrame(({ clock }) => {

        const currentGroup =
            group.current;

        if (!currentGroup) {
            return;
        }

        const elapsedTime =
            clock.elapsedTime;

        // Start each model's own timeline when it is
        // actually mounted and ready to animate.
        //
        // This prevents a slow-loading GLB from appearing
        // halfway through its animation on its first frame.
        if (
            animationStartTime.current === null
        ) {

            animationStartTime.current =
                elapsedTime + delay;
        }

        const localElapsed =
            elapsedTime -
            animationStartTime.current;

        // Wait at the top until this model's stagger delay
        // has elapsed.
        if (localElapsed < 0) {

            currentGroup.position.set(
                keyframes.x[0],
                keyframes.y[0],
                0
            );

            currentGroup.rotation.z =
                THREE.MathUtils.degToRad(
                    keyframes.r[0]
                );

            currentGroup.scale.setScalar(
                baseScale
            );

            for (const entry of materials) {
                entry.material.opacity = 0;
            }

            return;
        }

        // One continuous one-second animation cycle.
        const t =
            localElapsed % 1;

        const scaleFactor =
            Math.max(
                sample(keyframes.s, t),
                0.0001
            );

        const opacity =
            sample(OPACITY, t);

        currentGroup.position.set(
            sample(keyframes.x, t),
            sample(keyframes.y, t),
            0
        );

        currentGroup.rotation.z =
            THREE.MathUtils.degToRad(
                sample(keyframes.r, t)
            );

        currentGroup.scale.setScalar(
            baseScale * scaleFactor
        );

        // Preserve each GLB material's original opacity,
        // including semi-transparent glass and details.
        for (const entry of materials) {

            entry.material.opacity =
                entry.originalOpacity *
                opacity;
        }
    });

    //==================================================
    // RENDER
    //==================================================

    return (
        <group ref={group}>
            <Center>
                <primitive
                    object={model}
                />
            </Center>
        </group>
    );
}

//==================================================
// LOADING LABEL
//==================================================

function LoadingLabel() {

    return (
        <p className="flex items-center text-lg font-bold tracking-tight text-neutral-700">

            <span>
                Loading Project
            </span>

            <span
                aria-hidden="true"
                className="ml-2 flex gap-2"
            >
                {[0, 1, 2].map(i => (
                    <span
                        key={i}
                        className="inline-block animate-pulse motion-reduce:animate-none"
                        style={{
                            animationDelay:
                                `${i * 200}ms`,

                            animationDuration:
                                "1.2s"
                        }}
                    >
                        .
                    </span>
                ))}
            </span>

        </p>
    );
}

//==================================================
// LOADING BAR
//==================================================

function LoadingBar() {

    return (
        <>
            <style>
                {`
                    @keyframes loader-bar-slide {
                        0% {
                            transform: translateX(-100%);
                        }

                        100% {
                            transform: translateX(300%);
                        }
                    }

                    .loader-bar-fill {
                        animation:
                            loader-bar-slide
                            1.4s
                            cubic-bezier(0.45, 0, 0.55, 1)
                            infinite;
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .loader-bar-fill {
                            animation: none;
                            transform: none;
                            width: 100%;
                            opacity: 0.6;
                        }
                    }
                `}
            </style>

            <div
                aria-hidden="true"
                className="h-1.5 w-56 overflow-hidden rounded-full bg-black/10"
            >
                <div className="loader-bar-fill h-full w-1/3 rounded-full bg-black" />
            </div>
        </>
    );
}

//==================================================
// LOADING SCREEN
//==================================================

export default function LoadingScreen() {

    return (
        <main
            className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white"
            aria-live="polite"
            aria-busy="true"
        >

            <div className="relative z-10 flex flex-col items-center gap-4">

                <div
                    className="h-[340px] w-[340px]"
                    role="status"
                    aria-label="Loading project"
                >

                    <Canvas
                        gl={{
                            alpha: true,
                            antialias: true
                        }}
                        camera={{
                            position: [0, 0, 4.5],
                            fov: 50
                        }}
                        dpr={[1, 2]}
                    >

                        <ambientLight
                            intensity={0.9}
                        />

                        <directionalLight
                            position={[3, 4, 5]}
                            intensity={1.4}
                        />

                        <pointLight
                            position={[0, -1.5, 2]}
                            intensity={6}
                            color="#5c3d99"
                        />

                        {/* Each model has its own Suspense
                            boundary, so one slow model does
                            not block the other three. */}

                        {MODELS.map(model => (

                            <Suspense
                                key={model.url}
                                fallback={null}
                            >

                                <FallingModel
                                    {...model}
                                />

                            </Suspense>

                        ))}

                    </Canvas>

                </div>

                <div className="flex flex-col items-center gap-4">

                    <LoadingLabel />

                    <LoadingBar />

                </div>

            </div>

        </main>
    );
}

//==================================================
// START PRELOADING THE LOADER MODELS
//==================================================

MODELS.forEach(model => {
    useGLTF.preload(model.url);
});
