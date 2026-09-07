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
    Mesh,
    MeshStandardMaterial,
    Shape,
    ShapeGeometry,
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import {
    buildInteraction
} from "./BuildInteraction";

import {
    buildPlacement
} from "./BuildPlacement";

import {
    hitWallByRaycast
} from "../../engine/walls/wallHit";

import {
    checkBuildElementCollision
} from "./BuildElementCollision";

import {
    BuildTool
} from "../../context/BuildTool";

import type {
    AssetBounds
} from "./AssetBounds";

import {
    normalizeWindowModel
} from "../../engine/windows/normalizeWindowModel";

//============================================================
// OPENING PREVIEW
//============================================================

function OpeningPreview() {

    const {
        state
    } = useEditor();

    const {
        camera,
        scene
    } = useThree();

    const previewRef =
        useRef<Group>(null);

    const asset =
        state.selectedAsset!;

    //--------------------------------------------------
    // Opening dimensions
    //--------------------------------------------------

    const width =
        state.openingWidth;

    const height =
        state.openingHeight;

    const archRise =
        state.archRise;

    //--------------------------------------------------
    // Bounds
    //--------------------------------------------------

    const bounds:
        AssetBounds = {

        width,

        height,

        depth:
            state.wallThickness
    };

    //--------------------------------------------------
    // Geometry
    //--------------------------------------------------

    const geometry =
        useMemo(
            () => {

                const shape =
                    new Shape();

                //--------------------------------------------------
                // Rectangle
                //--------------------------------------------------

                if (
                    asset.openingShape !==
                    "arch"
                ) {

                    shape.moveTo(
                        -width / 2,
                        0
                    );

                    shape.lineTo(
                        width / 2,
                        0
                    );

                    shape.lineTo(
                        width / 2,
                        height
                    );

                    shape.lineTo(
                        -width / 2,
                        height
                    );

                    shape.closePath();
                }

                //--------------------------------------------------
                // Arch
                //--------------------------------------------------

                else {

                    const rise =
                        Math.max(
                            0,
                            Math.min(
                                archRise,
                                height
                            )
                        );

                    const springHeight =
                        height -
                        rise;

                    shape.moveTo(
                        -width / 2,
                        0
                    );

                    shape.lineTo(
                        width / 2,
                        0
                    );

                    shape.lineTo(
                        width / 2,
                        springHeight
                    );

                    shape.quadraticCurveTo(
                        0,
                        height,
                        -width / 2,
                        springHeight
                    );

                    shape.lineTo(
                        -width / 2,
                        0
                    );

                    shape.closePath();
                }

                return new ShapeGeometry(
                    shape
                );

            },
            [
                asset.openingShape,
                width,
                height,
                archRise
            ]
        );

    //--------------------------------------------------
    // Preview update
    //--------------------------------------------------

    useFrame(
        () => {

            if (
                !previewRef.current
            ) {
                return;
            }

            //--------------------------------------------------
            // Do not use camera center.
            //--------------------------------------------------

            if (
                !buildInteraction.hasPointer
            ) {

                previewRef.current.visible =
                    false;

                buildInteraction.clear();

                return;
            }

            //--------------------------------------------------
            // Mouse ray
            //--------------------------------------------------

            buildInteraction.raycaster.setFromCamera(
                buildInteraction.pointer,
                camera
            );

            //--------------------------------------------------
            // Find wall under mouse
            //--------------------------------------------------

            const hit =
                hitWallByRaycast(
                    buildInteraction.raycaster,
                    scene.children,
                    state.walls
                );

            if (!hit) {

                previewRef.current.visible =
                    false;

                buildInteraction.clear();

                return;
            }

            //--------------------------------------------------
            // Placement
            //--------------------------------------------------

            const transform =
                buildPlacement(
                    hit.wall,
                    hit.point,
                    asset,
                    state.wallHeight,
                    bounds
                );

            //--------------------------------------------------
            // Collision
            //--------------------------------------------------

            const collision =
                checkBuildElementCollision(
                    asset,
                    transform,
                    bounds,
                    state.doors,
                    state.windows,
                    state.openings,
                    state.wallHeight
                );

            //--------------------------------------------------
            // Store
            //--------------------------------------------------

            buildInteraction.currentPlacement =
                transform;

            buildInteraction.currentBounds =
                bounds;

            buildInteraction.currentCollision =
                collision;

            //--------------------------------------------------
            // Show
            //--------------------------------------------------

            previewRef.current.visible =
                true;

            //--------------------------------------------------
            // Position
            //--------------------------------------------------

            const previewPosition =
                transform.position.clone();

            previewPosition.add(
                transform.wallNormal
                    .clone()
                    .multiplyScalar(
                        state.wallThickness *
                        0.5 +
                        0.01
                    )
            );

            previewRef.current.position.copy(
                previewPosition
            );

            //--------------------------------------------------
            // Rotation
            //--------------------------------------------------

            previewRef.current.rotation.y =
                transform.rotationY -
                Math.PI / 2;

            //--------------------------------------------------
            // Blue / Red
            //--------------------------------------------------

            const mesh =
                previewRef.current
                    .children[0];

            if (
                mesh instanceof Mesh &&
                mesh.material
                    instanceof
                MeshStandardMaterial
            ) {

                mesh.material.color.set(
                    collision.valid
                        ? "#4DA3FF"
                        : "#D9534F"
                );
            }
        }
    );

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <group
            ref={
                previewRef
            }
        >

            <mesh
                geometry={
                    geometry
                }
            >

                <meshStandardMaterial

                    color={
                        "#4DA3FF"
                    }

                    transparent

                    opacity={
                        0.55
                    }

                    depthTest={
                        false
                    }

                    depthWrite={
                        false
                    }

                    side={
                        2
                    }

                />

            </mesh>

        </group>
    );
}

//============================================================
// DOOR / WINDOW PREVIEW
//============================================================

function DoorWindowPreview() {

    const {
        state
    } = useEditor();

    const {
        camera,
        scene
    } = useThree();

    const previewRef =
        useRef<Group>(null);

    const asset =
        state.selectedAsset!;

    //--------------------------------------------------
    // Load GLB
    //--------------------------------------------------

    const {
        scene: sourceModel
    } = useGLTF(
        asset.model
    );

    //--------------------------------------------------
    // Window normalization
    //--------------------------------------------------

    const normalizedWindow =
        useMemo(
            () => {

                if (
                    asset.type !==
                    BuildTool.Window
                ) {
                    return null;
                }

                return normalizeWindowModel(
                    sourceModel,
                    asset
                );

            },
            [
                sourceModel,
                asset
            ]
        );

    //--------------------------------------------------
    // Door clone
    //--------------------------------------------------

    const doorModel =
        useMemo(
            () => {

                if (
                    asset.type !==
                    BuildTool.Door
                ) {
                    return null;
                }

                const clone =
                    sourceModel.clone(
                        true
                    );

                const scale =
                    asset.scale ??
                    1;

                clone.scale.set(
                    scale,
                    scale,
                    scale
                );

                return clone;

            },
            [
                sourceModel,
                asset.type,
                asset.scale
            ]
        );

    //--------------------------------------------------
    // Select model
    //--------------------------------------------------

    const model =
        asset.type ===
        BuildTool.Window

            ? normalizedWindow?.model ??
              null

            : doorModel;

    //--------------------------------------------------
    // Bounds
    //--------------------------------------------------

    const bounds:
        AssetBounds =
        useMemo(
            () => {

                if (!model) {

                    return {

                        width:
                            1,

                        height:
                            1,

                        depth:
                            0.1
                    };
                }

                const box =
                    new Box3()
                        .setFromObject(
                            model
                        );

                const size =
                    new Vector3();

                box.getSize(
                    size
                );

                return {

                    width:
                        size.x,

                    height:
                        size.y,

                    depth:
                        size.z
                };

            },
            [
                model
            ]
        );

    //--------------------------------------------------
    // Preview material
    //--------------------------------------------------

    useEffect(
        () => {

            if (!model) {
                return;
            }

            model.traverse(
                child => {

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

                            //--------------------------------------------------
                            // Doors/windows are inserted into walls.
                            //--------------------------------------------------

                            depthTest:
                                false,

                            depthWrite:
                                false
                        });

                    child.renderOrder =
                        1000;
                }
            );

        },
        [
            model
        ]
    );

    //--------------------------------------------------
    // Preview update
    //--------------------------------------------------

    useFrame(
        () => {

            if (
                !previewRef.current ||
                !model
            ) {
                return;
            }

            //--------------------------------------------------
            // Wait until mouse actually moves over canvas.
            //--------------------------------------------------

            if (
                !buildInteraction.hasPointer
            ) {

                previewRef.current.visible =
                    false;

                buildInteraction.clear();

                return;
            }

            //--------------------------------------------------
            // Raycast
            //--------------------------------------------------

            buildInteraction.raycaster.setFromCamera(
                buildInteraction.pointer,
                camera
            );

            //--------------------------------------------------
            // Wall
            //--------------------------------------------------

            const hit =
                hitWallByRaycast(
                    buildInteraction.raycaster,
                    scene.children,
                    state.walls
                );

            if (!hit) {

                previewRef.current.visible =
                    false;

                buildInteraction.clear();

                return;
            }

            //--------------------------------------------------
            // Build placement
            //--------------------------------------------------

            const transform =
                buildPlacement(
                    hit.wall,
                    hit.point,
                    asset,
                    state.wallHeight,
                    bounds
                );

            //--------------------------------------------------
            // Collision
            //--------------------------------------------------

            const collision =
                checkBuildElementCollision(
                    asset,
                    transform,
                    bounds,
                    state.doors,
                    state.windows,
                    state.openings,
                    state.wallHeight
                );

            //--------------------------------------------------
            // Store
            //--------------------------------------------------

            buildInteraction.currentPlacement =
                transform;

            buildInteraction.currentBounds =
                bounds;

            buildInteraction.currentCollision =
                collision;

            //--------------------------------------------------
            // Show
            //--------------------------------------------------

            previewRef.current.visible =
                true;

            //--------------------------------------------------
            // Position
            //--------------------------------------------------

            previewRef.current.position.copy(
                transform.position
            );

            //--------------------------------------------------
            // Wall rotation
            //--------------------------------------------------

            previewRef.current.rotation.y =
                transform.rotationY;

            //--------------------------------------------------
            // Blue / Red
            //--------------------------------------------------

            const color =
                collision.valid
                    ? "#4DA3FF"
                    : "#D9534F";

            model.traverse(
                child => {

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
                            color
                        );
                    }
                }
            );
        }
    );

    //--------------------------------------------------
    // Asset rotation offset
    //--------------------------------------------------

    const rotationOffsetY =
        asset.rotationOffsetY ??
        0;

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (

        <group
            ref={
                previewRef
            }
        >

            <group
                rotation={[
                    0,
                    rotationOffsetY,
                    0
                ]}
            >

                {
                    model && (

                        <primitive
                            object={
                                model
                            }
                        />
                    )
                }

            </group>

        </group>
    );
}

//============================================================
// PREVIEW SWITCH
//============================================================

function PreviewModel() {

    const {
        state
    } = useEditor();

    //--------------------------------------------------
    // Opening
    //--------------------------------------------------

    if (
        state.selectedAsset?.type ===
        BuildTool.Opening
    ) {

        return (
            <OpeningPreview />
        );
    }

    //--------------------------------------------------
    // Door / Window
    //--------------------------------------------------

    if (
        state.selectedAsset?.type ===
            BuildTool.Door ||

        state.selectedAsset?.type ===
            BuildTool.Window
    ) {

        return (
            <DoorWindowPreview />
        );
    }

    //--------------------------------------------------
    // Furniture is handled by FurniturePreview.
    //--------------------------------------------------

    return null;
}

//============================================================
// MAIN
//============================================================

export default function AssetPreview() {

    const {
        state
    } = useEditor();

    //--------------------------------------------------
    // Walkthrough
    //--------------------------------------------------

    if (
        state.walkthroughMode
    ) {
        return null;
    }

    //--------------------------------------------------
    // Layout
    //--------------------------------------------------

    if (
        !state.layoutConfirmed
    ) {
        return null;
    }

    //--------------------------------------------------
    // No selected asset
    //--------------------------------------------------

    if (
        !state.selectedAsset
    ) {
        return null;
    }

    //--------------------------------------------------
    // IMPORTANT:
    //
    // selectedAsset alone does NOT activate preview.
    //
    // Apply must set buildTool first.
    //--------------------------------------------------

    if (
        state.buildTool ===
        BuildTool.None
    ) {
        return null;
    }

    //--------------------------------------------------
    // Tool and asset must match.
    //--------------------------------------------------

    if (
        state.buildTool !==
        state.selectedAsset.type
    ) {
        return null;
    }

    //--------------------------------------------------
    // AssetPreview handles only:
    //
    // Door
    // Window
    // Opening
    //
    // Furniture has FurniturePreview.
    //--------------------------------------------------

    if (
        state.selectedAsset.type !==
            BuildTool.Door &&

        state.selectedAsset.type !==
            BuildTool.Window &&

        state.selectedAsset.type !==
            BuildTool.Opening
    ) {
        return null;
    }

    return (

        <Suspense
            fallback={
                null
            }
        >

            <PreviewModel />

        </Suspense>
    );
}