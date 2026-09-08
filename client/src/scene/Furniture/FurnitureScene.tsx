import {
    useMemo
} from "react";

import {
    useGLTF
} from "@react-three/drei";

import {
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getFurnitureScale
} from "./FurnitureSizing";

function FurnitureItem({
    id,
    assetId,
    position,
    rotationY,
    modelOffset
}: {
    id: string;
    assetId: string;
    position: Vector3;
    rotationY: number;
    modelOffset: Vector3;
}) {
    const asset =
        findAsset(
            assetId
        );

    if (!asset) {
        return null;
    }

    const {
        scene
    } = useGLTF(
        asset.model
    );

    const model =
        useMemo(
            () => {
                const clone =
                    scene.clone();

                if (
                    asset.furnitureDimensions
                ) {
                    const scale =
                        getFurnitureScale(
                            clone,
                            asset.furnitureDimensions
                        );

                    clone.scale.copy(
                        scale
                    );
                }

                //--------------------------------------------------
                // Mark the complete furniture hierarchy
                //--------------------------------------------------

                clone.traverse(
                    child => {
                        child.userData.furnitureId =
                            id;
                    }
                );

                return clone;
            },
            [
                scene,
                asset.furnitureDimensions,
                id
            ]
        );

    return (
        <group
            position={
                position
            }
            rotation={[
                0,
                rotationY,
                0
            ]}
            userData={{
                furnitureId:
                    id
            }}
        >
            <primitive
                object={
                    model
                }
                position={
                    modelOffset
                }
            />
        </group>
    );
}

export default function FurnitureScene() {
    const {
        state
    } = useEditor();

    const furnitureList =
        Array.isArray(
            state?.furniture
        )
            ? state.furniture
            : [];

    return (
        <group>
            {furnitureList.map(
                furniture => (
                    <FurnitureItem
                        key={
                            furniture.id
                        }
                        id={
                            furniture.id
                        }
                        assetId={
                            furniture.assetId
                        }
                        position={
                            furniture.position
                        }
                        rotationY={
                            furniture.rotationY
                        }
                        modelOffset={
                            furniture.modelOffset
                        }
                    />
                )
            )}
        </group>
    );
}