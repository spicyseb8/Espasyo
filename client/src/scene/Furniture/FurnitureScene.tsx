import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Vector3 } from "three";

import useEditor from "../../context/editor/useEditor";
import { findAsset } from "../../assets/AssetLibrary";

function FurnitureItem({
    assetId,
    position,
    rotationY,
    modelOffset
}: {
    assetId: string;
    position: Vector3;
    rotationY: number;
    modelOffset: Vector3;
}) {

    const asset = findAsset(assetId);

    if (!asset)
        return null;

    const { scene } = useGLTF(asset.model);

    const model = useMemo(
        () => scene.clone(),
        [scene]
    );

    return (
        <group
            position={position}
            rotation={[0, rotationY, 0]}
        >
            <primitive
                object={model}
                position={modelOffset}
            />
        </group>
    );
}

export default function FurnitureScene() {

    const { state } = useEditor();
    const furnitureList = Array.isArray(state?.furniture) ? state.furniture : [];

    return (
        <group>
            {furnitureList.map(
                furniture => (

                    <FurnitureItem
                        key={furniture.id}
                        assetId={furniture.assetId}
                        position={furniture.position}
                        rotationY={furniture.rotationY}
                        modelOffset={furniture.modelOffset}
                    />

                )
            )}
        </group>
    );
}