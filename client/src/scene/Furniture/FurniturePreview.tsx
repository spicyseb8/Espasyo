import {
    Suspense,
    useEffect,
    useMemo,
    useRef
} from "react";

import {
    useFrame,
    useThree
} from "@react-three/fiber";

import {
    useGLTF
} from "@react-three/drei";

import {
    Box3,
    Group,
    Vector3,
    Mesh,
    MeshStandardMaterial
} from "three";

import useEditor from "../../context/editor/useEditor";

import {
    getFurnitureScale
} from "./FurnitureSizing";

import {
    furnitureInteraction
} from "./FurnitureInteraction";

import {
    snapFurniturePlacement
} from "./FurnitureSnapping";

import type {
    AssetBounds
} from "../Build/AssetBounds";

import {
    hitFloorByRaycast,
    getFloorObjects
} from "../../engine/floors/floorHit";

import {
    buildFurniturePlacement
} from "./FurniturePlacement";

import {
    checkFurnitureCollision
} from "../../engine/furniture/FurnitureCollision";

import {
    BuildTool
} from "../../context/BuildTool";

//==================================================
// Actual furniture preview model
//==================================================

function FurniturePreviewModel() {

    const { state } =
        useEditor();

    const {
        camera,
        scene
    } = useThree();

    //--------------------------------------------------
    // At this point asset is guaranteed to exist
    // because the parent component only renders us
    // when a furniture asset is selected.
    //--------------------------------------------------

    const asset =
        state.selectedAsset!;

    const previewRef =
        useRef<Group>(null);

    //--------------------------------------------------
    // Floor objects
    //--------------------------------------------------

    const floorObjects =
        useMemo(
            () =>
                getFloorObjects(scene),
            [scene]
        );

    //--------------------------------------------------
    // Load GLB
    //--------------------------------------------------

    const {
        scene: gltfScene
    } = useGLTF(
        asset.model
    );

    //--------------------------------------------------
    // Clone once
    //--------------------------------------------------

    const model =
    useMemo(
        () => {

            const clone =
                gltfScene.clone();

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
            gltfScene,
            asset.furnitureDimensions
        ]
    );

    //--------------------------------------------------
    // Preview material
    //--------------------------------------------------

    useEffect(() => {

        model.traverse(
            (child) => {

                if (
                    !(child instanceof Mesh)
                ) {
                    return;
                }

                child.material =
                    new MeshStandardMaterial({
                        color:
                            "#4DA3FF",

                        transparent:
                            true,

                        opacity:
                            0.55,

                        depthTest:
                            false
                    });

                child.renderOrder =
                    1000;

            }
        );

    }, [model]);

    //--------------------------------------------------
    // Measure model
    //--------------------------------------------------

    const bounds:
        AssetBounds =
        useMemo(() => {

            const box =
                new Box3()
                    .setFromObject(
                        model
                    );

            const size =
                new Vector3();

            box.getSize(size);

            return {

                width:
                    size.x,

                height:
                    size.y,

                depth:
                    size.z

            };

        }, [model]);

    //--------------------------------------------------
    // Live preview
    //--------------------------------------------------

    useFrame(() => {

        if (
            !previewRef.current
        ) {
            return;
        }

        //--------------------------------------------------
        // Raycast against floor
        //--------------------------------------------------

        furnitureInteraction
            .raycaster
            .setFromCamera(
                furnitureInteraction.pointer,
                camera
            );

        const floorHit =
            hitFloorByRaycast(
                furnitureInteraction.raycaster,
                floorObjects
            );

        //--------------------------------------------------
        // No floor hit
        //--------------------------------------------------

        if (!floorHit) {

            furnitureInteraction
                .clearPreview();

            previewRef.current.visible =
                false;

            return;
        }
        //--------------------------------------------------
        // Base furniture placement
        //--------------------------------------------------


     //--------------------------------------------------
// Base placement
//--------------------------------------------------

const transform =
    buildFurniturePlacement(
        floorHit.point,
        asset,
        bounds,
        furnitureInteraction.rotationY
    );

//--------------------------------------------------
// Snap position
//
// Rotation is preserved.
//--------------------------------------------------

const snappedTransform =
    snapFurniturePlacement(
        floorHit.point,
        transform,
        bounds,
        state.walls,
        state.furniture,
        state.wallThickness
    );

//--------------------------------------------------
// Collision AFTER snapping
//--------------------------------------------------

const collision =
    checkFurnitureCollision(
        snappedTransform.position,
        bounds.width,
        bounds.depth,
        snappedTransform.rotationY,
        state.walls,
        state.furniture,
        state.wallThickness,
        0.01
    );

//--------------------------------------------------
// Store
//--------------------------------------------------

furnitureInteraction.currentPlacement =
    snappedTransform;

furnitureInteraction.currentBounds =
    bounds;

furnitureInteraction.currentCollision =
    collision;

//--------------------------------------------------
// Preview position
//--------------------------------------------------

previewRef.current.visible =
    true;

previewRef.current.position.copy(
    snappedTransform.position
);

previewRef.current.rotation.y =
    snappedTransform.rotationY;

        //--------------------------------------------------
        // Blue / Red
        //--------------------------------------------------

        model.traverse(
            (child) => {

                if (
                    !(child instanceof Mesh)
                ) {
                    return;
                }

                if (
                    child.material
                        instanceof
                    MeshStandardMaterial
                ) {

                    child.material.color.set(
                        collision.valid
                            ? "#4DA3FF"
                            : "#D9534F"
                    );
                }
            }
        );

    });

    return (
        <group ref={previewRef}>

            <primitive object={model} />

        </group>
    );
}

//==================================================
// Wrapper
//==================================================

export default function FurniturePreview() {

    const { state } =
        useEditor();

    //--------------------------------------------------
    // Conditions are checked BEFORE rendering the
    // component that contains the hooks.
    //--------------------------------------------------

    if (
        !state.layoutConfirmed
    ) {
        return null;
    }

    if (
        !state.selectedAsset
    ) {
        return null;
    }

    if (
        state.selectedAsset.type !==
        BuildTool.Furniture
    ) {
        return null;
    }

    if (
        state.buildTool !==
        BuildTool.Furniture
    ) {
        return null;
    }

    return (

        <Suspense fallback={null}>

            <FurniturePreviewModel />

        </Suspense>

    );
}