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
    Plane,
    Raycaster,
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

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
    buildFurniturePlacement
} from "./FurniturePlacement";

import {
    checkFurnitureCollision
} from "../../engine/furniture/FurnitureCollision";

import {
    BuildTool
} from "../../context/BuildTool";

import {
    hitWallByRaycast
} from "../../engine/walls/wallHit";

//==================================================
// Actual furniture preview model
//==================================================

function FurniturePreviewModel() {

    const {
        state
    } = useEditor();

    const {
        camera,
        scene
    } = useThree();

    //--------------------------------------------------
    // Selected asset
    //--------------------------------------------------

    const asset =
        state.selectedAsset!;

    //--------------------------------------------------
    // Preview group
    //--------------------------------------------------

    const previewRef =
        useRef<Group>(null);

    //--------------------------------------------------
    // Raycaster
    //--------------------------------------------------

    const raycaster =
        useMemo(
            () =>
                new Raycaster(),
            []
        );

    //--------------------------------------------------
    // Ground plane
    //
    // This is intentionally NOT based on floor meshes.
    //
    // We always calculate the mouse's X/Z position
    // against the actual ground plane.
    //--------------------------------------------------

    const groundPlane =
        useMemo(
            () =>
                new Plane(
                    new Vector3(
                        0,
                        1,
                        0
                    ),
                    0
                ),
            []
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
    // Clone and size model
    //--------------------------------------------------

    const model =
        useMemo(
            () => {

                const clone =
                    gltfScene.clone();

                //--------------------------------------------------
                // Apply real-world dimensions
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

    useEffect(
        () => {

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
                            // Normal preview respects walls.
                            //--------------------------------------------------

                            depthTest:
                                true,

                            //--------------------------------------------------
                            // Transparent preview does not write depth.
                            //--------------------------------------------------

                            depthWrite:
                                false,

                            roughness:
                                0.75,

                            metalness:
                                0
                        });

                    //--------------------------------------------------
                    // Normal render order.
                    //--------------------------------------------------

                    child.renderOrder =
                        0;
                }
            );

        },
        [
            model
        ]
    );

    //--------------------------------------------------
    // Measure model
    //--------------------------------------------------

    const bounds:
        AssetBounds =
        useMemo(
            () => {

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
    // Live preview
    //--------------------------------------------------

    useFrame(
        () => {

            if (
                !previewRef.current
            ) {
                return;
            }

            //==================================================
            // GET MOUSE RAY
            //==================================================

            raycaster.setFromCamera(
                furnitureInteraction.pointer,
                camera
            );

            //==================================================
            // CHECK WALL UNDER MOUSE
            //==================================================
            //
            // This is separate from furniture snapping.
            //
            // When the mouse is actually over a wall:
            //
            //     - DO NOT wall-snap
            //     - DO NOT alter dimensions
            //     - DO NOT alter rotation
            //     - show collision
            //
            // The wall hit is only used to identify that
            // the cursor is on a wall.
            //==================================================

            const wallHit =
                hitWallByRaycast(
                    raycaster,
                    scene.children,
                    state.walls
                );

            const hoveringWall =
                Boolean(
                    wallHit
                );

            //==================================================
            // MOUSE → FLOOR POSITION
            //==================================================

            const floorPoint =
                new Vector3();

            let floorHit =
                false;

            //--------------------------------------------------
            // Mouse is directly over a wall
            //--------------------------------------------------

            if (
                wallHit
            ) {

                //--------------------------------------------------
                // Use the wall hit X/Z position.
                //
                // Y is ALWAYS the floor.
                //--------------------------------------------------

                floorPoint.set(
                    wallHit.point.x,
                    0,
                    wallHit.point.z
                );

                floorHit =
                    true;
            }

            //--------------------------------------------------
            // Mouse is not over a wall
            //--------------------------------------------------

            else {

                floorHit =
                    Boolean(
                        raycaster.ray.intersectPlane(
                            groundPlane,
                            floorPoint
                        )
                    );
            }

            //==================================================
            // NO FLOOR POSITION
            //==================================================

            if (
                !floorHit
            ) {

                furnitureInteraction
                    .clearPreview();

                previewRef.current.visible =
                    false;

                return;
            }

            //==================================================
            // BASE PLACEMENT
            //==================================================
            //
            // This keeps:
            //
            //     original dimensions
            //     original rotation
            //     correct model offset
            //
            // Nothing is resized here.
            //==================================================

            const transform =
                buildFurniturePlacement(
                    floorPoint,
                    asset,
                    bounds,
                    furnitureInteraction.rotationY
                );

            //==================================================
            // FINAL PLACEMENT
            //==================================================

            let finalTransform =
                transform;

            //--------------------------------------------------
            // MOUSE IS DIRECTLY ON WALL
            //
            // IMPORTANT:
            //
            // Do NOT call snapFurniturePlacement().
            //
            // This prevents the preview from being pushed,
            // repositioned, or visually distorted by wall snap.
            //
            // The furniture remains at its original dimensions
            // and original rotation.
            //--------------------------------------------------

            if (
                !hoveringWall
            ) {

                finalTransform =
                    snapFurniturePlacement(
                        floorPoint,
                        transform,
                        bounds,
                        state.walls,
                        state.furniture,
                        state.wallThickness
                    );
            }

            //==================================================
            // COLLISION
            //==================================================

            let collision;

            //--------------------------------------------------
            // Direct wall hover
            //
            // Force the preview into collision state.
            //--------------------------------------------------

            if (
                hoveringWall
            ) {

                collision = {
                    valid:
                        false,

                    reason:
                        "wall" as const
                };

            }

            //--------------------------------------------------
            // Normal placement
            //--------------------------------------------------

            else {

                collision =
                    checkFurnitureCollision(
                        finalTransform.position,
                        bounds.width,
                        bounds.depth,
                        finalTransform.rotationY,
                        state.walls,
                        state.furniture,
                        state.wallThickness,
                        0.01
                    );
            }

            //==================================================
            // STORE PREVIEW
            //==================================================

            furnitureInteraction.currentPlacement =
                finalTransform;

            furnitureInteraction.currentBounds =
                bounds;

            furnitureInteraction.currentCollision =
                collision;

            //==================================================
            // SHOW PREVIEW
            //==================================================

            previewRef.current.visible =
                true;

            //==================================================
            // POSITION
            //==================================================

            previewRef.current.position.copy(
                finalTransform.position
            );

            //--------------------------------------------------
            // IMPORTANT:
            //
            // buildFurniturePlacement already gives us:
            //
            //     modelOffset.y = bounds.height / 2
            //
            // Apply it here so the preview sits at the
            // exact same vertical level as placed furniture.
            //--------------------------------------------------

            previewRef.current.position.y +=
                finalTransform.modelOffset.y;

            //==================================================
            // ROTATION
            //==================================================
            //
            // Never change rotation during snapping.
            //==================================================

            previewRef.current.rotation.y =
                finalTransform.rotationY;

            //==================================================
            // PREVIEW MATERIAL
            //==================================================

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

                        //--------------------------------------------------
                        // Blue = valid placement
                        // Red = collision
                        //--------------------------------------------------

                        child.material.color.set(
                            collision.valid
                                ? "#4DA3FF"
                                : "#D9534F"
                        );

                        //--------------------------------------------------
                        // Normal:
                        //     respect wall depth
                        //
                        // Direct wall hover:
                        //     show the complete collision preview
                        //     even if the wall is in front of it.
                        //--------------------------------------------------

                        child.material.depthTest =
                            !hoveringWall;

                        //--------------------------------------------------
                        // Keep transparent preview from writing depth.
                        //--------------------------------------------------

                        child.material.depthWrite =
                            false;

                        //--------------------------------------------------
                        // When directly hovering a wall, make the
                        // collision preview render above it so the
                        // user can see the full furniture footprint.
                        //--------------------------------------------------

                        child.renderOrder =
                            hoveringWall
                                ? 1000
                                : 0;
                    }

                }
            );
        }
    );

    //==================================================
    // RENDER
    //==================================================

    return (

        <group
            ref={
                previewRef
            }
        >

            <primitive
                object={
                    model
                }
            />

        </group>

    );
}

//==================================================
// Wrapper
//==================================================

export default function FurniturePreview() {

    const {
        state
    } = useEditor();

    //--------------------------------------------------
    // Layout must be confirmed
    //--------------------------------------------------

    if (
        !state.layoutConfirmed
    ) {
        return null;
    }

    //--------------------------------------------------
    // Asset must exist
    //--------------------------------------------------

    if (
        !state.selectedAsset
    ) {
        return null;
    }

    //--------------------------------------------------
    // Must be furniture
    //--------------------------------------------------

    if (
        state.selectedAsset.type !==
        BuildTool.Furniture
    ) {
        return null;
    }

    //--------------------------------------------------
    // Furniture build tool must be active
    //--------------------------------------------------

    if (
        state.buildTool !==
        BuildTool.Furniture
    ) {
        return null;
    }

    return (

        <Suspense
            fallback={
                null
            }
        >

            <FurniturePreviewModel />

        </Suspense>

    );
}