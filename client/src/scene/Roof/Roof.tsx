import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
    Box3,
    DoubleSide,
    Mesh,
    NoColorSpace,
    Path,
    RepeatWrapping,
    Shape,
    ShapeGeometry,
    SRGBColorSpace,
    TextureLoader,
    Vector3
} from "three";
import useEditor from "../../context/editor/useEditor";
import { solveRegions } from "../../engine/regions/RegionSolver";
import { getRegionCenter } from "../../engine/regions/RegionCenter";
import type { Region } from "../../engine/regions/Polygon";

const CEILING_BASE_COLOR_URL =
    "/ceiling/concrete/Poliigon_ConcreteWorn_8690_BaseColor.jpg";

const CEILING_NORMAL_URL =
    "/ceiling/concrete/Poliigon_ConcreteWorn_8690_Normal.png";

const CEILING_ROUGHNESS_URL =
    "/ceiling/concrete/Poliigon_ConcreteWorn_8690_Roughness.jpg";

const CEILING_AO_URL =
    "/ceiling/concrete/Poliigon_ConcreteWorn_8690_AmbientOcclusion.jpg";

const CEILING_LIGHT_MODEL_URL =
    "/models/default_light/ceiling.glb";

// Single source of truth for the texture list.
// Used by BOTH useLoader and useLoader.preload so the
// cache key matches (same URLs, same order).
const CEILING_TEXTURE_URLS = [
    CEILING_BASE_COLOR_URL,
    CEILING_NORMAL_URL,
    CEILING_ROUGHNESS_URL,
    CEILING_AO_URL
];

const CEILING_TILE_SIZE = 1;
const CEILING_LIGHT_TARGET_WIDTH = 0.35;
const CEILING_LIGHT_GAP = 0.01;

function createCeilingGeometry(
    boundaryLoops: Region["boundaryLoops"]
): ShapeGeometry | null {
    const outer = boundaryLoops[0]?.corners ?? [];

    if (outer.length < 3) {
        return null;
    }

    const shape = new Shape();

    shape.moveTo(
        outer[0].x,
        -outer[0].z
    );

    for (let index = 1; index < outer.length; index++) {
        shape.lineTo(
            outer[index].x,
            -outer[index].z
        );
    }

    shape.closePath();

    shape.holes = boundaryLoops
        .slice(1)
        .map(loop => loop.corners)
        .filter(loop => loop.length >= 3)
        .map(loop => {
            const hole = new Path();

            hole.moveTo(
                loop[0].x,
                -loop[0].z
            );

            for (let index = 1; index < loop.length; index++) {
                hole.lineTo(
                    loop[index].x,
                    -loop[index].z
                );
            }

            hole.closePath();

            return hole;
        });

    const geometry = new ShapeGeometry(shape);
    const uv = geometry.getAttribute("uv");

    if (uv) {
        geometry.setAttribute("uv2", uv.clone());
    }

    return geometry;
}

function CeilingLightFixture({
    region,
    height
}: {
    region: Region;
    height: number;
}) {
    const { scene } = useGLTF(CEILING_LIGHT_MODEL_URL);

    const center = useMemo(
        () => getRegionCenter(region),
        [region]
    );

    const model = useMemo(() => {
        const clone = scene.clone(true);

        clone.updateMatrixWorld(true);

        const bounds = new Box3().setFromObject(clone);
        const size = bounds.getSize(new Vector3());
        const boundsCenter = bounds.getCenter(new Vector3());
        const horizontalSize = Math.max(size.x, size.z);

        const scale = horizontalSize > 0.0001
            ? CEILING_LIGHT_TARGET_WIDTH / horizontalSize
            : 1;

        clone.scale.multiplyScalar(scale);

        clone.position.set(
            -boundsCenter.x * scale,
            -bounds.max.y * scale,
            -boundsCenter.z * scale
        );

        clone.traverse(object => {
            if (object instanceof Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                object.raycast = () => null;
            }
        });

        clone.updateMatrixWorld(true);

        return clone;
    }, [scene]);

    return (
        <group
            name={`CeilingLight-${region.id}`}
            position={[
                center.x,
                Math.max(height - CEILING_LIGHT_GAP, 0.05),
                center.z
            ]}
        >
            <primitive object={model} />
        </group>
    );
}

function RoomCeiling({
    region,
    height
}: {
    region: Region;
    height: number;
}) {
    const boundaryLoops = region.boundaryLoops;

    const [
        sourceBaseColor,
        sourceNormal,
        sourceRoughness,
        sourceAO
    ] = useLoader(
        TextureLoader,
        CEILING_TEXTURE_URLS
    );

    const [
        baseColorTexture,
        normalTexture,
        roughnessTexture,
        aoTexture
    ] = useMemo(() => {
        const baseColor = sourceBaseColor.clone();
        const normal = sourceNormal.clone();
        const roughness = sourceRoughness.clone();
        const ao = sourceAO.clone();

        const tileSize = Math.max(
            CEILING_TILE_SIZE,
            0.001
        );

        const textures = [
            baseColor,
            normal,
            roughness,
            ao
        ];

        for (const texture of textures) {
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;

            texture.repeat.set(
                1 / tileSize,
                1 / tileSize
            );

            texture.offset.set(0, 0);
            texture.needsUpdate = true;
        }

        baseColor.colorSpace = SRGBColorSpace;
        normal.colorSpace = NoColorSpace;
        roughness.colorSpace = NoColorSpace;
        ao.colorSpace = NoColorSpace;

        return [
            baseColor,
            normal,
            roughness,
            ao
        ];
    }, [
        sourceBaseColor,
        sourceNormal,
        sourceRoughness,
        sourceAO
    ]);

    useEffect(() => {
        return () => {
            baseColorTexture.dispose();
            normalTexture.dispose();
            roughnessTexture.dispose();
            aoTexture.dispose();
        };
    }, [
        baseColorTexture,
        normalTexture,
        roughnessTexture,
        aoTexture
    ]);

    const geometry = useMemo(
        () => createCeilingGeometry(boundaryLoops),
        [boundaryLoops]
    );

    useEffect(() => {
        return () => {
            geometry?.dispose();
        };
    }, [geometry]);

    if (!geometry) {
        return null;
    }

    return (
        <mesh
            name={`WalkthroughCeiling-${region.id}`}
            geometry={geometry}
            position={[0, height, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
            raycast={() => null}
        >
            <meshStandardMaterial
                map={baseColorTexture}
                normalMap={normalTexture}
                roughnessMap={roughnessTexture}
                aoMap={aoTexture}
                color="#ffffff"
                roughness={1}
                metalness={0}
                side={DoubleSide}
            />
        </mesh>
    );
}

export default function Roof() {
    const { state } = useEditor();

    const regions = useMemo(
        () => solveRegions(
            state.corners,
            state.walls
        ).filter(
            region =>
                region.corners.length >= 3 &&
                Math.abs(region.area) > 0.01
        ),
        [
            state.corners,
            state.walls
        ]
    );

    const ceilingHeight = Math.max(
        state.wallHeight - 0.03,
        0.1
    );

    if (!state.walkthroughMode) {
        return null;
    }

    return (
        <group name="WalkthroughCeiling">
            {regions.map(region => (
                <group key={`ceiling-${region.id}`}>
                    <RoomCeiling
                        region={region}
                        height={ceilingHeight}
                    />

                    <CeilingLightFixture
                        region={region}
                        height={ceilingHeight}
                    />
                </group>
            ))}
        </group>
    );
}

export function RoofAssetGate() {
    useGLTF(CEILING_LIGHT_MODEL_URL);
    useLoader(TextureLoader, CEILING_TEXTURE_URLS);
    return null;
}

//==================================================
// PRELOAD
//
// Fetch + decode these at app load, so the roof never
// suspends the first time walkthrough spawn is confirmed.
//==================================================

useGLTF.preload(CEILING_LIGHT_MODEL_URL);

useLoader.preload(
    TextureLoader,
    CEILING_TEXTURE_URLS
);