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

import { useGLTF } from "@react-three/drei";

import {
    Box3,
    Group,
    Vector3,
    Mesh,
    MeshStandardMaterial
} from "three";

import useEditor from "../../context/editor/useEditor";

import { buildInteraction } from "./BuildInteraction";

import { hitWallByRaycast } from "../../engine/walls/wallHit";

import { buildPlacement } from "./BuildPlacement";

import type { AssetBounds } from "./AssetBounds";

import { BuildTool } from "../../context/BuildTool";


// ==================================================
// OPENING PREVIEW
// ==================================================

function OpeningPreview() {

    const { state } = useEditor();

    const { camera, scene } = useThree();

    const previewRef =
        useRef<Group>(null);

    const asset =
        state.selectedAsset;

    if (!asset) {
        return null;
    }


    // --------------------------------------------------
    // Opening dimensions
    // --------------------------------------------------

    const width = 1.0;

    const height = 2.0;

    // Very thin preview surface.
    // We don't need it to be as thick as the wall.
    const previewDepth = 0.025;


    // --------------------------------------------------
    // Fake bounds
    //
    // These are still used by BuildPlacement
    // to calculate the position along the wall.
    // --------------------------------------------------

    const bounds: AssetBounds = {

        width,

        height,

        depth: state.wallThickness
    };


    // --------------------------------------------------
    // Update preview
    // --------------------------------------------------

    useFrame(() => {

        if (!previewRef.current) {
            return;
        }


        // --------------------------------------------------
        // Raycast mouse against walls
        // --------------------------------------------------

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


        // --------------------------------------------------
        // Mouse is not over a wall
        // --------------------------------------------------

        if (!hit) {

            buildInteraction.currentPlacement =
                null;

            buildInteraction.currentBounds =
                null;

            previewRef.current.visible =
                false;

            return;
        }


        // --------------------------------------------------
        // Calculate wall placement
        // --------------------------------------------------

        const transform =
            buildPlacement(
                hit.wall,
                hit.point,
                asset,
                state.wallHeight,
                bounds
            );


        // --------------------------------------------------
        // Store placement for BuildInteractionEvents
        // --------------------------------------------------

        buildInteraction.currentPlacement =
            transform;

        buildInteraction.currentBounds =
            bounds;


        // --------------------------------------------------
        // Show preview
        // --------------------------------------------------

        previewRef.current.visible =
            true;


        // --------------------------------------------------
        // Position
        //
        // buildPlacement gives us the position at
        // floor level.
        //
        // The box itself is centered vertically,
        // so move the visual preview upward by
        // half its height.
        // --------------------------------------------------

        const previewPosition =
            transform.position.clone();

        previewPosition.y +=
            height * 0.5;


        // --------------------------------------------------
        // Put the preview slightly ON the wall surface
        //
        // wallNormal points away from the wall.
        //
        // This prevents the blue rectangle from being
        // buried inside the wall or floating far away.
        // --------------------------------------------------

        previewPosition.add(
            transform.wallNormal.clone()
                .multiplyScalar(
                    state.wallThickness * 0.5 +
                    0.01
                )
        );


        previewRef.current.position.copy(
            previewPosition
        );


        // --------------------------------------------------
        // IMPORTANT:
        //
        // WallPiece uses:
        //
        // rotationY = -piece.rotationY
        //
        // BuildPlacement's rotation is offset by
        // 90 degrees, so we compensate here.
        //
        // This makes the opening width run along
        // the wall.
        // --------------------------------------------------

        previewRef.current.rotation.y =
            transform.rotationY -
            Math.PI / 2;

    });


    // ==================================================
    // RENDER OPENING PREVIEW
    // ==================================================

    return (

        <group ref={previewRef}>

            <mesh>

                <boxGeometry
                    args={[
                        width,
                        height,
                        previewDepth
                    ]}
                />

                <meshStandardMaterial
                    color="#4DA3FF"
                    transparent
                    opacity={0.55}
                    depthTest={false}
                    depthWrite={false}
                />

            </mesh>

        </group>

    );
}


// ==================================================
// DOOR / WINDOW MODEL PREVIEW
// ==================================================

function ModelPreview() {

    const { state } = useEditor();

    const { camera, scene } =
        useThree();

    const previewRef =
        useRef<Group>(null);

    const asset =
        state.selectedAsset;

    if (!asset) {
        return null;
    }


    // --------------------------------------------------
    // Load model
    // --------------------------------------------------

    const {
        scene: gltfScene
    } = useGLTF(asset.model);


    const model =
        useMemo(
            () => gltfScene.clone(),
            [gltfScene]
        );


    // --------------------------------------------------
    // Preview material
    // --------------------------------------------------

    useEffect(() => {

        model.traverse((child) => {

            if (!(child instanceof Mesh)) {
                return;
            }

            child.material =
                new MeshStandardMaterial({
                    color: "#4DA3FF",
                    transparent: true,
                    opacity: 0.55,
                    depthTest: false
                });

            child.renderOrder = 1000;

        });

    }, [model]);


    // --------------------------------------------------
    // Model bounds
    // --------------------------------------------------

    const bounds: AssetBounds =
        useMemo(() => {

            const box =
                new Box3()
                    .setFromObject(model);

            const size =
                new Vector3();

            box.getSize(size);

            return {

                width: size.x,

                height: size.y,

                depth: size.z

            };

        }, [model]);


    // --------------------------------------------------
    // Update preview
    // --------------------------------------------------

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


        previewRef.current.position.copy(
            transform.position
        );


        previewRef.current.rotation.y =
            transform.rotationY;

    });


    // --------------------------------------------------
    // Door / Window model orientation
    // --------------------------------------------------

    const modelRotationY =
        asset.type === BuildTool.Window
            ? 0
            : Math.PI / 2;


    return (

        <group ref={previewRef}>

            <group
                rotation={[
                    0,
                    modelRotationY,
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


// ==================================================
// PREVIEW SWITCH
// ==================================================

function PreviewModel() {

    const { state } = useEditor();


    // --------------------------------------------------
    // Opening
    // --------------------------------------------------

    if (
        state.selectedAsset?.type ===
        BuildTool.Opening
    ) {

        return (
            <OpeningPreview />
        );

    }


    // --------------------------------------------------
    // Door / Window
    // --------------------------------------------------

    return (
        <ModelPreview />
    );
}


// ==================================================
// MAIN ASSET PREVIEW
// ==================================================

export default function AssetPreview() {

    const { state } = useEditor();


    if (!state.layoutConfirmed) {
        return null;
    }


    if (!state.selectedAsset) {
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

        <Suspense fallback={null}>

            <PreviewModel />

        </Suspense>

    );
}