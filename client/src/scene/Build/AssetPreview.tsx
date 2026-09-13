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

import {
    findAsset
} from "../../assets/AssetLibrary";


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
            // Wait for pointer
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
            // Find wall
            //--------------------------------------------------

            const hit =
                hitWallByRaycast(
                    buildInteraction.raycaster,
                    scene.children,
                    state.walls
                );


            if (
                !hit
            ) {

                previewRef.current.visible =
                    false;

                buildInteraction.clear();

                return;
            }


            //--------------------------------------------------
            // Store EXACT wall ID
            //--------------------------------------------------

            buildInteraction.currentWallId =
                hit.wall.id;


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
            // Store preview
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
                mesh.material instanceof
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

function DoorWindowPreview({
    asset
}: {
    asset:
        NonNullable<
            ReturnType<
                typeof findAsset
            >
        >;
}) {

    const {
        state
    } = useEditor();

    const {
        camera,
        scene
    } = useThree();

    const previewRef =
        useRef<Group>(null);


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

                if (
                    !model
                ) {

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

            if (
                !model
            ) {

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
            // Wait for pointer
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
            // Determine move target
            //--------------------------------------------------

            const moveTarget =
                buildInteraction.moveTarget;


            const movingDoor =
                moveTarget?.type ===
                    "door"

                    ? state.doors.find(
                        door =>
                            door.id ===
                            moveTarget.id
                    ) ?? null

                    : null;


            const movingWindow =
                moveTarget?.type ===
                    "window"

                    ? state.windows.find(
                        window =>
                            window.id ===
                            moveTarget.id
                    ) ?? null

                    : null;


            //--------------------------------------------------
            // Find ANY wall
            //--------------------------------------------------

            const hit =
                hitWallByRaycast(
                    buildInteraction.raycaster,
                    scene.children,
                    state.walls
                );


            if (
                !hit
            ) {

                previewRef.current.visible =
                    false;

                buildInteraction.clear();

                return;
            }


            //--------------------------------------------------
            // Store EXACT target wall
            //--------------------------------------------------

            buildInteraction.currentWallId =
                hit.wall.id;


            //--------------------------------------------------
            // Build placement using TARGET wall
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
            // Exclude moving object from collision
            //--------------------------------------------------

            const doorsForCollision =
                movingDoor

                    ? state.doors.filter(
                        door =>
                            door.id !==
                            movingDoor.id
                    )

                    : state.doors;


            const windowsForCollision =
                movingWindow

                    ? state.windows.filter(
                        window =>
                            window.id !==
                            movingWindow.id
                    )

                    : state.windows;


            //--------------------------------------------------
            // Collision
            //--------------------------------------------------

            const collision =
                checkBuildElementCollision(
                    asset,
                    transform,
                    bounds,
                    doorsForCollision,
                    windowsForCollision,
                    state.openings,
                    state.wallHeight
                );


            //--------------------------------------------------
            // Store preview
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
            // Rotation
            //
            // There is still NO manual rotation.
            //
            // The TARGET WALL controls orientation.
            //--------------------------------------------------

            previewRef.current.rotation.y =
                transform.rotationY;


            //--------------------------------------------------
            // Color
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
    // Existing Door / Window Move
    //--------------------------------------------------

    if (
        buildInteraction.moveTarget
    ) {

        const target =
            buildInteraction.moveTarget;


        const moveAsset =
            target.type ===
                "door"

                ? findAsset(
                    state.doors.find(
                        door =>
                            door.id ===
                            target.id
                    )?.assetId ??
                    ""
                )

                : findAsset(
                    state.windows.find(
                        window =>
                            window.id ===
                            target.id
                    )?.assetId ??
                    ""
                );


        if (
            !moveAsset
        ) {

            return null;
        }


        return (

            <DoorWindowPreview
                asset={
                    moveAsset
                }
            />

        );
    }


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
    // Normal Door / Window
    //--------------------------------------------------

    if (
        state.selectedAsset?.type ===
            BuildTool.Door ||

        state.selectedAsset?.type ===
            BuildTool.Window
    ) {

        return (

            <DoorWindowPreview
                asset={
                    state.selectedAsset
                }
            />

        );
    }


    //--------------------------------------------------
    // Furniture handled by FurniturePreview.
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
    // Existing Door / Window Move
    //--------------------------------------------------

    if (
        buildInteraction.moveTarget
    ) {

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


    //--------------------------------------------------
    // Normal placement
    //--------------------------------------------------

    if (
        !state.selectedAsset
    ) {

        return null;
    }


    if (
        state.buildTool ===
        BuildTool.None
    ) {

        return null;
    }


    //--------------------------------------------------
    // Tool and asset must match
    //--------------------------------------------------

    if (
        state.buildTool !==
        state.selectedAsset.type
    ) {

        return null;
    }


    //--------------------------------------------------
    // Door / Window / Opening only
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