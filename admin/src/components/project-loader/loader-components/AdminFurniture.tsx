import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import type { Asset } from "../engine/assets/Asset";
import type { SavedFurniture } from "../ProjectTypes";
import { emitAdminCommentTarget } from "../../../services/assets/adminCommentEvents";

interface AdminFurnitureProps {
    furniture: SavedFurniture;
    asset: Asset;
}

export default function AdminFurniture({
    furniture,
    asset
}: AdminFurnitureProps) {
    if (
        typeof asset.model !== "string" ||
        asset.model.trim() === ""
    ) {
        console.warn(
            "Admin furniture has no valid model URL:",
            {
                furnitureId: furniture.id,
                assetId: furniture.assetId
            }
        );

        return null;
    }

    return (
        <AdminFurnitureModel
            furniture={furniture}
            asset={asset}
        />
    );
}

function AdminFurnitureModel({
    furniture,
    asset
}: AdminFurnitureProps) {
    const { scene } = useGLTF(asset.model);

    const model = useMemo(() => {
        const clone = scene.clone(true);

        clone.traverse(child => {
            child.userData = {
                ...child.userData,
                furnitureId: furniture.id
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
        furniture.id
    ]);

    const modelOffset = furniture.modelOffset;

    const finalRotationY =
        furniture.rotationY +
        (asset.rotationOffsetY ?? 0);

    const handleClick = (event: any) => {
        event.stopPropagation();

        emitAdminCommentTarget({
            targetType: "furniture",
            targetId: furniture.id,
            targetLabel: `Furniture: ${asset.name}`
        });
    };

    return (
        <group
            position={[
                furniture.position.x,
                furniture.position.y,
                furniture.position.z
            ]}
            rotation={[
                0,
                finalRotationY,
                0
            ]}
            userData={{
                furnitureId: furniture.id
            }}
            onClick={handleClick}
        >
            <primitive
                object={model}
                position={[
                    modelOffset.x,
                    modelOffset.y,
                    modelOffset.z
                ]}
            />
        </group>
    );
}