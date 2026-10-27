import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Asset } from "../engine/assets/Asset";
import type { SavedWindow } from "../ProjectTypes";
import { emitAdminCommentTarget } from "../../../services/assets/adminCommentEvents";
import AdminModelErrorBoundary from "./AdminModelErrorBoundary";
import {
    fitAdminElementModelToBounds,
    normalizeAdminWindowModel
} from "./AdminElementModelUtils";
import { disposeClonedMaterials } from "@/lib/disposeClonedMaterials";

interface AdminWindowProps {
    window: SavedWindow;
    asset: Asset;
    wallThickness: number;
    onSelect?: (windowId: string) => void;
}

const WINDOW_CASING_WIDTH = 0.060;
const WINDOW_CASING_DEPTH = 0.025;
const WINDOW_CASING_GAP = 0.004;
const WINDOW_CASING_COLOR = "#E9E5DE";

function WindowCasing({
    windowId,
    width,
    height,
    wallThickness
}: {
    windowId: string;
    width: number;
    height: number;
    wallThickness: number;
}) {
    const sideOffset =
        wallThickness * 0.5 +
        WINDOW_CASING_DEPTH * 0.5 +
        WINDOW_CASING_GAP;

    const halfWidth =
        width * 0.5;

    const halfHeight =
        height * 0.5;

    const leftX =
        -halfWidth -
        WINDOW_CASING_WIDTH * 0.5;

    const rightX =
        halfWidth +
        WINDOW_CASING_WIDTH * 0.5;

    const topY =
        halfHeight +
        WINDOW_CASING_WIDTH * 0.5;

    const bottomY =
        -halfHeight -
        WINDOW_CASING_WIDTH * 0.5;

    const horizontalWidth =
        width +
        WINDOW_CASING_WIDTH * 2;

    const sides = [-1, 1] as const;

    return (
        <group>
            {sides.map(side => {
                const z =
                    side *
                    sideOffset;

                return (
                    <group
                        key={`admin-window-casing-${windowId}-${side}`}
                    >
                        <mesh
                            position={[
                                leftX,
                                0,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    WINDOW_CASING_WIDTH,
                                    height,
                                    WINDOW_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={WINDOW_CASING_COLOR}
                                roughness={0.78}
                                metalness={0}
                            />
                        </mesh>

                        <mesh
                            position={[
                                rightX,
                                0,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    WINDOW_CASING_WIDTH,
                                    height,
                                    WINDOW_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={WINDOW_CASING_COLOR}
                                roughness={0.78}
                                metalness={0}
                            />
                        </mesh>

                        <mesh
                            position={[
                                0,
                                bottomY,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    horizontalWidth,
                                    WINDOW_CASING_WIDTH,
                                    WINDOW_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={WINDOW_CASING_COLOR}
                                roughness={0.78}
                                metalness={0}
                            />
                        </mesh>

                        <mesh
                            position={[
                                0,
                                topY,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    horizontalWidth,
                                    WINDOW_CASING_WIDTH,
                                    WINDOW_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={WINDOW_CASING_COLOR}
                                roughness={0.78}
                                metalness={0}
                            />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

export default function AdminWindow({
    window,
    asset,
    wallThickness,
    onSelect
}: AdminWindowProps) {
    if (
        typeof asset.model !== "string" ||
        asset.model.trim() === ""
    ) {
        console.warn(
            "Admin window has no valid model URL:",
            window.assetId
        );

        return null;
    }

    return (
        <AdminModelErrorBoundary assetId={asset.id}>
            <AdminWindowModel
                window={window}
                asset={asset}
                wallThickness={wallThickness}
                onSelect={onSelect}
            />
        </AdminModelErrorBoundary>
    );
}

function AdminWindowModel({
    window,
    asset,
    wallThickness,
    onSelect
}: AdminWindowProps) {
    const { scene } =
        useGLTF(asset.model);

    const model = useMemo(() => {
        const normalized =
            normalizeAdminWindowModel(
                scene,
                asset
            );

        fitAdminElementModelToBounds(normalized, {
            width: window.width,
            height: window.height,
            depth: window.depth
        });

        normalized.traverse(child => {
            child.userData = {
                ...child.userData,
                windowId: window.id
            };

            if (child instanceof Mesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(
                        material => material.clone()
                    );
                } else if (child.material) {
                    child.material =
                        child.material.clone();
                }

                const materials =
                    Array.isArray(child.material)
                        ? child.material
                        : [child.material];

                const hasGlass =
                    materials.some(
                        material =>
                            material.transparent ||
                            (
                                typeof material.opacity === "number" &&
                                material.opacity < 0.95
                            )
                    );

                child.castShadow =
                    !hasGlass;

                child.receiveShadow = true;
            }
        });

        return normalized;
    }, [
        scene,
        asset,
        window.width,
        window.height,
        window.depth,
        window.id
    ]);

    useEffect(() => {
        return () => disposeClonedMaterials(model);
    }, [model]);

    const finalRotationY =
        window.rotationY +
        (asset.rotationOffsetY ?? 0);

    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect?.(window.id);

        emitAdminCommentTarget({
            targetType: "window",
            targetId: window.id,
            targetLabel: `Window: ${asset.name}`
        });
    };

    return (
        <group
            position={[
                window.position.x,
                window.position.y,
                window.position.z
            ]}
            rotation={[
                0,
                finalRotationY,
                0
            ]}
            userData={{
                windowId: window.id
            }}
            onClick={handleClick}
        >
            <WindowCasing
                windowId={window.id}
                width={window.wallWidth ?? window.width}
                height={window.height}
                wallThickness={wallThickness}
            />

            <primitive
                object={model}
            />
        </group>
    );
}