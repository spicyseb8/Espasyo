import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Asset } from "../engine/assets/Asset";
import type { SavedDoor } from "../ProjectTypes";
import { emitAdminCommentTarget } from "../../../services/assets/adminCommentEvents";
import AdminModelErrorBoundary from "./AdminModelErrorBoundary";
import {
    fitAdminElementModelToBounds,
    prepareAdminDoorModel
} from "./AdminElementModelUtils";
import { disposeClonedMaterials } from "@/lib/disposeClonedMaterials";

interface AdminDoorProps {
    door: SavedDoor;
    asset: Asset;
    wallThickness: number;
    onSelect?: (doorId: string) => void;
}

const DOOR_CASING_WIDTH = 0.075;
const DOOR_CASING_DEPTH = 0.028;
const DOOR_CASING_GAP = 0.004;
const DOOR_CASING_COLOR = "#E9E5DE";

function DoorCasing({
    doorId,
    width,
    height,
    wallThickness
}: {
    doorId: string;
    width: number;
    height: number;
    wallThickness: number;
}) {
    const sideOffset =
        wallThickness * 0.5 +
        DOOR_CASING_DEPTH * 0.5 +
        DOOR_CASING_GAP;

    const leftX =
        -(
            width * 0.5 +
            DOOR_CASING_WIDTH * 0.5
        );

    const rightX =
        width * 0.5 +
        DOOR_CASING_WIDTH * 0.5;

    const verticalY =
        height * 0.5;

    const headY =
        height +
        DOOR_CASING_WIDTH * 0.5;

    const headWidth =
        width +
        DOOR_CASING_WIDTH * 2;

    const sides = [-1, 1] as const;

    return (
        <group>
            {sides.map(side => {
                const z =
                    side *
                    sideOffset;

                return (
                    <group
                        key={`admin-door-casing-${doorId}-${side}`}
                    >
                        <mesh
                            position={[
                                leftX,
                                verticalY,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    DOOR_CASING_WIDTH,
                                    height,
                                    DOOR_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={DOOR_CASING_COLOR}
                                roughness={0.78}
                                metalness={0}
                            />
                        </mesh>

                        <mesh
                            position={[
                                rightX,
                                verticalY,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    DOOR_CASING_WIDTH,
                                    height,
                                    DOOR_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={DOOR_CASING_COLOR}
                                roughness={0.78}
                                metalness={0}
                            />
                        </mesh>

                        <mesh
                            position={[
                                0,
                                headY,
                                z
                            ]}
                            castShadow
                            receiveShadow
                            raycast={() => {}}
                        >
                            <boxGeometry
                                args={[
                                    headWidth,
                                    DOOR_CASING_WIDTH,
                                    DOOR_CASING_DEPTH
                                ]}
                            />
                            <meshStandardMaterial
                                color={DOOR_CASING_COLOR}
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

export default function AdminDoor({
    door,
    asset,
    wallThickness,
    onSelect
}: AdminDoorProps) {
    if (
        typeof asset.model !== "string" ||
        asset.model.trim() === ""
    ) {
        console.warn(
            "Admin door has no valid model URL:",
            door.assetId
        );

        return null;
    }

    return (
        <AdminModelErrorBoundary assetId={asset.id}>
            <AdminDoorModel
                door={door}
                asset={asset}
                wallThickness={wallThickness}
                onSelect={onSelect}
            />
        </AdminModelErrorBoundary>
    );
}

function AdminDoorModel({
    door,
    asset,
    wallThickness,
    onSelect
}: AdminDoorProps) {
    const { scene } = useGLTF(asset.model);

    const model = useMemo(() => {
        const clone = prepareAdminDoorModel(scene, asset);
        fitAdminElementModelToBounds(clone, {
            width: door.width,
            height: door.height,
            depth: door.depth
        });

        clone.traverse(child => {
            child.userData = {
                ...child.userData,
                doorId: door.id
            };

            if (child instanceof Mesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(
                        material => material.clone()
                    );
                } else if (child.material) {
                    child.material = child.material.clone();
                }

                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return clone;
    }, [
        scene,
        door.width,
        door.height,
        door.depth,
        asset.scale,
        door.id
    ]);

    useEffect(() => {
        return () => disposeClonedMaterials(model);
    }, [model]);

    const rotationOffsetY =
        asset.rotationOffsetY ??
        Math.PI / 2;

    const finalRotationY =
        door.rotationY +
        rotationOffsetY;

    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect?.(door.id);

        emitAdminCommentTarget({
            targetType: "door",
            targetId: door.id,
            targetLabel: `Door: ${asset.name}`
        });
    };

    return (
        <group
            position={[
                door.position.x,
                door.position.y,
                door.position.z
            ]}
            rotation={[
                0,
                finalRotationY,
                0
            ]}
            userData={{
                doorId: door.id
            }}
            onClick={handleClick}
        >
            <DoorCasing
                doorId={door.id}
                width={door.wallWidth ?? door.width}
                height={door.height}
                wallThickness={wallThickness}
            />

            <primitive
                object={model}
            />
        </group>
    );
}