import { useCallback, useEffect, useMemo, useRef } from "react";
import { DoubleSide, Plane, Raycaster, TextureLoader, Vector2, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { blueprintDisplayBounds } from "./blueprintGeometry";

export default function AdminBlueprintPlane({
    url,
    opacity,
    width,
    aspectRatio,
    position,
    rotation,
    locked,
    calibrationActive,
    onPositionChange,
    onRotationChange
}: {
    url: string;
    opacity: number;
    width: number;
    aspectRatio: number;
    position: { x: number; z: number };
    rotation: number;
    locked: boolean;
    calibrationActive: boolean;
    onPositionChange: (position: { x: number; z: number }) => void;
    onRotationChange: (rotation: number) => void;
}) {
    const texture = useMemo(() => new TextureLoader().load(url), [url]);
    const dragging = useRef<{ x: number; z: number } | null>(null);
    const { camera, gl } = useThree();
    const raycaster = useMemo(() => new Raycaster(), []);
    const groundPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
    const bounds = blueprintDisplayBounds(width, aspectRatio);

    useEffect(() => () => texture.dispose(), [texture]);

    const floorPointFromPointer = useCallback((event: PointerEvent) => {
        const rect = gl.domElement.getBoundingClientRect();
        const pointer = new Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(pointer, camera);
        return raycaster.ray.intersectPlane(groundPlane, new Vector3());
    }, [camera, gl, groundPlane, raycaster]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const offset = dragging.current;
            if (!offset || locked || calibrationActive) return;
            const point = floorPointFromPointer(event);
            if (!point) return;
            onPositionChange({ x: point.x - offset.x, z: point.z - offset.z });
        };
        const handlePointerUp = () => {
            dragging.current = null;
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [calibrationActive, floorPointFromPointer, locked, onPositionChange]);

    useEffect(() => {
        if (locked || calibrationActive) dragging.current = null;
    }, [calibrationActive, locked]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            if (
                locked ||
                calibrationActive ||
                event.repeat ||
                event.key.toLowerCase() !== "r" ||
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                (target instanceof HTMLElement && target.isContentEditable)
            ) {
                return;
            }
            event.preventDefault();
            onRotationChange(rotation + Math.PI / 2);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [calibrationActive, locked, onRotationChange, rotation]);

    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        if (locked || calibrationActive || event.nativeEvent.button !== 0) return;
        event.stopPropagation();
        dragging.current = {
            x: event.point.x - position.x,
            z: event.point.z - position.z
        };
    };

    return (
        <group
            position={[position.x, 0.005, position.z]}
            rotation-y={rotation}
        >
            <mesh
                rotation-x={-Math.PI / 2}
                onPointerDown={handlePointerDown}
                raycast={locked ? () => null : undefined}
            >
                <planeGeometry args={[bounds.width, bounds.height]} />
                <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} side={DoubleSide} />
            </mesh>
        </group>
    );
}
