import { Shape, ShapeGeometry, DoubleSide, Vector3 } from "three";
import { useMemo } from "react";

interface FloorProps {
    polygon: Vector3[];
}

export default function Floor({
    polygon
}: FloorProps) {

    const geometry = useMemo(() => {

        if (!polygon)
            return null;

        const valid = polygon.filter(Boolean);

        if (valid.length < 3)
            return null;

        console.log("Polygon");
        valid.forEach((p, i) => {
            console.log(i, p.x, p.y, p.z);
        });

        const shape = new Shape();

        shape.moveTo(
            valid[0].x,
            valid[0].z
        );

        for (let i = 1; i < valid.length; i++) {

            shape.lineTo(
                valid[i].x,
                valid[i].z
            );

        }

        shape.closePath();

        return new ShapeGeometry(shape);

    }, [polygon]);

    if (!geometry)
        return null;

    return (

        <mesh
            geometry={geometry}
            rotation={[-Math.PI / 2, 0, 0]}
            onUpdate={(mesh) => {
                console.log("Floor mesh position:", mesh.position);
            }}
        >

            <meshStandardMaterial
                color="#f7af2a"
                side={DoubleSide}
            />

        </mesh>

    );

}