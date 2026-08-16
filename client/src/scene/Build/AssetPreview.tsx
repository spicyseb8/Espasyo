import { Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Group, Vector3, Mesh, MeshStandardMaterial } from "three";
import useEditor from "../../context/editor/useEditor";
import { buildInteraction } from "./BuildInteraction";
import { hitWallByRaycast } from "../../engine/walls/wallHit";
import { buildPlacement } from "./BuildPlacement";
import type { AssetBounds } from "./AssetBounds";
import { getFloorObjects, hitFloorByRaycast } from "../../engine/floors/floorHit";
import { buildFurniturePlacement } from "./BuildFurniturePlacement";
import { BuildTool } from "../../context/BuildTool";
import { checkFurnitureCollision } from "../../engine/furniture/FurnitureCollision";

function PreviewModel() {
    const { state } = useEditor();
    const { camera, scene } = useThree();
    const previewRef = useRef<Group>(null);
    const debugFrameCount = useRef(0);

    //--------------------------------------------------
    // Selected asset
    //--------------------------------------------------
    const asset = state.selectedAsset;
    if (!asset) return null;

    //--------------------------------------------------
    // Load GLB
    //--------------------------------------------------
    const { scene: gltfScene } = useGLTF(asset.model);

    //--------------------------------------------------
    // Clone once
    //--------------------------------------------------
    const model = useMemo(() => gltfScene.clone(), [gltfScene]);

    //--------------------------------------------------
    // Replace every material with preview material
    //--------------------------------------------------
    useMemo(() => {
        model.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            
            child.material = new MeshStandardMaterial({
                color: "#4DA3FF",
                transparent: true,
                opacity: 0.55,
                depthTest: false
            });
            
            child.renderOrder = 1000;
        });
    }, [model]);

    //--------------------------------------------------
    // Measure model
    //--------------------------------------------------
    const bounds: AssetBounds = useMemo(() => {
        const box = new Box3().setFromObject(model);
        const size = new Vector3();
        box.getSize(size);
        return {
            width: size.x,
            height: size.y,
            depth: size.z
        };
    }, [model]);

    //--------------------------------------------------
    // Get floor objects for furniture
    //--------------------------------------------------
    const floorObjects = useMemo(
        () => getFloorObjects(scene),
        [scene]
    );

    //--------------------------------------------------
    // Preview movement
    //--------------------------------------------------
    useFrame(() => {
        if (!previewRef.current) return;

        buildInteraction.raycaster.setFromCamera(
            buildInteraction.pointer,
            camera
        );

        //--------------------------------------------------
        // FURNITURE PREVIEW
        //--------------------------------------------------
        if (asset.type === BuildTool.Furniture) {
            const wallList = Array.isArray(state.walls) ? state.walls : [];
            const furnitureList = Array.isArray(state.furniture) ? state.furniture : [];
            const floorHit = hitFloorByRaycast(
                buildInteraction.raycaster,
                floorObjects
            );

            if (!floorHit) {
                if (debugFrameCount.current % 30 === 0) {
                    console.warn("[Furniture preview debug] No floor raycast hit", {
                        pointer: {
                            x: buildInteraction.pointer.x,
                            y: buildInteraction.pointer.y
                        },
                        floorCount: floorObjects.length,
                        wallCount: wallList.length,
                        furnitureCount: furnitureList.length,
                        selectedAsset: asset.id || asset.model,
                        layoutConfirmed: state.layoutConfirmed
                    });
                }
                debugFrameCount.current += 1;
                buildInteraction.currentPlacement = null;
                buildInteraction.currentBounds = null;
                buildInteraction.currentFurnitureCollision = null;
                previewRef.current.visible = false;
                return;
            }

            // Calculate furniture placement
            const transform = buildFurniturePlacement(
                floorHit.point,
                asset,
                bounds
            );

            // Collision check
            const collision = checkFurnitureCollision(
                transform.position,
                bounds.width,
                bounds.depth,
                wallList,
                furnitureList,
                state.wallThickness,
                0.05
            );

            // Store interaction data
            buildInteraction.currentPlacement = transform;
            buildInteraction.currentBounds = bounds;
            buildInteraction.currentFurnitureCollision = collision;

            // Move preview
            previewRef.current.visible = true;
            previewRef.current.position.copy(transform.position);
            previewRef.current.rotation.y = transform.rotationY;

            if (debugFrameCount.current % 30 === 0) {
                console.log("[Furniture preview debug] Placement probe", {
                    asset: asset.id || asset.model,
                    pointer: {
                        x: buildInteraction.pointer.x,
                        y: buildInteraction.pointer.y
                    },
                    floorHit: {
                        x: floorHit.point.x,
                        y: floorHit.point.y,
                        z: floorHit.point.z
                    },
                    transform: {
                        x: transform.position.x,
                        y: transform.position.y,
                        z: transform.position.z,
                        rotationY: transform.rotationY
                    },
                    collision: {
                        valid: collision.valid,
                        reason: collision.reason
                    },
                    floorCount: floorObjects.length,
                    wallCount: wallList.length,
                    furnitureCount: furnitureList.length,
                    wallThickness: state.wallThickness
                });
            }
            debugFrameCount.current += 1;

            // Change preview color based on collision
            model.traverse((child) => {
                if (!(child instanceof Mesh)) return;
                const material = child.material;
                if (material instanceof MeshStandardMaterial) {
                    material.color.set(
                        collision.valid ? "#4DA3FF" : "#D9534F"
                    );
                }
            });

            return;
        }

        //--------------------------------------------------
        // DOOR / WALL ASSET PREVIEW
        //--------------------------------------------------
        const hit = hitWallByRaycast(
            buildInteraction.raycaster,
            scene.children,
            state.walls
        );

        if (!hit) {
            buildInteraction.currentPlacement = null;
            buildInteraction.currentBounds = null;
            previewRef.current.visible = false;
            return;
        }

        previewRef.current.visible = true;

        const transform = buildPlacement(
            hit.wall,
            hit.point,
            asset,
            state.wallHeight,
            bounds
        );

        // Store the current placement and bounds
        buildInteraction.currentPlacement = transform;
        buildInteraction.currentBounds = bounds;

        previewRef.current.position.copy(transform.position);
        previewRef.current.rotation.y = transform.rotationY;

        // Reset color to default preview color for wall assets
        model.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            const material = child.material;
            if (material instanceof MeshStandardMaterial) {
                material.color.set("#4DA3FF");
            }
        });
    });

    //--------------------------------------------------
    // Render with appropriate rotation for asset type
    //--------------------------------------------------
    const isDoorOrWall = asset.type !== BuildTool.Furniture;

    return (
        <group ref={previewRef}>
            {isDoorOrWall ? (
                // Doors/Walls need the extra rotation to align with walls
                <group rotation={[0, Math.PI / 2, 0]}>
                    <primitive object={model} />
                </group>
            ) : (
                // Furniture renders directly without extra rotation
                <primitive object={model} />
            )}
        </group>
    );
}

export default function AssetPreview() {
    const { state } = useEditor();

    if (!state.layoutConfirmed || !state.selectedAsset) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <PreviewModel />
        </Suspense>
    );
}