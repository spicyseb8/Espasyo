import { useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import {
    Shape,
    ShapeGeometry,
    DoubleSide,
    Vector3,
    RepeatWrapping,
} from "three";

interface FloorProps {
    polygon: Vector3[];
}

export default function Floor({ polygon }: FloorProps) {
    // Load PBR textures
    const textures = useTexture({
        map: "/textures/floor/wood-color.png",
        normalMap: "/textures/floor/wood-normal.png",
        roughnessMap: "/textures/floor/wood-roughness.png",
    });

    // Configure texture tiling
    useEffect(() => {
        Object.values(textures).forEach((texture) => {
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.repeat.set(0.5, 0.5);
            texture.needsUpdate = true;
        });
    }, [textures]);

    // Generate floor geometry from the room polygon
    const geometry = useMemo(() => {
        if (!polygon) return null;

        const valid = polygon.filter(Boolean);

        if (valid.length < 3) return null;

        const shape = new Shape();

        shape.moveTo(valid[0].x, -valid[0].z);

        for (let i = 1; i < valid.length; i++) {
            shape.lineTo(valid[i].x, -valid[i].z);
        }

        shape.closePath();

        return new ShapeGeometry(shape);
    }, [polygon]);

    if (!geometry) return null;

    return (
        <mesh
            geometry={geometry}
            rotation={[-Math.PI / 2, 0, 0]}
        >
            <meshStandardMaterial
                map={textures.map}
                normalMap={textures.normalMap}
                roughnessMap={textures.roughnessMap}
                metalness={0}
                side={DoubleSide}
            />
        </mesh>
    );
}