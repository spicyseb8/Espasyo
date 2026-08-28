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

import useEditor from "../../context/editor/useEditor";

import {
    buildInteraction
} from "./BuildInteraction";

import {
    hitWallByRaycast
} from "../../engine/walls/wallHit";

import {
    buildPlacement
} from "./BuildPlacement";

import type {
    AssetBounds
} from "./AssetBounds";

import {
    BuildTool
} from "../../context/BuildTool";

import {
    normalizeWindowModel
} from "../../engine/windows/normalizeWindowModel";


// ============================================================
// OPENING PREVIEW
// ============================================================

function OpeningPreview() {

    const { state } =
        useEditor();

    const {
        camera,
        scene
    } =
        useThree();

    const previewRef =
        useRef<Group>(null);

    const asset =
        state.selectedAsset;

    if (!asset) {
        return null;
    }


    // --------------------------------------------------------
    // Opening dimensions
    // --------------------------------------------------------

    const width =
        state.openingWidth;

    const height =
        state.openingHeight;

    const archRise =
        state.archRise;


    // --------------------------------------------------------
    // Opening bounds
    // --------------------------------------------------------

    const bounds: AssetBounds = {

        width,

        height,

        depth:
            state.wallThickness

    };


    // --------------------------------------------------------
    // Opening geometry
    // --------------------------------------------------------

    const openingGeometry =
        useMemo(() => {

            const shape =
                new Shape();


            // =================================================
            // RECTANGLE
            // =================================================

            if (
                asset.openingShape !== "arch"
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


            // =================================================
            // ARCH
            // =================================================

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
                    height - rise;


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

        }, [
            asset.openingShape,
            width,
            height,
            archRise
        ]);


    // --------------------------------------------------------
    // Update opening preview
    // --------------------------------------------------------

    useFrame(() => {

        if (!previewRef.current) {
            return;
        }


        buildInteraction.raycaster.setFromCamera(
            buildInteraction.pointer,
            camera
        );


        const hit =
            hitWallByRaycast(
                buildInteraction.raycaster,
                scene.children,
                state.walls
            );


        if (!hit) {

            buildInteraction.currentPlacement =
                null;

            buildInteraction.currentBounds =
                null;

            previewRef.current.visible =
                false;

            return;

        }


        const transform =
            buildPlacement(
                hit.wall,
                hit.point,
                asset,
                state.wallHeight,
                bounds
            );


        buildInteraction.currentPlacement =
            transform;

        buildInteraction.currentBounds =
            bounds;


        previewRef.current.visible =
            true;


        // ----------------------------------------------------
        // Position opening preview
        // ----------------------------------------------------

        const previewPosition = transform.position.clone();

previewPosition.add(
    transform.wallNormal.clone()
        .multiplyScalar(state.wallThickness * 0.5 + 0.01)
);

previewRef.current.position.copy(previewPosition);

        // ----------------------------------------------------
        // Align with wall
        // ----------------------------------------------------

        previewRef.current.rotation.y =
            transform.rotationY -
            Math.PI / 2;

    });


    return (

        <group
            ref={previewRef}
        >

            <mesh
                geometry={openingGeometry}
            >

                <meshStandardMaterial

                    color="#4DA3FF"

                    transparent

                    opacity={0.55}

                    depthTest={false}

                    depthWrite={false}

                    side={2}

                />

            </mesh>

        </group>

    );

}


// ============================================================
// MODEL PREVIEW
// Door / Window
// ============================================================

function ModelPreview() {

    const { state } =
        useEditor();

    const {
        camera,
        scene
    } =
        useThree();

    const previewRef =
        useRef<Group>(null);

    const asset =
        state.selectedAsset;

    if (!asset) {
        return null;
    }


    // --------------------------------------------------------
    // Load GLB
    // --------------------------------------------------------

    const {
        scene: gltfScene
    } =
        useGLTF(asset.model);


    // ========================================================
    // WINDOW MODEL
    // ========================================================

    const normalizedWindow =
        useMemo(() => {

            if (
                asset.type !==
                BuildTool.Window
            ) {
                return null;
            }


            return normalizeWindowModel(
                gltfScene,
                asset
            );

        }, [
            gltfScene,
            asset
        ]);


    // ========================================================
    // DOOR MODEL
    // ========================================================

    const doorModel =
        useMemo(() => {

            if (
                asset.type ===
                BuildTool.Window
            ) {
                return null;
            }


            return gltfScene.clone(true);

        }, [
            gltfScene,
            asset.type
        ]);


    // ========================================================
    // Select model
    // ========================================================

    const model =
        asset.type === BuildTool.Window
            ? normalizedWindow?.model ?? null
            : doorModel;


    if (!model) {
        return null;
    }


    // ========================================================
    // DOOR BOUNDS
    // ========================================================

    const doorBounds =
        useMemo(() => {

            if (
                asset.type ===
                BuildTool.Window
            ) {
                return null;
            }


            const box =
                new Box3()
                    .setFromObject(model);


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

        }, [
            model,
            asset.type
        ]);


    // ========================================================
    // PLACEMENT BOUNDS
    // ========================================================

    const bounds:
        AssetBounds =

        useMemo(() => {

            // ------------------------------------------------
            // Window
            // ------------------------------------------------

            if (
                asset.type ===
                BuildTool.Window
            ) {

                if (
                    !normalizedWindow
                ) {

                    return {

                        width: 1,

                        height: 1,

                        depth: 0.1

                    };

                }


                return {

                    width:
                        normalizedWindow.bounds.width,

                    height:
                        normalizedWindow.bounds.height,

                    depth:
                        normalizedWindow.bounds.depth

                };

            }


            // ------------------------------------------------
            // Door
            // ------------------------------------------------

            return {

                width:
                    doorBounds?.width ?? 1,

                height:
                    doorBounds?.height ?? 2,

                depth:
                    doorBounds?.depth ?? 0.1

            };

        }, [
            asset.type,
            normalizedWindow,
            doorBounds
        ]);


    // ========================================================
    // Preview material
    // ========================================================

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
                            false,

                        depthWrite:
                            false

                    });


                child.renderOrder =
                    1000;

            }
        );

    }, [model]);


    // ========================================================
    // UPDATE PREVIEW
    // ========================================================

    useFrame(() => {

        if (!previewRef.current) {
            return;
        }


        buildInteraction.raycaster.setFromCamera(
            buildInteraction.pointer,
            camera
        );


        const hit =
            hitWallByRaycast(
                buildInteraction.raycaster,
                scene.children,
                state.walls
            );


        // ----------------------------------------------------
        // No wall
        // ----------------------------------------------------

        if (!hit) {

            buildInteraction.currentPlacement =
                null;

            buildInteraction.currentBounds =
                null;

            previewRef.current.visible =
                false;

            return;

        }


        // ----------------------------------------------------
        // Calculate placement
        // ----------------------------------------------------

        const transform =
            buildPlacement(
                hit.wall,
                hit.point,
                asset,
                state.wallHeight,
                bounds
            );


        buildInteraction.currentPlacement =
            transform;

        buildInteraction.currentBounds =
            bounds;


        previewRef.current.visible =
            true;


        // ----------------------------------------------------
        // Position
        // ----------------------------------------------------

        previewRef.current.position.copy(
            transform.position
        );


        // ----------------------------------------------------
        // Wall rotation
        // ----------------------------------------------------

        previewRef.current.rotation.y =
            transform.rotationY;

    });


    // ========================================================
    // Asset rotation offset
    // ========================================================

    const rotationOffsetY =
        asset.rotationOffsetY ?? 0;


    // ========================================================
    // Render
    // ========================================================

    return (

        <group
            ref={previewRef}
        >

            <group
                rotation={[
                    0,
                    rotationOffsetY,
                    0
                ]}
            >

                <primitive
                    object={model}
                />

            </group>

        </group>

    );

}


// ============================================================
// PREVIEW SWITCH
// ============================================================

function PreviewModel() {

    const { state } =
        useEditor();


    if (
        state.selectedAsset?.type ===
        BuildTool.Opening
    ) {

        return (
            <OpeningPreview />
        );

    }


    return (
        <ModelPreview />
    );

}


// ============================================================
// MAIN ASSET PREVIEW
// ============================================================

export default function AssetPreview() {

    const { state } =
        useEditor();


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
        state.buildTool ===
        BuildTool.None
    ) {
        return null;
    }


    if (
        state.buildTool !==
        state.selectedAsset.type
    ) {
        return null;
    }


    return (

        <Suspense
            fallback={null}
        >

            <PreviewModel />

        </Suspense>

    );

}