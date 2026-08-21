import { useMemo } from "react";

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

    const asset =
        findAsset(assetId);

    //--------------------------------------------------
    // Don't render missing assets
    //--------------------------------------------------

    if (!asset) {
        return null;
    }

    //--------------------------------------------------
    // Load model
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset.model
    );

    //--------------------------------------------------
    // Clone and scale model
    //--------------------------------------------------

    const model =
        useMemo(
            () => {

                const clone =
                    scene.clone();

                //--------------------------------------------------
                // Apply real-world furniture dimensions
                //--------------------------------------------------

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

                return clone;

            },
            [
                scene,
                asset.furnitureDimensions
            ]
        );

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <group
            position={position}
            rotation={[
                0,
                rotationY,
                0
            ]}
        >

            <primitive
                object={model}
                position={modelOffset}
            />

        </group>

    );
}

export default function FurnitureScene() {

    const { state } =
        useEditor();

    const furnitureList =
        Array.isArray(
            state?.furniture
        )
            ? state.furniture
            : [];

    return (

        <group>

            {
                furnitureList.map(
                    furniture => (

                        <FurnitureItem

                            key={
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
                )
            }

        </group>
    );
}