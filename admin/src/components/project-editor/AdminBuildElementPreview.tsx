import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { DoubleSide, Group, Mesh, MeshStandardMaterial, Shape, ShapeGeometry, Vector3 } from "three";
import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import {
    fitAdminElementModelToBounds,
    getAdminElementModelBounds,
    normalizeAdminWindowModel,
    prepareAdminDoorModel
} from "@/components/project-loader/loader-components/AdminElementModelUtils";
import { disposeClonedMaterials } from "@/lib/disposeClonedMaterials";
import type { BuildElementPlacementCandidate } from "./buildElementPlacement";

export default function AdminBuildElementPreview({
    asset,
    candidate,
    wallThickness,
    onModelBounds,
    onPreviewReady
}: {
    asset: Asset;
    candidate: BuildElementPlacementCandidate | null;
    wallThickness: number;
    onModelBounds: (assetId: string, bounds: { width: number; height: number; depth: number }) => void;
    onPreviewReady?: () => void;
}) {
    const { scene } = useGLTF(asset.model);
    const normalizedSource = useMemo(
        () => asset.type === "window"
            ? normalizeAdminWindowModel(scene, asset)
            : prepareAdminDoorModel(scene, asset),
        [asset, scene]
    );
    const bounds = useMemo(
        () => getAdminElementModelBounds(normalizedSource),
        [normalizedSource]
    );

    useEffect(() => {
        if ([bounds.width, bounds.height, bounds.depth].every(value => Number.isFinite(value) && value > 0)) {
            onModelBounds(asset.id, bounds);
        }
    }, [asset.id, bounds, onModelBounds]);

    const previewWidth = candidate?.width ?? bounds.width;
    const previewHeight = candidate?.height ?? bounds.height;
    const previewDepth = candidate?.depth ?? bounds.depth;
    const previewModel = useMemo(() => {
        const clone = normalizedSource.clone(true);
        fitAdminElementModelToBounds(clone, {
            width: previewWidth,
            height: previewHeight,
            depth: previewDepth
        });
        clone.traverse(child => {
            if (!(child instanceof Mesh)) return;
            child.material = new MeshStandardMaterial({
                color: "#4DA3FF",
                transparent: true,
                opacity: 0.55,
                side: DoubleSide,
                depthWrite: false
            });
            child.renderOrder = 10;
        });
        return clone;
    }, [normalizedSource, previewDepth, previewHeight, previewWidth]);

    useEffect(() => () => disposeClonedMaterials(previewModel), [previewModel]);
    useEffect(() => {
        if (candidate) onPreviewReady?.();
    }, [candidate, onPreviewReady, previewModel]);

    const previewGroup = useRef<Group>(null);
    const cameraPosition = useRef(new Vector3());
    useFrame(({ camera }) => {
        if (!candidate || !previewGroup.current) return;
        camera.getWorldPosition(cameraPosition.current);
        const normalX = Math.sin(candidate.wallRotationY);
        const normalZ = Math.cos(candidate.wallRotationY);
        const cameraSide = (
            (cameraPosition.current.x - candidate.position.x) * normalX +
            (cameraPosition.current.z - candidate.position.z) * normalZ
        ) >= 0 ? 1 : -1;
        const surfaceOffset = wallThickness / 2 + previewDepth / 2 + 0.005;
        previewGroup.current.position.set(
            candidate.position.x + normalX * cameraSide * surfaceOffset,
            candidate.position.y,
            candidate.position.z + normalZ * cameraSide * surfaceOffset
        );
    });

    useEffect(() => {
        const color = candidate?.valid === false ? "#D9534F" : "#4DA3FF";
        previewModel.traverse(child => {
            if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
                child.material.color.set(color);
            }
        });
    }, [candidate?.valid, previewModel]);

    if (!candidate) return null;
    const rotationOffsetY = asset.rotationOffsetY ?? (asset.type === "door" ? Math.PI / 2 : 0);

    return (
        <group
            ref={previewGroup}
            rotation={[0, candidate.rotationY + rotationOffsetY, 0]}
            raycast={() => null}
        >
            <primitive object={previewModel} />
        </group>
    );
}

export function AdminOpeningPreview({
    candidate,
    wallThickness
}: {
    candidate: BuildElementPlacementCandidate;
    wallThickness: number;
}) {
    const geometry = useMemo(() => {
        const shape = new Shape();
        const halfWidth = candidate.width / 2;
        if (candidate.shape === "arch") {
            const archRise = Math.max(0, Math.min(candidate.archRise ?? 0, candidate.height));
            const springHeight = candidate.height - archRise;
            shape.moveTo(-halfWidth, 0);
            shape.lineTo(halfWidth, 0);
            shape.lineTo(halfWidth, springHeight);
            shape.quadraticCurveTo(0, candidate.height, -halfWidth, springHeight);
            shape.closePath();
        } else {
            shape.moveTo(-halfWidth, 0);
            shape.lineTo(halfWidth, 0);
            shape.lineTo(halfWidth, candidate.height);
            shape.lineTo(-halfWidth, candidate.height);
            shape.closePath();
        }
        return new ShapeGeometry(shape);
    }, [candidate.archRise, candidate.height, candidate.shape, candidate.width]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    const normalX = Math.sin(candidate.wallRotationY);
    const normalZ = Math.cos(candidate.wallRotationY);
    const previewColor = candidate.valid ? "#4DA3FF" : "#D9534F";
    const previewMesh = useRef<Mesh>(null);
    const cameraPosition = useRef(new Vector3());

    useFrame(({ camera }) => {
        camera.getWorldPosition(cameraPosition.current);
        const cameraSide = (
            (cameraPosition.current.x - candidate.position.x) * normalX +
            (cameraPosition.current.z - candidate.position.z) * normalZ
        ) >= 0 ? 1 : -1;
        const surfaceOffset = wallThickness / 2 + 0.005;
        previewMesh.current?.position.set(
            candidate.position.x + normalX * cameraSide * surfaceOffset,
            candidate.position.y,
            candidate.position.z + normalZ * cameraSide * surfaceOffset
        );
    });

    return (
        <mesh
            ref={previewMesh}
            geometry={geometry}
            rotation={[0, candidate.wallRotationY, 0]}
            renderOrder={10}
            raycast={() => null}
        >
            <meshBasicMaterial
                color={previewColor}
                transparent
                opacity={0.55}
                side={DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
}