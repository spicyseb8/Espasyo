import { Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
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

function PreviewModel() {
    const { state } = useEditor();
    const { camera, scene } = useThree();
    const previewRef = useRef<Group>(null);

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
    // Preview movement
    //--------------------------------------------------
    useFrame(() => {
        if (!previewRef.current) return;

        buildInteraction.raycaster.setFromCamera(
            buildInteraction.pointer,
            camera
        );

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

        //--------------------------------------------------
        // Future: model.position.copy(transform.modelOffset);
        //--------------------------------------------------
    });

    return (
        <group ref={previewRef}>
            <group rotation={[0, Math.PI / 2, 0]}>
                <primitive object={model} />
            </group>
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